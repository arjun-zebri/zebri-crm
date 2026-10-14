/**
 * Render outreach templates with merge fields.
 *
 * Syntax: `{{field}}` or `{{field|fallback}}`. An unknown field is an
 * authoring error; a known field with no value and no fallback makes the
 * message unrenderable for that prospect (the sequencer skips it rather
 * than sending "Hi ,").
 *
 * Every email also gets the Spam Act footer: the sender's signature
 * (identity) and a working opt-out instruction. The footer is appended
 * here, not in templates, so no variant can forget it.
 *
 * Pure.
 *
 * @module lib/outreach/render
 */

/** Merge fields a template may use. */
export const MERGE_FIELDS = [
  'first_name',
  'last_name',
  'full_name',
  'suburb',
  'state',
  'website',
  'instagram_handle',
  'booking_link',
  'sender_name',
] as const;

/** One of {@link MERGE_FIELDS}. */
export type MergeField = (typeof MERGE_FIELDS)[number];

/** Values available for one prospect. */
export type MergeValues = Partial<Record<MergeField, string | null>>;

const TOKEN_RE = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g;

/** Opt-out line appended to every email. */
export const OPT_OUT_LINE = "Not interested? Reply 'stop' and I won't contact you again.";

/** Business name the footer always carries, so every email says who sent it. */
export const BUSINESS_NAME = 'Zebri';

/**
 * True when a signature holds something a recipient can reply to or call:
 * an email address, a phone number or a web address. A signature of just a
 * name doesn't tell the recipient how to reach anyone, so it can't satisfy
 * the Spam Act's sender-identification rule on its own.
 */
export function hasContactDetails(signature: string): boolean {
  return /[^\s@]+@[^\s@]+\.[^\s@]+|\+?\d[\d\s()-]{7,}\d|https?:\/\/\S+/i.test(signature);
}

/** Fields referenced by a template, and any that aren't real merge fields. */
export function templateFields(template: string): { fields: string[]; unknown: string[] } {
  const fields = new Set<string>();
  for (const m of template.matchAll(TOKEN_RE)) fields.add(m[1]!);
  const unknown = [...fields].filter((f) => !(MERGE_FIELDS as readonly string[]).includes(f));
  return { fields: [...fields], unknown };
}

/** Result of rendering one template. */
export type RenderResult = { ok: true; text: string } | { ok: false; missing: string[] };

/** Fill a template; fails listing every field that had no value and no fallback. */
export function renderTemplate(template: string, values: MergeValues): RenderResult {
  const missing: string[] = [];
  const text = template.replace(TOKEN_RE, (_, field: string, fallback: string | undefined) => {
    // Why hasOwn + the known-field list: `{{constructor}}` or `{{__proto__}}`
    // would otherwise read an inherited Object.prototype member and throw on .trim().
    const known = (MERGE_FIELDS as readonly string[]).includes(field) && Object.hasOwn(values, field);
    const v = known ? values[field as MergeField] : undefined;
    if (v != null && v.trim() !== '') return v.trim();
    if (fallback !== undefined) return fallback.trim();
    missing.push(field);
    return '';
  });
  return missing.length ? { ok: false, missing: [...new Set(missing)] } : { ok: true, text };
}

/** Count of http(s) links, for the one-link deliverability warning. */
export function countLinks(text: string): number {
  return (text.match(/https?:\/\/\S+/gi) ?? []).length;
}

/**
 * Append the sender identity, signature and opt-out line to a rendered
 * email body. Every email carries all three, so no variant can drop one.
 *
 * The identity line is "<sender name>, Zebri", or just "Zebri" when no
 * name is set. Sending is blocked without a name and a contact-bearing
 * signature (see `sendBlockReason`), so the bare form never goes out.
 *
 * @param body - The rendered message text.
 * @param signature - The founder's signature, which should hold contact details.
 * @param senderName - The name the email is sent under.
 * @returns The full plain-text body.
 */
export function withEmailFooter(body: string, signature: string, senderName = ''): string {
  const name = senderName.trim();
  const parts = [body.trimEnd(), name ? `${name}, ${BUSINESS_NAME}` : BUSINESS_NAME];
  if (signature.trim()) parts.push(signature.trim());
  parts.push(OPT_OUT_LINE);
  return parts.join('\n\n');
}

/** Merge values for a prospect, given the settings-derived extras. */
export function mergeValuesFor(
  p: {
    first_name: string | null;
    last_name: string | null;
    full_name: string;
    suburb: string | null;
    state: string | null;
    website: string | null;
    instagram_handle: string | null;
    ref_code: string;
  },
  extras: { bookingBaseUrl: string | null; senderName: string },
): MergeValues {
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    full_name: p.full_name,
    suburb: p.suburb,
    state: p.state,
    website: p.website,
    instagram_handle: p.instagram_handle ? `@${p.instagram_handle}` : null,
    booking_link: extras.bookingBaseUrl ? `${extras.bookingBaseUrl}?ref=${p.ref_code}` : null,
    sender_name: extras.senderName || null,
  };
}
