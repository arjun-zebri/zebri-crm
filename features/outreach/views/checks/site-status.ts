/**
 * Plain-language website results for the Checks view, and the guard that
 * decides whether a stored website can be shown as a link.
 *
 * @module features/outreach/views/checks/site-status
 */
import type { SiteStatus } from '@/lib/outreach/checks/website';

/** What each stored website outcome means to the founder. */
export const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  live: 'Site is live',
  parked: 'Parked domain, no real site',
  dead_dns: "Domain doesn't exist",
  http_error: 'Site returned an error',
  timeout: "Site didn't respond in time",
  blocked: 'Site blocked the check',
  no_site: 'No website found',
};

/**
 * Label for a stored `site_status`. `null` means the website was never checked.
 * Unknown values fall back to the raw string rather than hiding information.
 */
export function siteStatusLabel(status: string | null): string {
  if (status === null) return 'Not checked';
  return (SITE_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

/**
 * The website as an `href`, only when it parses as an absolute http(s)
 * URL. Imported text can be anything ("see our page", "www.example" with
 * no scheme); linking those would produce a broken or unsafe href, so
 * they stay plain text.
 *
 * @returns The original string when it is a valid http(s) URL, else `null`.
 */
export function httpUrlOrNull(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
