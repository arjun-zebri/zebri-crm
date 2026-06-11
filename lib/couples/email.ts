/**
 * Couple email resolution.
 *
 * Since the partner-contact-triples migration
 * (`20260603000000_add_couple_partner_contacts.sql`) the couple modal
 * writes the partner-level `primary_email` and leaves the legacy
 * couple-level `email` column untouched — so couples created through
 * the new flow have an **empty** legacy `email`. Pre-migration rows
 * were backfilled (`primary_email` copied from `email`), but rows
 * edited only through legacy paths may still carry just `email`.
 *
 * Anything that emails a couple must therefore prefer
 * `primary_email` and fall back to the legacy column. Centralised
 * here so the send routes and the automations snapshot can't drift.
 *
 * @module lib/couples/email
 */

/**
 * Resolve the address to email a couple at: the primary partner's
 * email when captured, otherwise the legacy couple-level email.
 * Whitespace-only values are treated as missing.
 *
 * @returns The trimmed address, or `null` when no email is on file.
 */
export function resolveCoupleEmail(
  couple:
    | { primary_email?: string | null; email?: string | null }
    | null
    | undefined,
): string | null {
  const primary = couple?.primary_email?.trim();
  if (primary) return primary;
  const legacy = couple?.email?.trim();
  return legacy || null;
}
