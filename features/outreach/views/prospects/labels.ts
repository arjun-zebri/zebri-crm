/**
 * Plain-English labels and formatters shared by the Today and Prospects
 * views. The database stores snake_case codes; the founder reads words.
 *
 * @module features/outreach/views/prospects/labels
 */
import { LOST_REASONS, STAGES } from '@/lib/outreach/types';

/** Funnel stage labels, in funnel order. */
export const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  demo_booked: 'Demo booked',
  demo_done: 'Demo done',
  signed_up: 'Signed up',
  paying: 'Paying',
  lost: 'Lost',
  opted_out: 'Opted out',
};

/** Lost-reason labels. */
export const LOST_REASON_LABELS: Record<(typeof LOST_REASONS)[number], string> = {
  not_interested: 'Not interested',
  no_longer_celebrant: 'No longer a celebrant',
  has_crm: 'Has a CRM',
  price: 'Price',
  bad_timing: 'Bad timing',
  no_response: 'No response',
  other: 'Other',
};

/** Australian states and territories, as stored on prospects. */
export const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;

/** Verdict labels. */
export const VERDICT_LABELS: Record<string, string> = {
  unchecked: 'Not checked yet',
  active: 'Active',
  inactive: 'Not active',
  needs_review: 'Needs a look',
};

/** Why a verdict was reached, as stored in `verdict_reason`. */
export const REASON_LABELS: Record<string, string> = {
  ig_recent: 'Instagram posted recently',
  site_current: 'Website shows recent weddings',
  check_incomplete: 'Check could not finish',
  no_presence: 'No website or Instagram found',
  site_dead: 'Website is down',
  ig_private: 'Instagram is private',
  stale: 'Nothing recent online',
  manual: 'Set by you',
};

/** Website check outcomes, as stored in `site_status`. */
export const SITE_STATUS_LABELS: Record<string, string> = {
  live: 'Live',
  parked: 'Parked domain',
  no_site: 'No website',
  dead_dns: 'Site not found',
  http_error: 'Site error',
  blocked: 'Blocked',
  timeout: 'Timed out',
};

/** Email check results that mean the address will not get mail. */
export const BAD_EMAIL_CHECKS = ['bounced', 'no_mx', 'invalid_syntax', 'disposable'] as const;

/** Email check results, in words. */
export const EMAIL_CHECK_LABELS: Record<string, string> = {
  ok: 'Looks deliverable',
  bounced: 'Bounced',
  no_mx: 'Domain cannot get mail',
  invalid_syntax: 'Invalid format',
  disposable: 'Disposable address',
};

/** Channel labels. */
export const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  email: 'Email',
  other: 'Other',
};

/** Instagram lookup outcomes, as stored in `ig_status`. */
export const IG_STATUS_LABELS: Record<string, string> = {
  ok: 'Public account',
  private: 'Private account',
  not_found: 'Account not found',
  error: 'Lookup failed',
};

/** Label for a stored stage code, or the raw code when unknown. */
export function stageLabel(stage: string): string {
  return (STAGE_LABELS as Record<string, string>)[stage] ?? humanize(stage);
}

/** Turn a snake_case code into a sentence-case fallback label. */
export function humanize(code: string): string {
  const spaced = code.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const SYDNEY = 'Australia/Sydney';

/** A date in Sydney time, e.g. "9 Oct 2026". */
export function formatSydneyDate(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', { timeZone: SYDNEY, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

/** A time in Sydney time, e.g. "9:30 am". */
export function formatSydneyTime(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', { timeZone: SYDNEY, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

/** Date and time in Sydney time, e.g. "9 Oct, 9:30 am". */
export function formatSydneyDateTime(iso: string): string {
  return `${new Intl.DateTimeFormat('en-AU', { timeZone: SYDNEY, day: 'numeric', month: 'short' }).format(new Date(iso))}, ${formatSydneyTime(iso)}`;
}

/**
 * Relative time ("3 hours ago", "in 2 days"), falling back to a plain
 * Sydney date after a month. `now` is injectable so tests stay stable.
 */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const diff = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' });
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 30 * 86_400) return rtf.format(Math.round(diff / 86_400), 'day');
  return formatSydneyDate(iso);
}

/** Read a string field off an event or message payload, if present. */
export function payloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}
