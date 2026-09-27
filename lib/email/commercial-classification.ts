/**
 * Which automated sends are "commercial electronic messages" under the
 * Australian Spam Act, and which are transactional.
 *
 * This is data, not logic, on purpose. The plan's standing decision
 * (docs/superpowers/plans/2026-09-23-workflows-trust-remediation.md,
 * "Blocking decision before Task 10") is provisional: get it in writing
 * from a lawyer, and until it lands, build for the stricter reading -
 * everything automated is commercial and carries an unsubscribe link,
 * except an explicit allow-list of transactional actions that plainly
 * are not. Invoices and signed contracts are the two the plan names as
 * plainly transactional; review requests, referral requests, anniversary
 * messages and thank-you notes are plainly commercial, so they are
 * deliberately left off the allow-list rather than enumerated: the
 * default already covers them.
 *
 * Keeping the list in one small module rather than scattering
 * `actionType === 'send_invoice'` checks through the renderer or the
 * send path means the day the lawyer's answer differs (say, the quote or
 * the run sheet turns out to need the header too), the fix is a one-line
 * edit here, not a hunt across every caller.
 *
 * Who reads it. The automation send gate (`openAutomationSend` and
 * `sendAutomationEmail` in `./automation-send`) calls
 * {@link isTransactionalSend} with the action type on every send, and
 * `send_email` calls it for its own inline gate, so no action decides its
 * own classification by where its code happens to live. For this build the
 * portal link, request information, the run sheet (to vendors and to the
 * couple) and the questionnaire are commercial, by the default: the exit
 * criterion is that unsubscribing stops every future automated send to
 * that address.
 *
 * @module lib/email/commercial-classification
 */
import type { ActionType } from '@/types/automations'

/**
 * Automated actions that are transactional, not commercial: sending them
 * needs no unsubscribe link. Everything else defaults to commercial (the
 * stricter reading) until a lawyer says otherwise.
 */
export const TRANSACTIONAL_ACTION_TYPES: ReadonlySet<ActionType> = new Set<ActionType>([
  'send_invoice',
  'send_contract',
])

/**
 * Whether an automated send of this action type is transactional (no
 * unsubscribe link required) rather than commercial (link required).
 *
 * A missing or unrecognised action type defaults to commercial, same as
 * every other action not on the allow-list: the stricter reading treats
 * "we don't know" the same as "yes, this is a marketing-shaped message".
 *
 * @param actionType The automation action type this send came from, or
 *   `null`/`undefined` when the send did not originate from a workflow
 *   action (the caller decides what that means for its own send path;
 *   this function only answers for the action types it knows).
 */
export function isTransactionalSend(actionType: ActionType | null | undefined): boolean {
  if (!actionType) return false
  return TRANSACTIONAL_ACTION_TYPES.has(actionType)
}
