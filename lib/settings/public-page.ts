/**
 * Pure helpers for the Public Page settings (subdomain + custom email
 * sending domain). No React, no I/O — so they can be shared by the
 * server actions, the email send path, and unit tests without dragging
 * in framework dependencies.
 *
 * @module lib/settings/public-page
 */

/**
 * Subdomains we never let an MC claim: infra/marketing hostnames and
 * anything that could impersonate a Zebri system surface. Checked after
 * {@link normalizeSubdomain}, so all entries are already slug-shaped.
 */
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'admin', 'api', 'mail', 'smtp', 'ftp',
  'no-reply', 'noreply', 'portal', 'support', 'help', 'status',
  'blog', 'dashboard', 'staging', 'dev', 'test', 'zebri',
]);

/**
 * Slugify a free-text name into a valid subdomain candidate: lowercase,
 * hyphen-separated, alphanumerics plus hyphens only, no leading,
 * trailing, or doubled hyphens. Mirrors the original client-side
 * `slugify` so seeded values and persisted values agree.
 */
export function normalizeSubdomain(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * True when `value` is a syntactically valid, non-reserved subdomain.
 * Expects an already-normalised slug (1–63 chars, DNS-label shape).
 */
export function isValidSubdomain(value: string): boolean {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)) return false;
  return !RESERVED_SUBDOMAINS.has(value);
}

/**
 * Compose an email `from` header from a display name and an address. The
 * display name is quoted and stripped of characters that could break or
 * inject into the header (quotes, backslashes, CR/LF); when empty we fall
 * back to the bare address.
 */
export function composeFromHeader(displayName: string, email: string): string {
  const name = displayName.replace(/[\r\n"\\]+/g, ' ').trim();
  return name ? `"${name}" <${email}>` : email;
}
