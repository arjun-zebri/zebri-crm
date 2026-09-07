/**
 * AI drafting endpoint — rewrite one held email before it sends.
 *
 * POST `{ stepId, instruction, subject, body }` → `{ subject, body }`.
 * Non-streaming: a rewrite is one short completion and the review card
 * shows a spinner for it, so an SSE channel would buy nothing.
 *
 * The step id is the tenant guard: it is read through the caller's
 * RLS-scoped client, so a step belonging to another MC is a 404. The
 * copy itself comes from the request because the MC may already have
 * edited it on screen, and rewriting what they can see is the point.
 *
 * Gates, in order: auth → subscription → per-minute burst limit →
 * the same DB-backed daily cap the copilot uses, so one MC cannot run
 * up an Anthropic bill through whichever surface is cheaper to loop.
 *
 * @module app/api/ai/draft-email/route
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { sendAlert } from '@/lib/alerts/send-alert'
import { inMemoryLimiter } from '@/lib/api/rate-limit'
import { parseJsonBody } from '@/lib/api/validate'
import { isSubscribed } from '@/lib/auth/entitlements'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { buildDraftPrompt, DRAFT_SYSTEM_PROMPT, parseDraft } from '@/lib/workflows/ai-draft'
import { DAILY_MESSAGE_CAP } from '@/lib/workflows/ai-copilot/limits'
import { COPILOT_MODEL, getAnthropicClient } from '@/lib/workflows/ai-copilot/llm-client'

// A rewrite is a deliberate press on a card, so ten a minute is already
// far past human speed and only a runaway client reaches it.
const burstLimiter = inMemoryLimiter({ windowMs: 60_000, max: 10 })

/** Enough tokens for a long email plus the format markers. */
const MAX_TOKENS = 4_000

const bodySchema = z.object({
  stepId: z.string().uuid(),
  instruction: z.string().min(2).max(600),
  subject: z.string().max(300),
  body: z.string().max(20_000),
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
      { error: 'Too many rewrites. Wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(burst.retryAfter / 1000)) } },
    )
  }

  const parsed = await parseJsonBody(request, bodySchema)
  if (!parsed.ok) return parsed.response
  const { stepId, instruction, subject, body } = parsed.data

  // RLS-scoped read → the 404 doubles as the tenant guard.
  const { data: step } = await supabase
    .from('workflow_steps')
    .select('title, instance_id')
    .eq('id', stepId)
    .maybeSingle()
  if (!step) {
    return NextResponse.json({ error: 'Step not found.' }, { status: 404 })
  }

  // Couple details give the model something to be specific about. A
  // missing couple (a personal workflow) simply drops the lines.
  const { data: instance } = await supabase
    .from('workflow_instances')
    .select('couples(name, event_date)')
    .eq('id', step.instance_id)
    .maybeSingle()
  const couple = (instance as { couples?: { name?: string; event_date?: string | null } | null } | null)
    ?.couples ?? null

  const { data: usageCount, error: usageError } = await (supabase.rpc as (fn: never) => never)(
    'increment_ai_copilot_usage' as never,
  )
  if (usageError) {
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'ai-draft-email',
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

  const prompt = buildDraftPrompt({
    instruction,
    subject,
    body,
    stepTitle: step.title ?? '',
    coupleName: couple?.name ?? null,
    weddingDate: couple?.event_date ?? null,
    senderName: (auth.user.user_metadata?.['display_name'] as string | undefined) ?? null,
  })

  try {
    const message = await getAnthropicClient().create({
      model: COPILOT_MODEL,
      max_tokens: MAX_TOKENS,
      system: DRAFT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
    return NextResponse.json(parseDraft(text, { subject, body }))
  } catch (err) {
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'ai-draft-email',
      message: `draft failed for user=${auth.user.id}: ${(err as Error).message}`,
    })
    return NextResponse.json(
      { error: 'Zebri AI could not rewrite that. Try again in a moment.' },
      { status: 502 },
    )
  }
}
