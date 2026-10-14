/**
 * Data retention (Australian Privacy Principle 11.2): stop keeping personal
 * detail about celebrants nobody has contacted for a long time.
 *
 * What is cleared: the Instagram bio, the raw sheet row, message bodies and
 * reply snippets, on prospects with no outreach activity inside the window.
 * What is kept: the prospect row (its email is the suppression key), every
 * suppression entry, and the events and messages that analytics reads.
 *
 * The work is one RPC (`outreach_retention_pass`), so the rule lives in SQL
 * next to the data it clears. This module owns only the window.
 *
 * @module lib/outreach/services/retention
 */
import type { AdminDb } from '../types';

/**
 * How long a prospect may go without outreach activity before its personal
 * detail is cleared. Twelve months, as the retention rule in
 * `.claude/docs/security.md` states.
 */
export const RETENTION_MONTHS = 12;

/**
 * The instant `RETENTION_MONTHS` before `now`. Anything older than this with
 * no activity since is eligible.
 *
 * @param now - The reference time. Defaults to the current time.
 * @returns The cutoff as a Date, in UTC arithmetic.
 */
export function retentionCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);
  return cutoff;
}

/**
 * Clear personal detail from idle prospects. Idempotent: a second run finds
 * nothing new to clear. Call it from the tick at most once a day.
 *
 * @param db - Admin client.
 * @param now - The reference time, for tests.
 * @returns How many prospects were eligible on this run.
 */
export async function runRetentionPass(db: AdminDb, now: Date = new Date()): Promise<number> {
  const { data, error } = await db.rpc('outreach_retention_pass', { p_cutoff: retentionCutoff(now).toISOString() });
  if (error) throw new Error(`retention pass: ${error.message}`);
  return data ?? 0;
}
