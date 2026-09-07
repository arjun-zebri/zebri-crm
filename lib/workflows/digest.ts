/**
 * The morning digest: what today looks like, before the MC opens the app.
 *
 * Everything the engine does is invisible until somebody logs in, which
 * is the wrong default for a product whose whole promise is "you will not
 * forget anything". One email a day, in the MC's own morning, listing
 * what is overdue, what is due, what needs their OK, and what is about to
 * send by itself.
 *
 * Silence is meaningful: a day with nothing to report sends nothing. An
 * MC who gets "you have 0 things" every morning stops reading the mail
 * within a week, and then misses the day that mattered.
 *
 * @module lib/workflows/digest
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { zonedDateParts } from '@/lib/scheduling/timezone';
import type { Database } from '@/types/database';

import { loadQueue, type QueueItem } from './queue';

/** Fallback when the MC has never saved a timezone. */
const DEFAULT_TIMEZONE = 'Australia/Sydney';

/** The local hour a digest is sent at, in the MC's own zone. */
export const DIGEST_LOCAL_HOUR = 7;

/** One user's digest, ready to render. */
export interface DigestPayload {
  userId: string;
  timezone: string;
  /** Today in the MC's zone, as `YYYY-MM-DD`. */
  localDate: string;
  review: QueueItem[];
  overdue: QueueItem[];
  today: QueueItem[];
  sendingToday: QueueItem[];
}

/** Total number of lines a digest would show. */
export function digestSize(payload: DigestPayload): number {
  return (
    payload.review.length +
    payload.overdue.length +
    payload.today.length +
    payload.sendingToday.length
  );
}

/**
 * Is it the digest hour for this timezone right now?
 *
 * The cron fires hourly and every MC gets their own 7am, so this is the
 * per-user gate. Comparing the local hour rather than converting a fixed
 * UTC time is what makes it correct across daylight saving, where a
 * fixed UTC send would drift an hour twice a year.
 */
export function isDigestHour(now: Date, timezone: string): boolean {
  return localHour(now, timezone) === DIGEST_LOCAL_HOUR;
}

/** The wall-clock hour (0-23) at `utc` in `timezone`. */
export function localHour(utc: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).format(utc);
  // `en-GB` renders midnight as "24" in some ICU builds; normalise it.
  return Number(hour) % 24;
}

/**
 * Build one user's digest, or null when there is nothing worth sending.
 *
 * @param supabase - a service-role client; there is no session in a cron run
 * @param userId - the MC to build for
 */
export async function buildDigest(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DigestPayload | null> {
  const { data: settings } = await supabase
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;

  const queue = await loadQueue(supabase, userId);
  const payload: DigestPayload = {
    userId,
    timezone,
    localDate: zonedDateParts(new Date(), timezone).date,
    review: queue.review,
    overdue: queue.overdue,
    today: queue.today,
    sendingToday: queue.sendingToday,
  };

  return digestSize(payload) === 0 ? null : payload;
}

/**
 * The subject line, which has to earn the open on its own.
 *
 * Leads with the number that matters most: a failure or a pending
 * approval beats a count of ordinary to-dos.
 */
export function digestSubject(payload: DigestPayload): string {
  if (payload.review.length > 0) {
    const n = payload.review.length;
    return `${n} ${n === 1 ? 'message needs' : 'messages need'} your OK today`;
  }
  if (payload.overdue.length > 0) {
    const n = payload.overdue.length;
    return `${n} overdue, plus ${payload.today.length} due today`;
  }
  const n = payload.today.length;
  return n === 1 ? '1 thing due today' : `${n} things due today`;
}
