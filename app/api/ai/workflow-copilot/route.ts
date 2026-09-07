/**
 * AI copilot endpoint — natural language → workflow edits.
 *
 * POST { templateId, messages } streams SSE frames (see
 * `lib/workflows/ai-copilot/stream.ts`) while the function-calling
 * loop builds/edits the draft workflow through the validated tool
 * executors. The AI never activates a workflow; every mutation is
 * RLS-scoped to the caller and draft-only.
 *
 * Gates, in order: auth → subscription → per-minute burst limit →
 * DB-backed daily cap (`increment_ai_copilot_usage()` — deliberately
 * not the in-memory limiter, which resets on serverless cold starts).
 *
 * `ANTHROPIC_API_KEY` is read server-side only (CI guard:
 * `scripts/check-no-service-role-in-client.mjs`).
 *
 * @module app/api/ai/workflow-copilot/route
 */
import { NextRequest, NextResponse } from 'next/server';

import { sendAlert } from '@/lib/alerts/send-alert';
import { inMemoryLimiter } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { isSubscribed } from '@/lib/auth/entitlements';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { DAILY_MESSAGE_CAP } from '@/lib/workflows/ai-copilot/limits';
import {
  getAnthropicClient,
  runCopilotTurn,
  type CopilotChatMessage,
} from '@/lib/workflows/ai-copilot/llm-client';
import { copilotRequestSchema } from '@/lib/workflows/ai-copilot/request';
import { encodeCopilotEvent } from '@/lib/workflows/ai-copilot/stream';
import {
  buildAutomationStateContext,
  buildCopilotSystemPrompt,
  type AutomationStateAction,
  type AutomationStateHead,
} from '@/lib/workflows/ai-copilot/system-prompt';
import { executeCopilotTool, type CopilotDb } from '@/lib/workflows/ai-copilot/tool-executors';
import { joinStepType } from '@/lib/workflows/steps';

/**
 * Messages per user per day — the spend ceiling on the Anthropic API.
 * Re-exported from `lib` so existing importers keep working while the
 * value itself stays out of a route module.
 */
export { DAILY_MESSAGE_CAP } from '@/lib/workflows/ai-copilot/limits';

// Burst guard: 20 messages/minute/user stops a client loop from
// burning the daily cap (and the Anthropic bill) in seconds.
const burstLimiter = inMemoryLimiter({ windowMs: 60_000, max: 20 });

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSubscribed(auth.user)) {
    return NextResponse.json({ error: 'Zebri AI needs an active subscription.' }, { status: 403 });
  }

  const burst = await burstLimiter.check(auth.user.id);
  if (!burst.allowed) {
    return NextResponse.json(
      { error: 'Too many messages. Wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(burst.retryAfter / 1000)) } },
    );
  }

  // The schema lives in `lib` so the client can be checked against the
  // same object; see its module docstring for the mismatch that cost.
  const parsed = await parseJsonBody(request, copilotRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { templateId, messages } = parsed.data;

  if (messages[messages.length - 1]!.role !== 'user') {
    return NextResponse.json({ error: 'Last message must be from the user.' }, { status: 400 });
  }

  // RLS-scoped read → the 404 doubles as the tenant guard. The full
  // row (not just id) feeds the injected state context below.
  const { data: templateRow } = await supabase
    .from('workflow_templates')
    .select('id, name, status, apply_rule_type, apply_rule_config')
    .eq('id', templateId)
    .maybeSingle();
  if (!templateRow) {
    return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
  }
  // The copilot speaks the automations vocabulary, so the apply rule is
  // unwrapped back into a trigger before it reaches the prompt.
  const ruleConfig = templateRow.apply_rule_config as {
    eventType?: string;
    triggerConfig?: unknown;
  } | null;
  const automation: AutomationStateHead = {
    name: templateRow.name,
    status: templateRow.status,
    trigger_type: ruleConfig?.eventType ?? templateRow.apply_rule_type,
    trigger_config: ruleConfig?.triggerConfig ?? {},
  };

  // DB-backed daily cap. Incrementing before the check means a capped
  // request still counts — harmless, since it was refused.
  const { data: usageCount, error: usageError } = await (supabase.rpc as (fn: never) => never)(
    'increment_ai_copilot_usage' as never,
  );
  if (usageError) {
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'ai-copilot',
      message: `usage counter failed for user=${auth.user.id}: ${(usageError as { message: string }).message}`,
    });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  if ((usageCount as unknown as number) > DAILY_MESSAGE_CAP) {
    return NextResponse.json(
      { error: `Daily Zebri AI limit reached (${DAILY_MESSAGE_CAP} messages). Resets tomorrow.` },
      { status: 429 },
    );
  }

  // Inject the current workflow into the final user turn so the model
  // doesn't burn a read_automation round trip on every question.
  // Server-side only — the panel never sees or re-sends this block.
  const { data: stepRows } = await supabase
    .from('workflow_template_steps')
    .select('id, position, type, title, config, parent_step_id, branch_path')
    .eq('template_id', templateId)
    .order('position', { ascending: true });
  const actionRows: AutomationStateAction[] = (stepRows ?? []).map((row) => ({
    id: row.id,
    position: row.position,
    type: joinStepType(row.type, row.config as Record<string, unknown> | null),
    label: row.title || null,
    config: row.config,
    parent_action_id: row.parent_step_id,
    branch_path: row.branch_path,
  }));
  const stateContext = buildAutomationStateContext(automation, actionRows);
  const chatMessages: CopilotChatMessage[] = messages.map((m, index) => ({
    role: m.role,
    content:
      index === messages.length - 1
        ? `<current_automation>\n${stateContext}\n</current_automation>\n\n${m.content}`
        : m.content,
  }));
  const userId = auth.user.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(encodeCopilotEvent(event)));
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
              // The executors deliberately keep the automations
              // vocabulary internally; the wire field does not.
              automationId: templateId,
              supabase: supabase as unknown as CopilotDb,
            }),
          onEvent: send,
        });
        send({ type: 'done' });
      } catch (error) {
        await sendAlert({
          type: 'app_error',
          severity: 'error',
          source: 'ai-copilot',
          message: `copilot turn failed for user=${userId}: ${error instanceof Error ? error.message : String(error)}`,
        });
        send({ type: 'error', message: 'Something went wrong. Please try again.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
