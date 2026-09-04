/**
 * Turning audit rows into sentences a person can read.
 *
 * The certificate is evidence, so it has to be legible to someone who has never
 * used Zebri: a venue manager, a solicitor, a tribunal. That means full
 * sentences rather than event codes.
 *
 * Pure and React-free so the wording can be tested directly.
 *
 * @module lib/contracts/audit-trail
 */

/** One audit event as `get_public_contract` returns it. */
export interface AuditTrailEvent {
  event_type: string
  actor: string
  event_at: string
  signer_name_typed?: string | null
  decline_reason?: string | null
  reminder_number?: number | null
  /** Network prefix, never a full address. See the certificate migration. */
  actor_ip_prefix?: string | null
  actor_user_agent?: string | null
}

/**
 * A sentence describing one event.
 *
 * Unknown event types degrade to a readable fallback rather than throwing: a
 * certificate that fails to render because a newer event type reached an older
 * client is far worse than one that says "Contract event".
 *
 * @param event - The audit row.
 * @param vendorRole - The supplier's trade noun ("celebrant", "MC").
 */
export function describeEvent(event: AuditTrailEvent, vendorRole: string): string {
  const who = event.signer_name_typed?.trim()

  switch (event.event_type) {
    case 'sent':
      return `Contract sent by the ${vendorRole}`
    case 'viewed':
      return who ? `Opened by ${who}` : 'Contract opened'
    case 'signed':
      return who ? `Signed by ${who}` : 'Signed'
    case 'identity_verified':
      return who ? `${who} verified their email address` : 'Signer verified their email address'
    case 'declined':
      return event.decline_reason?.trim()
        ? `Declined: "${event.decline_reason.trim()}"`
        : 'Declined'
    case 'invite_sent':
      return who ? `Signing invitation sent to ${who}` : 'Signing invitation sent'
    case 'reminder_sent':
      return event.reminder_number
        ? `Reminder ${String(event.reminder_number)} sent`
        : 'Reminder sent'
    case 'expired':
      return 'Contract expired'
    case 'revoked':
      return `Contract withdrawn by the ${vendorRole}`
    default:
      return 'Contract event'
  }
}

/**
 * Format a document hash for print: six groups of eight hex characters.
 *
 * An unbroken 64-character string is unreadable and impossible to compare by
 * eye, which is the only way most people will ever use it.
 */
export function formatFingerprint(hash: string): string {
  return (hash.match(/.{1,8}/g) ?? []).join(' ')
}
