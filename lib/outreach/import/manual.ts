/**
 * Turn a hand-entered prospect into the same shape a sheet row becomes,
 * using the same normalisers, so a person added by hand is checked,
 * enrolled and de-duplicated exactly like an imported one.
 *
 * Pure.
 *
 * @module lib/outreach/import/manual
 */
import { clean, dedupeKey, normaliseEmail, normaliseInstagram, normaliseState, normaliseWebsite, parseName } from './normalise';
import type { ProspectInput } from './sheet';

/** What the "Add prospect" form collects. Only the name is required. */
export interface ManualProspectInput {
  full_name: string;
  state?: string | null | undefined;
  suburb?: string | null | undefined;
  email?: string | null | undefined;
  instagram?: string | null | undefined;
  website?: string | null | undefined;
  phone?: string | null | undefined;
  notes?: string | null | undefined;
}

/** A field the form filled in but that is not a usable value. */
export type ManualFieldError = 'full_name' | 'email' | 'instagram' | 'website';

/** Output of {@link buildManualProspect}: the prospect, or the fields to fix. */
export type ManualBuildResult =
  | { ok: true; prospect: ProspectInput }
  | { ok: false; errors: Partial<Record<ManualFieldError, string>> };

/**
 * Normalise a hand-entered prospect. A field typed in but unusable (an
 * email with no domain, a link that is not an Instagram profile) is an
 * error rather than silently dropped: the founder typed it on purpose.
 */
export function buildManualProspect(input: ManualProspectInput): ManualBuildResult {
  const fullName = clean(input.full_name);
  const suburb = clean(input.suburb);
  const email = normaliseEmail(input.email);
  const instagram = normaliseInstagram(input.instagram);
  const website = normaliseWebsite(input.website);

  const errors: Partial<Record<ManualFieldError, string>> = {};
  if (!fullName) errors.full_name = 'Enter their name.';
  if (clean(input.email) && !email) errors.email = 'That email address does not look right.';
  if (clean(input.instagram) && !instagram) errors.instagram = 'Enter an Instagram handle or profile link.';
  if (clean(input.website) && !website) errors.website = 'Enter a website address, not a social link.';
  if (!fullName || Object.keys(errors).length > 0) return { ok: false, errors };

  const { first, last } = parseName(fullName);
  return {
    ok: true,
    prospect: {
      registration_no: null,
      full_name: fullName,
      first_name: first,
      last_name: last,
      state: normaliseState(input.state),
      suburb,
      postcode: null,
      email,
      phone: clean(input.phone),
      website,
      instagram_handle: instagram,
      facebook_url: null,
      sheet_notes: null,
      sheet_status: null,
      sheet_raw: {},
      dedupe_key: dedupeKey(fullName, suburb),
    },
  };
}
