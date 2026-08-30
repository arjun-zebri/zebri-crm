/**
 * Couple display-name resolution for documents.
 *
 * The legacy couple-level `name` column is whatever the MC typed when they
 * created the record, which in practice is often one partner's first name
 * ("Arjun"). That is fine as a list label but wrong on a service agreement,
 * where the couple are a named party: the document should say who is bound by
 * it, in full, on both sides.
 *
 * Since `20260603000000_add_couple_partner_contacts.sql` the real names live
 * in `primary_name` / `secondary_name`, so a document composes from those and
 * falls back to the legacy column only when neither is captured.
 *
 * Centralised here, and mirrored in SQL inside `get_public_contract`, so the
 * `{{couple_name}}` variable and the public header cannot drift apart.
 *
 * @module lib/couples/display-name
 */

/** Trim a value to a usable string, or null when blank. */
function clean(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * The couple's name as a document should state it.
 *
 * Both partners when both are known ("Sam Rivera and Alex Rivera"); the one
 * partner on file when only one is; the legacy couple name when neither is.
 *
 * @param couple - The couple's name columns.
 * @returns The composed name, or an empty string when nothing is on file.
 */
export function coupleDisplayName(
  // `| undefined` is explicit, not implied by `?`: under
  // exactOptionalPropertyTypes an optional prop rejects a deliberately-passed
  // undefined, and callers read these straight off nullable query results.
  couple:
    | {
        name?: string | null | undefined
        primary_name?: string | null | undefined
        secondary_name?: string | null | undefined
      }
    | null
    | undefined,
): string {
  const primary = clean(couple?.primary_name)
  const secondary = clean(couple?.secondary_name)

  if (primary && secondary) return `${primary} and ${secondary}`
  return primary ?? secondary ?? clean(couple?.name) ?? ''
}
