/**
 * Fetch a celebrant's website (home + one contact page) and classify it.
 *
 * Server-only. Every URL here came from a spreadsheet or a scraped page,
 * so the fetcher is an SSRF surface. Each hop (redirects are followed by
 * hand) is resolved once, every answer is checked against
 * {@link isPrivateAddress}, and the connection is pinned to the checked
 * address (see `safe-fetch.ts`), so a DNS flip between check and connect
 * can't reach an internal host. Size and time are capped so one slow site
 * can't eat a tick's budget.
 *
 * @module lib/outreach/checks/website
 */
import { BlockedHostError, DeadDnsError, pinnedGet, resolvePublicTarget } from './safe-fetch';
import { extractSignals, mergeSignals, type PageSignals } from './website-signals';

export { isPrivateAddress } from './private-address';

/** Outcome stored on the prospect as `site_status`. */
export type SiteStatus = 'live' | 'parked' | 'dead_dns' | 'http_error' | 'timeout' | 'blocked' | 'no_site';

/** What one website check produced. */
export interface WebsiteCheckResult {
  status: SiteStatus;
  finalUrl: string | null;
  httpStatus: number | null;
  signals: PageSignals | null;
  error: string | null;
}

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'Mozilla/5.0 (compatible; ZebriBot/1.0; +https://zebri.com.au)';

/** Only HTML and text bodies are read; anything else (images, PDFs, archives) is dropped unread. */
function wantsBody(contentType: string): boolean {
  return /html|text/i.test(contentType) || contentType === '';
}

/** GET with manual, re-validated redirects. Returns the final URL, status and body. */
async function safeGet(start: string, signal: AbortSignal): Promise<{ url: string; status: number; html: string }> {
  let url = new URL(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BlockedHostError('scheme');
    // Re-validated on every hop: a public page can redirect to 169.254.169.254.
    const target = await resolvePublicTarget(url.hostname);
    const res = await pinnedGet(url, target, {
      signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*;q=0.5' },
      maxBytes: MAX_BYTES,
      readBody: wantsBody,
    });
    if (res.location) {
      url = new URL(res.location, url);
      continue;
    }
    return { url: url.toString(), status: res.status, html: res.body };
  }
  throw new Error('too many redirects');
}

/** Check one website. Never throws: every failure is a classified result. */
export async function checkWebsite(website: string | null, now: Date = new Date()): Promise<WebsiteCheckResult> {
  if (!website) return { status: 'no_site', finalUrl: null, httpStatus: null, signals: null, error: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const home = await safeGet(website, controller.signal);
    if (home.status >= 400) {
      return { status: 'http_error', finalUrl: home.url, httpStatus: home.status, signals: null, error: null };
    }
    const homeSignals = extractSignals(home.html, home.url, now);

    // The contact page is best-effort: its failure never fails the check.
    let contactSignals: PageSignals | null = null;
    if (homeSignals.contactPath && !homeSignals.parked) {
      try {
        const contact = await safeGet(homeSignals.contactPath, controller.signal);
        if (contact.status < 400) contactSignals = extractSignals(contact.html, contact.url, now);
      } catch {
        contactSignals = null;
      }
    }
    const signals = mergeSignals(homeSignals, contactSignals);
    return {
      status: signals.parked ? 'parked' : 'live',
      finalUrl: home.url,
      httpStatus: home.status,
      signals,
      error: null,
    };
  } catch (err) {
    if (err instanceof DeadDnsError) {
      return { status: 'dead_dns', finalUrl: null, httpStatus: null, signals: null, error: err.message };
    }
    if (err instanceof BlockedHostError) {
      return { status: 'blocked', finalUrl: null, httpStatus: null, signals: null, error: err.message };
    }
    if (controller.signal.aborted) {
      return { status: 'timeout', finalUrl: null, httpStatus: null, signals: null, error: 'timeout' };
    }
    const message = err instanceof Error ? err.message : String(err);
    // TLS failures and refused connections mean the site is effectively down.
    return { status: 'http_error', finalUrl: null, httpStatus: null, signals: null, error: message.slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}
