/**
 * The sender for an automated step that sends as the MC.
 *
 * Every action that mails from the MC's connected mailbox (`send_email`,
 * the questionnaire, contract, invoice and run-sheet sends) resolves its
 * sender here, so they all treat an unreachable mailbox the same way
 * (Phase 5 fix wave, M7): a transient failure errors the step instead of
 * quietly sending from the shared Zebri address the MC never approved. A
 * connection that is dead for good has already been marked failed by
 * `resolveSenderForSend`, and the shared address is then the honest
 * answer.
 *
 * @module lib/automations/actions/step-sender
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveSenderForSend, type ResolvedSender } from '@/lib/email/sender-identity'
import type { ActionResult, RunContext } from '@/types/automations'
import type { Database } from '@/types/database'

/** The step's sender, or the error result the step should return. */
export type StepSender =
  | { ok: true; sender: ResolvedSender }
  | { ok: false; result: Extract<ActionResult, { kind: 'error' }> }

/**
 * Resolve the sender for one step, before anything is sent.
 *
 * The error is not recoverable: the executor does not retry it on its own
 * backoff, the step errors and the MC sees why. Pressing Try again once
 * the mailbox answers sends it through their mailbox, as approved.
 *
 * @param supabase The service-role client the step already holds.
 * @param ctx The step's run context (the MC and their business name).
 * @param action The action type, prefixed to the step's error message.
 */
export async function resolveStepSender(
  supabase: SupabaseClient<Database>,
  ctx: Pick<RunContext, 'userId' | 'mc'>,
  action: string,
): Promise<StepSender> {
  const res = await resolveSenderForSend(supabase, ctx.userId, ctx.mc.businessName)
  if (res.status === 'ok') return { ok: true, sender: res.sender }
  return {
    ok: false,
    result: {
      kind: 'error',
      message: `${action}: could not reach your connected mailbox (${res.reason}), so nothing was sent. Try again in a moment.`,
      recoverable: false,
    },
  }
}
