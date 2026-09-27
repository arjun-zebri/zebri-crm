/**
 * Who a `send_email` step mails, and how: the decisions, apart from the
 * dispatch.
 *
 * The send (`lib/automations/actions/messaging`) and the step envelope
 * the MC reads before approving (`lib/workflows/send-envelope`) both call
 * these, and nothing else, to decide the recipient list (the step's own
 * people plus every cc and bcc address split out into its own message),
 * the MC's own copy (also its own message), who opted out, the reply-to address and the set of
 * attached files. Two copies of this logic would drift, and an envelope
 * that disagrees with the send is worse than none: it tells the MC a
 * message is going to someone it is not.
 *
 * Everything here is pure except {@link resolveCopyCandidates} and
 * {@link gateOptOuts}, which only read. The caller chooses the client:
 * the send passes the service-role client (it runs with no session), the
 * envelope passes the MC's own RLS client.
 *
 * @module lib/email/send-email-plan
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveRecipients } from '@/lib/automations/recipients'
import type { CoupleSnapshot, RecipientRole, ResolvedRecipient } from '@/types/automations'
import type { Database } from '@/types/database'

import { isCoupleOptedOut, isEmailSuppressed } from './suppression'

/**
 * The recipient roles that ARE the couple, as opposed to other people a
 * step may also address.
 *
 * `couples.do_not_email` records that this couple asked to stop hearing
 * from the MC. It says nothing about their florist or their mother, so
 * only these two roles are dropped when the flag is set.
 */
export const COUPLE_OWN_ROLES: ReadonlySet<RecipientRole> = new Set(['primary', 'spouse'])

/** The copy settings of a `send_email` config. */
export interface CopySettings {
  ccVendors?: boolean | undefined
  ccEmails?: string[] | undefined
  bccEmails?: string[] | undefined
}

/**
 * The cc candidates (vendors attached to the couple, typed cc addresses)
 * and the typed bcc addresses, resolved once per step.
 *
 * Typed addresses without an `@` are half-finished entries, not
 * recipients, so they are dropped rather than sent to.
 */
export async function resolveCopyCandidates(
  supabase: SupabaseClient<Database>,
  couple: CoupleSnapshot,
  config: CopySettings,
): Promise<{ ccCandidates: string[]; typedBcc: string[] }> {
  const ccCandidates: string[] = []
  if (config.ccVendors) {
    const vendors = await resolveRecipients(supabase, couple, { roles: ['vendor'], fallback: 'skip' })
    for (const v of vendors) if (v.email) ccCandidates.push(v.email)
  }
  for (const raw of config.ccEmails ?? []) {
    const trimmed = raw.trim()
    if (trimmed.includes('@')) ccCandidates.push(trimmed)
  }
  const typedBcc = (config.bccEmails ?? []).map((e) => e.trim()).filter((e) => e.includes('@'))
  return { ccCandidates, typedBcc }
}

/** Who a step addresses, once its copies are decided. */
export interface RecipientPlan {
  /** The step's own recipients' addresses, lower-cased. */
  direct: ReadonlySet<string>
  /** cc/bcc addresses mailed as their own messages (commercial sends). */
  copyRecipients: ResolvedRecipient[]
  /** A cc list on every message (transactional sends only). */
  cc: string[] | undefined
  /**
   * The typed bcc riding on the step's own recipients' messages
   * (transactional sends only). Always empty on a commercial send: the
   * couple's message carries no bcc at all.
   */
  bcc: string[]
  /**
   * The MC's own paper-trail copy, sent as its own message after the
   * couple's (see {@link planRecipients}), or null when none was asked
   * for or the MC is already one of the step's own recipients.
   */
  mcCopy: string | null
  /**
   * The bcc list as the couple's message carried it before the MC's copy
   * became its own message. Only for the idempotency fingerprint: keeping
   * it there keeps every step's per-recipient keys, and so its
   * `couple_emails` rows and Resend deduplication, the same across the
   * change. Never put on a message.
   */
  fingerprintBcc: string[]
  /** Everyone who gets a message and has an address, direct first. */
  addressable: ResolvedRecipient[]
}

/**
 * Decide the copies and the final recipient list.
 *
 * On a commercial send every cc and typed bcc address becomes its own
 * message (Task 15c). As a copy on the couple's message it would carry
 * the couple's unsubscribe link (so a cc'd vendor could unsubscribe the
 * couple), have no link of its own, and never be checked against
 * `email_suppression`. As its own message it gets its own link, header,
 * idempotency key and suppression check, like any direct recipient. It
 * is not the couple, so the `custom` role keeps the couple's
 * `do_not_email` from applying to it (see {@link COUPLE_OWN_ROLES}).
 *
 * The MC's own address, wherever it was entered (`bccSelf`, or typed as
 * a cc or bcc), becomes {@link RecipientPlan.mcCopy}: one copy of its own
 * (Phase 5 fix wave, I1 and P1). As a bcc on the couple's message it
 * carried the couple's footer link and `List-Unsubscribe` header, so the
 * MC tidying their inbox could opt the couple out; and a Resend event on
 * that message could not say which mailbox it was about, so a full MC
 * inbox marked the couple's row bounced. The MC is not a subscriber, so
 * the copy carries no unsubscribe link, and it is not a couple record,
 * so it is never logged.
 *
 * A transactional send keeps the pre-15c shape: one cc list and one bcc
 * list on every message, the cc deduped against the direct recipients.
 * The MC's copy is its own message there too.
 */
export function planRecipients(input: {
  recipients: ResolvedRecipient[]
  ccCandidates: string[]
  typedBcc: string[]
  bccSelf: boolean
  mcEmail: string | null | undefined
  commercial: boolean
}): RecipientPlan {
  const { recipients, ccCandidates, typedBcc, mcEmail, commercial } = input
  const mcAddress = mcEmail ? mcEmail.trim().toLowerCase() : null
  const direct = new Set(
    recipients.map((r) => r.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e)),
  )

  let cc: string[] | undefined
  let bcc: string[]
  let fingerprintBcc: string[]
  let wantsMcCopy = Boolean(input.bccSelf && mcEmail)
  const copyRecipients: ResolvedRecipient[] = []
  if (commercial) {
    const seen = new Set(direct)
    for (const address of [...ccCandidates, ...typedBcc]) {
      const key = address.toLowerCase()
      if (key === mcAddress) {
        wantsMcCopy = true
        continue
      }
      // Anyone already addressed (directly or as an earlier copy) is
      // dropped so nobody gets the same email twice.
      if (seen.has(key)) continue
      seen.add(key)
      copyRecipients.push({
        role: 'custom',
        contactId: null,
        name: address,
        email: address,
        phone: null,
        fallbackApplied: false,
      })
    }
    bcc = []
    fingerprintBcc = wantsMcCopy && mcEmail ? [mcEmail] : []
  } else {
    const seen = new Set<string>()
    const ccList = ccCandidates.filter((e) => {
      const key = e.toLowerCase()
      if (direct.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (ccList.length > 0) cc = ccList
    fingerprintBcc = [...new Set([...(input.bccSelf && mcEmail ? [mcEmail] : []), ...typedBcc])]
    // The MC's own address typed as a bcc is their copy, as on a
    // commercial send, not a bcc on the couple's message.
    if (typedBcc.some((e) => e.toLowerCase() === mcAddress)) wantsMcCopy = true
    bcc = [...new Set(typedBcc.filter((e) => e.toLowerCase() !== mcAddress))]
  }

  // Already one of the step's own recipients: they get the message
  // itself, so a second copy would only be a duplicate.
  const mcCopy = wantsMcCopy && mcEmail && !direct.has(mcAddress ?? '') ? mcEmail : null
  const addressable = [...recipients, ...copyRecipients].filter((r) => r.email)
  return { direct, copyRecipients, cc, bcc, mcCopy, fingerprintBcc, addressable }
}

/**
 * The copies one message carries. On a commercial send, none: every cc
 * and bcc address is its own message and the MC's copy is too. On a
 * transactional send, the cc list on every message and the typed bcc on
 * the step's own recipients' messages.
 */
export function copiesFor(plan: RecipientPlan, to: string): { bcc?: string[]; cc?: string[] } {
  return {
    ...(plan.bcc.length && plan.direct.has(to.trim().toLowerCase()) ? { bcc: plan.bcc } : {}),
    ...(plan.cc ? { cc: plan.cc } : {}),
  }
}

/** Why a recipient is left out of a send. */
export type OptOutReason = 'couple_opted_out' | 'suppressed'

/** The opt-out gate's answer for a whole step. */
export type OptOutGate =
  | { status: 'unknown'; message: string }
  | {
      status: 'ok'
      sendable: ResolvedRecipient[]
      skipped: { recipient: ResolvedRecipient; reason: OptOutReason }[]
    }

/**
 * Resolve the opt-out gate for every recipient, before anything is sent.
 *
 * Three outcomes, not two (see `lib/email/suppression`): a blocked
 * address drops out, a clear one stays, and a check that could not be
 * completed comes back `unknown` with the send's own error message, so
 * the send can error the step as recoverable and the envelope can say it
 * could not check.
 *
 * `couples.do_not_email` is the denormalised mirror of the couple's own
 * address in `email_suppression`, so it covers the couple and only the
 * couple ({@link COUPLE_OWN_ROLES}). Resolved once, outside the loop,
 * because it is one flag on one row.
 *
 * Read-only under either client: both checks are selects (the suppression
 * one through the security-invoker `is_email_suppressed` function).
 */
export async function gateOptOuts(
  supabase: SupabaseClient<Database>,
  userId: string,
  coupleId: string,
  addressable: ResolvedRecipient[],
): Promise<OptOutGate> {
  const coupleCheck = await isCoupleOptedOut(supabase, userId, coupleId)
  if (coupleCheck.status === 'unknown') {
    return {
      status: 'unknown',
      message: `send_email: could not check the couple opt-out flag (${coupleCheck.reason})`,
    }
  }
  const coupleOptedOut = coupleCheck.status === 'blocked'

  const sendable: ResolvedRecipient[] = []
  const skipped: { recipient: ResolvedRecipient; reason: OptOutReason }[] = []
  for (const r of addressable) {
    if (coupleOptedOut && COUPLE_OWN_ROLES.has(r.role)) {
      skipped.push({ recipient: r, reason: 'couple_opted_out' })
      continue
    }
    const check = await isEmailSuppressed(supabase, userId, r.email!)
    if (check.status === 'unknown') {
      return {
        status: 'unknown',
        message: `send_email: could not check the suppression list (${check.reason})`,
      }
    }
    if (check.status === 'blocked') {
      skipped.push({ recipient: r, reason: 'suppressed' })
      continue
    }
    sendable.push(r)
  }
  return { status: 'ok', sendable, skipped }
}

/**
 * The Reply-To a send carries: the step's override, else the MC's own
 * address. `''` is the override chip's "added but nothing typed" value
 * and means unset.
 */
export function sendReplyTo(replyToOverride: string | undefined, mcEmail: string): string {
  return replyToOverride || mcEmail
}

/**
 * The files a send attaches: the saved template's own files, then the
 * step's, each once. A file attached both ways sends once.
 */
export function sendAttachmentIds(
  templateFileIds: string[],
  attachFiles: string[] | undefined,
): string[] {
  return [...new Set([...templateFileIds, ...(attachFiles ?? [])])]
}
