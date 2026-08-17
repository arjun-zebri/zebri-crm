/**
 * AI copilot endpoint — natural language → automation edits.
 *
 * POST { automationId, messages } streams SSE frames (see
 * `lib/automations/ai-copilot/stream.ts`) while the function-calling
 * loop builds/edits the draft automation through the validated tool
 * executors. The AI never activates automations; every mutation is
 * RLS-scoped to the caller and draft-only.
 *
 * Gates, in order: auth → subscription → per-minute burst limit →
 * DB-backed daily cap (`increment_ai_copilot_usage()` — deliberately
 * not the in-memory limiter, which resets on serverless cold starts).
 *
 * `ANTHROPIC_API_KEY` is read server-side only (CI guard:
 * `scripts/check-no-service-role-in-client.mjs`).
 *
 * @module app/api/ai/automation-copilot
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { sendAlert } from '@/lib/alerts/send-alert'
import { inMemoryLimiter } from '@/lib/api/rate-limit'
import { parseJsonBody } from '@/lib/api/validate'
import { isSubscribed } from '@/lib/auth/entitlements'
import { getAnthropicClient, runCopilotTurn, type CopilotChatMessage } from '@/lib/automations/ai-copilot/llm-client'
import { encodeCopilotEvent } from '@/lib/automations/ai-copilot/stream'
import {
  buildAutomationStateContext,
  buildCopilotSystemPrompt,
  type AutomationStateAction,
  type AutomationStateHead,
} from '@/lib/automations/ai-copilot/system-prompt'
import { executeCopilotTool, type CopilotDb } from '@/lib/automations/ai-copilot/tool-executors'
import { createClient as createServerClient } from '@/lib/supabase/server'

/** Messages per user per day — the spend ceiling on the Anthropic API. */
export const DAILY_MESSAGE_CAP = 100

// Burst guard: 20 messages/minute/user stops a client loop from
// burning the daily cap (and the Anthropic bill) in seconds.
const burstLimiter = inMemoryLimiter({ windowMs: 60_000, max: 20 })

const bodySchema = z.object({
  automationId: z.string().uuid(),
  // Panel-held conversation history, oldest first, last entry the new
  // user message. Bounded hard so a hostile client can't stuff tokens.
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4_000),
      }),
    )
    .min(1)
    .max(40),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isSubscribed(auth.user)) {
    return NextResponse.json(
      { error: 'Zebri AI needs an active subscription.' },
      { status: 403 },
    )
  }

  const burst = await burstLimiter.check(auth.user.id)
  if (!burst.allowed) {
    return NextResponse.json(
      { error: 'Too many messages. Wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(burst.retryAfter / 1000)) } },
    )
  }

  const parsed = await parseJsonBody(request, bodySchema)
  if (!parsed.ok) return parsed.response
  const { automationId, messages } = parsed.data

  if (messages[messages.length - 1]!.role !== 'user') {
    return NextResponse.json({ error: 'Last message must be from the user.' }, { status: 400 })
  }

  // RLS-scoped read → the 404 doubles as the tenant guard. The full
  // row (not just id) feeds the injected state context below.
  const { data: automation } = await supabase
    .from('automations' as never)
    .select('id, name, status, trigger_type, trigger_config')
    .eq('id', automationId)
    .maybeSingle()
  if (!automation) {
    return NextResponse.json({ error: 'Automation not found.' }, { status: 404 })
  }

  // DB-backed daily cap. Incrementing before the check means a capped
  // request still counts — harmless, since it was refused.
  const { data: usageCount, error: usageError } = await (supabase.rpc as (fn: never) => never)(
    'increment_ai_copilot_usage' as never,
  )
  if (usageError) {
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'ai-copilot',
      message: `usage counter failed for user=${auth.user.id}: ${(usageError as { message: string }).message}`,
    })
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
  if ((usageCount as unknown as number) > DAILY_MESSAGE_CAP) {
    return NextResponse.json(
      { error: `Daily Zebri AI limit reached (${DAILY_MESSAGE_CAP} messages). Resets tomorrow.` },
      { status: 429 },
    )
  }

  // Inject the current automation into the final user turn so the
  // model doesn't burn a read_automation round trip on every question.
  // Server-side only — the panel never sees or re-sends this block.
  const { data: actionRows } = await supabase
    .from('automation_actions' as never)
    .select('id, position, type, label, config, parent_action_id, branch_path')
    .eq('automation_id', automationId)
    .order('position', { ascending: true })
  const stateContext = buildAutomationStateContext(
    automation as unknown as AutomationStateHead,
    (actionRows as unknown as AutomationStateAction[] | null) ?? [],
  )
  const chatMessages: CopilotChatMessage[] = messages.map((m, index) => ({
    role: m.role,
    content:
      index === messages.length - 1
        ? `<current_automation>\n${stateContext}\n</current_automation>\n\n${m.content}`
        : m.content,
  }))
  const userId = auth.user.id

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(encodeCopilotEvent(event)))
      try {
        await runCopilotTurn({
          client: getAnthropicClient(),
          system: buildCopilotSystemPrompt(),
          messages: chatMessages,
          // The executor interface narrows the query surface it needs;
          // the real client satisfies it at runtime (chain methods
          // appear after .select() in supabase-js types, hence the cast).
          executeTool: (name, input) =>
            executeCopilotTool(name, input, {
              automationId,
              supabase: supabase as unknown as CopilotDb,
            }),
          onEvent: send,
        })
        send({ type: 'done' })
      } catch (error) {
        await sendAlert({
          type: 'app_error',
          severity: 'error',
          source: 'ai-copilot',
          message: `copilot turn failed for user=${userId}: ${error instanceof Error ? error.message : String(error)}`,
        })
        send({ type: 'error', message: 'Something went wrong. Please try again.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
