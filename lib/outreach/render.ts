/**
 * Render outreach templates with merge fields.
 *
 * Syntax: `{{field}}` or `{{field|fallback}}`. An unknown field is an
 * authoring error; a known field with no value and no fallback makes the
 * message unrenderable for that prospect (the sequencer skips it rather
 * than sending "Hi ,").
 *
 * Every email also gets the Spam Act footer: the sender's signature
 * (identity) and a working opt-out instruction. The footer is added at
 * send time by these helpers, not in templates, so no variant can forget
 * it and a queued email always carries the current signature.
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
 * The "<sender name>, Zebri" line that says who sent the email, or null
 * when the signature already says it.
 *
 * Why it can drop: a signature that names the sender and Zebri (a
 * zebri.com.au address counts) identifies them as well as this line does,
 * and printing both put the founder's name twice in a row. A signature
 * missing either keeps the line, so every email still names its sender.
 *
 * @param senderName - The name the email is sent under.
 * @param signature - The plain-text signature.
 */
export function identityLine(senderName: string, signature: string): string | null {
  const name = senderName.trim();
  // Whole words only, so a short name like "Al" is not found inside "Australia".
  const names = name && new RegExp(`(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'iu').test(signature);
  if (names && signature.toLowerCase().includes(BUSINESS_NAME.toLowerCase())) return null;
  return name ? `${name}, ${BUSINESS_NAME}` : BUSINESS_NAME;
}

/**
 * Append the sender identity, signature and opt-out line to a rendered
 * email body. The opt-out line is always there, and the sender is always
 * named: by the identity line, or by a signature that already names them
 * (see {@link identityLine}).
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
  const identity = identityLine(senderName, signature);
  const parts = [body.trimEnd()];
  if (identity) parts.push(identity);
  if (signature.trim()) parts.push(signature.trim());
  parts.push(OPT_OUT_LINE);
  return parts.join('\n\n');
}

/** Escape text for HTML element content and attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const URL_RE = /https?:\/\/[^\s<>"']+/g;

/** One line of text as HTML, with http(s) URLs made clickable. Trailing punctuation stays outside the link. */
function lineToHtml(line: string): string {
  let out = '';
  let last = 0;
  for (const m of line.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:!?)]+$/, '');
    const start = m.index ?? 0;
    out += escapeHtml(line.slice(last, start)) + `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
    last = start + url.length;
  }
  return out + escapeHtml(line.slice(last));
}

/**
 * Plain text as HTML the way Gmail composes it: one `<div>` per line and
 * `<div><br></div>` for a blank one. Why this shape: it renders like a
 * message typed in Gmail, not like a newsletter template.
 */
export function textToHtml(text: string): string {
  return text.replace(/\r\n/g, '\n').trimEnd().split('\n')
    .map((line) => (line.trim() === '' ? '<div><br></div>' : `<div>${lineToHtml(line)}</div>`))
    .join('');
}

/**
 * Signature HTML with each paragraph as a Gmail-style `<div>` line.
 *
 * Why: the editor keeps signature lines tight with its own stylesheet, but
 * an email has none, so Gmail gives every `<p>` a full line of space above
 * and below and the signature reads double-spaced. A `<div>` has no
 * margin, and an empty paragraph (a blank line in the editor) becomes
 * `<div><br></div>`, the way Gmail writes one. The input is already
 * sanitised, so its `<p>` tags are well formed.
 */
export function signatureLinesHtml(html: string): string {
  return html
    .replace(/<p(\s[^>]*)?>/g, '<div$1>')
    .replace(/<\/p>/g, '</div>')
    .replace(/<div(\s[^>]*)?><\/div>/g, '<div$1><br></div>');
}

/**
 * The HTML part of an email: the body, the identity line, the rendered
 * signature and the opt-out line, in the same order as
 * {@link withEmailFooter} so the two parts say the same thing.
 *
 * @param body - The rendered message text, without a footer.
 * @param signatureHtml - Sanitised signature HTML, or `''` when there is none.
 * @param senderName - The name the email is sent under.
 * @param signatureText - The signature's plain-text copy, which decides the identity line.
 */
export function withEmailFooterHtml(body: string, signatureHtml: string, senderName = '', signatureText = ''): string {
  const identity = identityLine(senderName, signatureText);
  const blank = '<div><br></div>';
  const parts = [textToHtml(body)];
  if (identity) parts.push(blank, `<div>${escapeHtml(identity)}</div>`);
  if (signatureHtml) parts.push(blank, signatureLinesHtml(signatureHtml));
  parts.push(blank, `<div>${escapeHtml(OPT_OUT_LINE)}</div>`);
  return `<div dir="ltr">${parts.join('')}</div>`;
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
