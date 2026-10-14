/**
 * The outreach passes, run from the shared automations tick.
 *
 * Founder ruling (2026-10-11): no new cron schedule. Outreach rides the
 * existing tick on its own time slice (it never sees more than
 * {@link OUTREACH_BUDGET_MS}) and every pass is isolated, so an outreach
 * failure can neither starve nor break the workflow engine.
 *
 * The tick cadence is not fixed: production runs it every minute, and the
 * cron migration schedules it every fifteen. Nothing here counts ticks or
 * assumes a minute of the hour. Each pass decides from its own timestamp:
 * - poll: self-throttled to every {@link POLL_INTERVAL_MS} (poll.ts)
 * - send, checks, repair: every tick; each claims a small batch, so a
 *   fifteen-minute tick just sends its batch less often
 * - attribution and enrol: every {@link SLOW_PASS_INTERVAL_MS}, tracked in
 *   outreach_settings, so they run about every five minutes at either cadence
 *
 * @module lib/outreach/services/tick
 */
import { sendAlert } from '@/lib/alerts/send-alert';
import type { Database } from '@/types/database';

import { CAP_TIMEZONE, localParts } from '../sequencer/schedule';
import type { AdminDb } from '../types';

import { runAttribution } from './attribution';
import { processCheckBatch } from './checks';
import { pollMailbox } from './poll';
import { runRetentionPass } from './retention';
import { sendDueEmails } from './send';
import { enrolDue } from './sequencer';
import { repairStrandedEnrolments } from './sequencer-repair';

/** Outreach's slice of the tick. */
export const OUTREACH_BUDGET_MS = 12_000;
/** Attribution and enrolment run at most this often, whatever the cadence. */
export const SLOW_PASS_INTERVAL_MS = 5 * 60_000;
/** Sydney hour the retention pass runs in. */
const RETENTION_HOUR = 3;
/** Ticks fire a few seconds early or late; this slack keeps one from being skipped. */
const DUE_SLACK_MS = 30_000;

/** Per-pass outcome for the tick's response body. */
export interface OutreachTickResult {
  ran: string[];
  failed: string[];
  skipped: string[];
}

type SettingsPatch = Database['public']['Tables']['outreach_settings']['Update'];

/**
 * True when a slow pass last ran long enough ago. Judged from the stored
 * time, not from the minute of the hour, so it holds at any tick cadence.
 */
export function isSlowPassDue(last: string | null | undefined, nowMs: number): boolean {
  if (!last) return true;
  return nowMs - Date.parse(last) >= SLOW_PASS_INTERVAL_MS - DUE_SLACK_MS;
}

/** Record that a slow pass ran. */
async function stamp(db: AdminDb, patch: SettingsPatch): Promise<void> {
  const { error } = await db.from('outreach_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', true);
  if (error) throw new Error(`stamp pass: ${error.message}`);
}

/** Run the outreach passes until `deadline` (epoch ms). Never throws. */
export async function runOutreachTick(db: AdminDb, deadline: number, now: Date = new Date()): Promise<OutreachTickResult> {
  const result: OutreachTickResult = { ran: [], failed: [], skipped: [] };
  const end = Math.min(deadline, Date.now() + OUTREACH_BUDGET_MS);
  const nowIso = now.toISOString();

  const pass = async (name: string, fn: () => Promise<unknown>) => {
    if (Date.now() > end) {
      result.skipped.push(name);
      return;
    }
    try {
      await fn();
      result.ran.push(name);
    } catch (err) {
      result.failed.push(name);
      void sendAlert({
        type: 'app_error',
        severity: 'error',
        source: `outreach.${name}`,
        message: err instanceof Error ? err.message.slice(0, 500) : String(err),
      });
    }
  };

  const { data: stamps, error: stampErr } = await db
    .from('outreach_settings')
    .select('last_attribution_at, last_enrol_at')
    .eq('id', true)
    .maybeSingle();
  if (stampErr) {
    result.failed.push('stamps');
    void sendAlert({ type: 'app_error', severity: 'error', source: 'outreach.stamps', message: stampErr.message.slice(0, 500) });
  }
  const slowAt = now.getTime();
  // Each slow pass stamps itself even when it throws, so a broken pass runs
  // at its normal cadence instead of on every tick.
  const slow = async (name: 'attribution' | 'enrol', column: 'last_attribution_at' | 'last_enrol_at', fn: () => Promise<unknown>) => {
    const last = stamps?.[column];
    if (!isSlowPassDue(last, slowAt)) return;
    await pass(name, async () => {
      try {
        await fn();
      } finally {
        await stamp(db, { [column]: nowIso });
      }
    });
  };

  // Replies first: a reply that arrived must stop a follow-up due this tick.
  await pass('poll', () => pollMailbox(db, end));
  await slow('attribution', 'last_attribution_at', () => runAttribution(db));
  await pass('send', () => sendDueEmails(db, end));
  await slow('enrol', 'last_enrol_at', () => enrolDue(db, end));
  await pass('repair', () => repairStrandedEnrolments(db));
  await pass('checks', () => processCheckBatch(db, end));
  // Retention runs once a day, in the Sydney 3am hour. It is idempotent, so
  // the handful of ticks that land in that hour are harmless; a tick cadence
  // of one or fifteen minutes always lands inside it. An outage spanning 3am
  // skips that night, and the next run catches up because it is cutoff-based.
  if (localParts(now, CAP_TIMEZONE).hour === RETENTION_HOUR) {
    await pass('retention', () => runRetentionPass(db, now));
  }
  return result;
}
