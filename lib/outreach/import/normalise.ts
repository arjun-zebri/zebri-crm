/**
 * Normalisers for celebrant data coming out of the founder's sheet.
 *
 * The Commonwealth register export is messy: names carry titles,
 * websites come with or without a scheme, Instagram columns hold full
 * URLs, `@handles` or bare handles, and states appear as full names or
 * abbreviations. Everything funnels through here so matching, dedupe and
 * rendering all see one canonical form.
 *
 * Pure functions, no I/O.
 *
 * @module lib/outreach/import/normalise
 */

/** Australian states and territories, as stored. */
export const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;

/** One of {@link AU_STATES}. */
export type AuState = (typeof AU_STATES)[number];

const STATE_ALIASES: Record<string, AuState> = {
  'new south wales': 'NSW',
  victoria: 'VIC',
  queensland: 'QLD',
  'western australia': 'WA',
  'south australia': 'SA',
  tasmania: 'TAS',
  'australian capital territory': 'ACT',
  'northern territory': 'NT',
};

/** IANA zone per state, used to place sends inside the recipient's business hours. */
export const STATE_TIMEZONES: Record<AuState, string> = {
  NSW: 'Australia/Sydney',
  VIC: 'Australia/Melbourne',
  QLD: 'Australia/Brisbane',
  WA: 'Australia/Perth',
  SA: 'Australia/Adelaide',
  TAS: 'Australia/Hobart',
  ACT: 'Australia/Sydney',
  NT: 'Australia/Darwin',
};

/** Timezone for a stored state, falling back to Sydney when unknown. */
export function timezoneForState(state: string | null | undefined): string {
  const s = normaliseState(state);
  return s ? STATE_TIMEZONES[s] : 'Australia/Sydney';
}

/** Collapse whitespace and trim; empty becomes `null`. */
export function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = value.replace(/\s+/g, ' ').trim();
  return v === '' ? null : v;
}

/** Map a free-text state ("Victoria", "vic", "VIC ") to its abbreviation. */
export function normaliseState(value: string | null | undefined): AuState | null {
  const v = clean(value);
  if (!v) return null;
  const upper = v.toUpperCase();
  if ((AU_STATES as readonly string[]).includes(upper)) return upper as AuState;
  return STATE_ALIASES[v.toLowerCase()] ?? null;
}

// Honorifics the register prefixes names with. Stripped only from the
// parsed first/last name; full_name keeps whatever the sheet said.
const TITLES = new Set([
  'mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'rev', 'revd', 'reverend', 'prof', 'pastor', 'fr', 'sr',
]);

/** Split a register name into first/last, dropping leading titles. */
export function parseName(full: string): { first: string | null; last: string | null } {
  const parts = (clean(full) ?? '').split(' ').filter(Boolean);
  while (parts.length > 1 && TITLES.has(parts[0]!.toLowerCase().replace(/\.$/, ''))) {
    parts.shift();
  }
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: titleCase(parts[0]!), last: null };
  return { first: titleCase(parts[0]!), last: titleCase(parts.slice(1).join(' ')) };
}

/**
 * Title-case a name only when it was typed all upper or all lower case,
 * so "JANE" becomes "Jane" but "McDonald" and "de Silva" are left alone.
 */
function titleCase(s: string): string {
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

/** Lower-cased email when it looks valid, else `null`. Strips `mailto:`. */
export function normaliseEmail(value: string | null | undefined): string | null {
  const v = clean(value)?.replace(/^mailto:/i, '').toLowerCase() ?? null;
  return v && EMAIL_RE.test(v) ? v : null;
}

/** True when `value` passes the same syntax check as {@link normaliseEmail}. */
export function isEmailSyntaxValid(value: string): boolean {
  return EMAIL_RE.test(value);
}

/**
 * Canonical website URL: https by default, host lower-cased, trailing
 * slash and common tracking params removed. Social links are rejected
 * (they belong in their own columns). Returns `null` for junk.
 */
export function normaliseWebsite(value: string | null | undefined): string | null {
  const v = clean(value);
  if (!v || /\s/.test(v)) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (!url.hostname.includes('.')) return null;
  if (/(^|\.)(instagram|facebook|fb|linktr)\.(com|ee|me)$/i.test(url.hostname)) return null;
  for (const p of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid)/i.test(p)) url.searchParams.delete(p);
  }
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  return url.toString().replace(/\/$/, '');
}

// Paths on instagram.com that are not profiles.
const IG_RESERVED = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'tv', 'direct', 'about']);
const IG_HANDLE_RE = /^[a-z0-9._]{1,30}$/;

/** Bare lower-cased IG handle from a URL, `@handle` or handle; `null` if not a profile. */
export function normaliseInstagram(value: string | null | undefined): string | null {
  const v = clean(value);
  if (!v) return null;
  let handle = v;
  const m = v.match(/instagram\.com\/([^/?#\s]+)/i);
  if (m) handle = m[1]!;
  handle = handle.replace(/^@/, '').toLowerCase();
  if (IG_RESERVED.has(handle) || !IG_HANDLE_RE.test(handle)) return null;
  return handle;
}

/** Canonical Facebook page URL, or `null` when it is not a facebook.com link. */
export function normaliseFacebook(value: string | null | undefined): string | null {
  const v = clean(value);
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!/(^|\.)facebook\.com$/i.test(url.hostname)) return null;
    if (url.pathname === '/' || /^\/(sharer|tr|plugins|dialog)/.test(url.pathname)) return null;
    return `https://www.facebook.com${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
}

/**
 * Natural key for rows without a registration number. Two rows with the
 * same name in the same suburb are treated as the same celebrant.
 */
export function dedupeKey(fullName: string, suburb: string | null): string {
  const n = (clean(fullName) ?? '').toLowerCase();
  const s = (clean(suburb) ?? '').toLowerCase();
  return `${n}|${s}`;
}
