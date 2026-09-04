/**
 * CORS rules for the public lead-capture API. Pure: no transport, no DB, so
 * the settings action, the submit route and the config route all share one
 * definition of "what is an origin" and "what do we echo".
 *
 * The allowlist is anti-abuse hygiene rather than a security boundary (the
 * form token is public and server-side posts never carry an Origin), so the
 * rules are deliberately simple: exact string match on a browser-normalised
 * origin, same-origin always allowed, no wildcard, no credentials.
 *
 * @module lib/lead-capture/cors
 */

/** Hard cap on saved origins per form. */
export const MAX_ALLOWED_ORIGINS = 20;

/** Result of validating one MC-entered origin. */
export type ParsedOrigin = { ok: true; origin: string } | { ok: false; error: string };

/**
 * Validate one MC-entered allowed origin and normalise it to exactly what a
 * browser sends in the `Origin` header: `scheme://host[:port]`, lowercase
 * host, default port stripped, no path, query, hash or trailing slash.
 */
export function parseAllowedOrigin(raw: string): ParsedOrigin {
  const input = raw.trim();
  if (input === '') return { ok: false, error: 'Enter a domain, e.g. https://www.example.com' };
  if (!/^https?:\/\//i.test(input)) return { ok: false, error: 'Start with https:// or http://' };
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: 'That does not look like a valid domain' };
  }
  if (url.username || url.password) return { ok: false, error: 'Remove the username and password' };
  // `https://example.com/` parses to pathname "/", the same as without the
  // slash, so the trailing-slash case is caught on the raw input.
  if (url.search || url.hash || url.pathname !== '/' || input.endsWith('/')) {
    return { ok: false, error: 'Use just the domain, with no path or trailing slash' };
  }
  return { ok: true, origin: url.origin };
}

/** The request's `Origin` header, or null when the client sent none. */
export function originOf(request: Request): string | null {
  return request.headers.get('origin');
}

/**
 * The host this request was addressed to. Vercel forwards the public host in
 * `x-forwarded-host`; a bare `Request` built in a test has only its URL.
 */
export function requestHostOf(request: Request): string {
  return (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host
  );
}

/**
 * True when the request Origin is the app itself (hosted page, iframe embed,
 * preview deployment). Host-only comparison: every deployment is https.
 */
export function isSameOrigin(origin: string, requestHost: string): boolean {
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

/** Exact match against the form's saved allowlist. */
export function isAllowedOrigin(origin: string, allowlist: readonly string[]): boolean {
  return allowlist.includes(origin);
}

/** Headers that let `origin` (and only `origin`) call the submit endpoint. */
export function corsHeaders(origin: string): Record<string, string> {
  // `isSameOrigin`/`isAllowedOrigin` compare hosts, so a header like
  // "https://evil.com@app.zebri.com.au" (userinfo, host app.zebri.com.au)
  // passes the same-origin check on its host but is not a valid origin
  // string. Echo `new URL(origin).origin` so the value that goes out in
  // access-control-allow-origin is always the normalised scheme://host,
  // never raw attacker-controlled header text.
  let echoed = origin;
  try {
    echoed = new URL(origin).origin;
  } catch {
    // Not a parseable URL: fall back to the raw value unchanged.
  }
  return {
    'access-control-allow-origin': echoed,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'origin',
  };
}

/** Headers for the read-only, credential-free config endpoint. */
export const OPEN_CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '600',
};

/** The http(s) origin of a URL, or null. Used to reduce a referrer to a site. */
export function originOnly(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

/**
 * The allowlist origin implied by an MC's own website field, or null.
 *
 * Deliberately lenient where {@link parseAllowedOrigin} is strict. That one
 * validates something a person typed into the allowlist, so a path or a
 * trailing slash is a mistake worth reporting. This one reads a field the MC
 * filled in for a different purpose (`yoursite.com`, `https://yoursite.com/`,
 * a link with a path), so it takes what it can and reduces it to an origin.
 */
export function originFromWebsite(raw: string | null | undefined): string | null {
  const input = (raw ?? '').trim()
  if (input === '') return null
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`
  try {
    const url = new URL(withScheme)
    // A host with no dot is a typo, not a domain, and would silently widen the
    // allowlist if it ever matched.
    return url.hostname.includes('.') ? url.origin : null
  } catch {
    return null
  }
}

/**
 * An origin plus its www/apex sibling.
 *
 * Browsers send the exact host, and the allowlist matches exactly, so a site
 * served at `https://www.example.com` is refused by an entry of
 * `https://example.com`. An MC who typed one form of their own domain means
 * both, and getting this wrong surfaces only as an opaque CORS error on their
 * live site, so seeding covers the pair.
 */
export function withWwwSibling(origin: string): string[] {
  try {
    const url = new URL(origin)
    const host = url.hostname
    const sibling = host.startsWith('www.') ? host.slice(4) : `www.${host}`
    // Only for a real registrable pair: `www.localhost` is meaningless, and a
    // deeper subdomain (`shop.example.com`) is its own site, not an alias.
    if (host.split('.').length > (host.startsWith('www.') ? 3 : 2)) return [origin]
    const other = new URL(url.toString())
    other.hostname = sibling
    return [origin, other.origin]
  } catch {
    return [origin]
  }
}

/** Display form of a stored origin (`www.site.com`), falling back to the raw value. */
export function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}
