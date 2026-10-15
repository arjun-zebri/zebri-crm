/**
 * Free email deliverability check: syntax, disposable domain, and
 * whether the domain still accepts mail (MX, falling back to A).
 *
 * This replaces a paid verifier (founder ruling 2026-10-11, cost). It
 * catches the bulk of dead celebrant addresses, which sit on expired
 * personal domains. Mailboxes that are gone from a live domain slip
 * through; the bounce auto-pause in the sender is the backstop for those.
 *
 * Server-only (uses `node:dns`). The resolver is injectable for tests.
 *
 * @module lib/outreach/checks/email-check
 */
import { Resolver } from 'node:dns/promises';

import { isEmailSyntaxValid } from '../import/normalise';

/** Stored as `outreach_prospects.email_check`. */
export type EmailCheckResult = 'ok' | 'invalid_syntax' | 'no_mx' | 'disposable';

/** DNS lookups the check needs; swapped for a stub in tests. */
export interface DnsResolver {
  mx(domain: string): Promise<{ exchange: string }[]>;
  a(domain: string): Promise<string[]>;
}

/**
 * Per-try timeout and tries for each lookup. Why bounded: Node's defaults
 * retry an unresponsive nameserver for about 24 seconds, and that wait ran
 * inside the shared automations tick (prod, 2026-10-15). These settings
 * give up in about 4 seconds while still surviving one lost packet; the
 * failure is a timeout, not a verdict.
 */
export const DNS_TIMEOUT_MS = 1_500;
export const DNS_TRIES = 2;

const bounded = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: DNS_TRIES });
const nodeResolver: DnsResolver = {
  mx: (domain) => bounded.resolveMx(domain),
  a: (domain) => bounded.resolve4(domain),
};

/** True when a DNS error is a lookup that ran out of time. */
export function isDnsTimeout(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ETIMEOUT';
}

// The disposable providers worth naming; a celebrant's business address
// is never on one, so any hit means junk data.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com',
  'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mailnesia.com', 'mintemail.com',
]);

const NOT_FOUND_CODES = new Set(['ENOTFOUND', 'ENODATA', 'ESERVFAIL', 'NXDOMAIN']);

/** True when a DNS error means "no such record" rather than a transient failure. */
function isNotFound(err: unknown): boolean {
  return NOT_FOUND_CODES.has((err as NodeJS.ErrnoException)?.code ?? '');
}

/**
 * Check one address. Transient DNS failures throw (so the caller retries
 * later) rather than being recorded as `no_mx`, which would wrongly bar
 * a real celebrant forever.
 */
export async function checkEmail(email: string, dns: DnsResolver = nodeResolver): Promise<EmailCheckResult> {
  if (!isEmailSyntaxValid(email)) return 'invalid_syntax';
  const domain = email.split('@')[1]!.toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) return 'disposable';

  try {
    const mx = await dns.mx(domain);
    // RFC 7505 "null MX" (a single "." exchange) means the domain accepts no mail.
    if (mx.length > 0 && !(mx.length === 1 && (mx[0]!.exchange === '' || mx[0]!.exchange === '.'))) {
      return 'ok';
    }
    if (mx.length > 0) return 'no_mx';
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }

  // No MX: SMTP falls back to the domain's A record (RFC 5321 §5.1).
  try {
    const a = await dns.a(domain);
    return a.length > 0 ? 'ok' : 'no_mx';
  } catch (err) {
    if (isNotFound(err)) return 'no_mx';
    throw err;
  }
}
