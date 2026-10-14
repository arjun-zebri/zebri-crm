/**
 * Read activity signals and contact details out of a celebrant's
 * website HTML.
 *
 * Kept pure (string in, signals out) so the fetcher can stay thin and
 * every heuristic is unit-testable against saved fixtures. The heuristics
 * are deliberately conservative: a false "active" costs an email to a
 * retired celebrant, a false "inactive" only costs a missed lead that the
 * Instagram check or the review queue can still rescue.
 *
 * @module lib/outreach/checks/website-signals
 */
import { normaliseEmail, normaliseFacebook, normaliseInstagram } from '../import/normalise';

/** Everything the scorer and the enrichment step need from one page. */
export interface PageSignals {
  /** The page is a domain-parking / for-sale page, not a real site. */
  parked: boolean;
  /** Highest plausible year mentioned (≤ the current year), or null. */
  latestYear: number | null;
  /** Mentions weddings, ceremonies, celebrancy or elopements. */
  weddingContent: boolean;
  emails: string[];
  instagramHandles: string[];
  facebookUrls: string[];
  /** Same-site link that most looks like a contact/about page. */
  contactPath: string | null;
  /** Visible text length, used to spot empty shells. */
  textLength: number;
}

// Phrases and providers that only appear on parked or for-sale domains.
const PARKED_PATTERNS = [
  /this domain (name )?(is|may be) for sale/i,
  /buy this domain/i,
  /domain (is )?parked/i,
  /parked free/i,
  /hugedomains/i,
  /sedo(parking)?\.com/i,
  /afternic/i,
  /dan\.com/i,
  /godaddy\.com\/domainsearch/i,
  /domain has expired/i,
  /this site can.?t be reached/i,
  /account (has been )?suspended/i,
];

const WEDDING_RE = /\b(wedding|weddings|ceremon(y|ies)|celebrant|elope(ment)?s?|marriage|vows|nuptial)\b/i;

// Emails that are never the celebrant: image names, platform senders,
// and placeholder addresses from site builders.
const EMAIL_NOISE_RE = /(\.(png|jpe?g|gif|svg|webp)$|@(sentry|wixpress|example|domain|email)\.|^(noreply|no-reply|wordpress|user)@)/i;

/** Strip scripts, styles and tags to approximate the visible text. */
export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&copy;|&#169;/g, '©')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every `href` value on the page, entity-decoded. */
function hrefs(html: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]!.replace(/&amp;/g, '&'));
  return out;
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/**
 * Extract {@link PageSignals} from a page. `pageUrl` resolves relative
 * links; `now` pins "the current year" for tests.
 */
export function extractSignals(html: string, pageUrl: string, now: Date = new Date()): PageSignals {
  const text = visibleText(html);
  const currentYear = now.getUTCFullYear();
  const links = hrefs(html);

  const parked =
    PARKED_PATTERNS.some((re) => re.test(html)) ||
    // A "site" with almost no words and no links is a placeholder.
    (text.length < 80 && links.length < 3);

  let latestYear: number | null = null;
  for (const m of text.matchAll(/\b(20[0-3]\d)\b/g)) {
    const y = Number(m[1]);
    if (y <= currentYear && (latestYear === null || y > latestYear)) latestYear = y;
  }

  const emailCandidates = [
    ...links.filter((h) => /^mailto:/i.test(h)).map((h) => decodeURIComponent(h.slice(7).split('?')[0] ?? '')),
    ...(text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []),
  ];
  const emails = uniq(
    emailCandidates
      .map((e) => normaliseEmail(e))
      .filter((e): e is string => !!e && !EMAIL_NOISE_RE.test(e)),
  );

  const instagramHandles = uniq(
    links
      .filter((h) => /instagram\.com\//i.test(h))
      .map((h) => normaliseInstagram(h))
      .filter((h): h is string => !!h),
  );
  const facebookUrls = uniq(
    links
      .filter((h) => /facebook\.com\//i.test(h))
      .map((h) => normaliseFacebook(h))
      .filter((h): h is string => !!h),
  );

  return {
    parked,
    latestYear,
    weddingContent: WEDDING_RE.test(text),
    emails,
    instagramHandles,
    facebookUrls,
    contactPath: findContactPath(links, pageUrl),
    textLength: text.length,
  };
}

/** First same-origin link whose path looks like contact / about / enquire / book. */
export function findContactPath(links: string[], pageUrl: string): string | null {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return null;
  }
  const ranked = ['contact', 'enquir', 'about', 'book'];
  for (const word of ranked) {
    for (const href of links) {
      if (/^(mailto|tel|javascript):/i.test(href) || href.startsWith('#')) continue;
      let url: URL;
      try {
        url = new URL(href, base);
      } catch {
        continue;
      }
      if (url.hostname !== base.hostname) continue;
      if (url.pathname.toLowerCase().includes(word) && url.pathname !== base.pathname) {
        return url.toString();
      }
    }
  }
  return null;
}

/** Combine the home page with the optional contact page into one signal set. */
export function mergeSignals(home: PageSignals, contact: PageSignals | null): PageSignals {
  if (!contact) return home;
  const years = [home.latestYear, contact.latestYear].filter((y): y is number => y !== null);
  return {
    parked: home.parked,
    latestYear: years.length ? Math.max(...years) : null,
    weddingContent: home.weddingContent || contact.weddingContent,
    emails: uniq([...home.emails, ...contact.emails]),
    instagramHandles: uniq([...home.instagramHandles, ...contact.instagramHandles]),
    facebookUrls: uniq([...home.facebookUrls, ...contact.facebookUrls]),
    contactPath: home.contactPath,
    textLength: home.textLength + contact.textLength,
  };
}
