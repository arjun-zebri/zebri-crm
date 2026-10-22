/**
 * Send due outreach emails through the founder's Gmail.
 *
 * Each pass first settles 'sending' rows left behind by an interrupted
 * pass (see send-recovery), then claims up to {@link PER_TICK} due
 * messages. The daily cap is re-checked here, and every claimed message is
 * re-checked at send time (see send-message).
 *
 * The per-tick limit is a count, not a schedule: it spreads sends out the
 * same at a one-minute or a fifteen-minute tick cadence.
 *
 * @module lib/outreach/services/send
 */
import { sendAlert } from '@/lib/alerts/send-alert';

import { GmailClient, GmailError } from '../gmail/client';
import { CAP_TIMEZONE, localDateKey, localParts, rampCap, zonedTimeToUtc } from '../sequencer/schedule';
import type { AdminDb, OutreachMessage } from '../types';

import { release, sendClaimed, type SendContext, type SendResult } from './send-message';
import { recoverStaleSends, STALE_SEND_MS } from './send-recovery';
import { loadScheduleContext, type ScheduleContext } from './sequencer';
import { loadSettings, mailboxAccess, pauseSending } from './settings';

/** Most emails one pass claims. */
const PER_TICK = 3;

export type { SendResult } from './send-message';

async function sentToday(db: AdminDb): Promise<number> {
  const p = localParts(new Date(), CAP_TIMEZONE);
  const start = zonedTimeToUtc(p.year, p.month, p.day, 0, 0, CAP_TIMEZONE).toISOString();
  const count = async (status: 'sent' | 'sending', column: 'sent_at' | 'claimed_at') => {
    const { count: c, error } = await db
      .from('outreach_messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel', 'email')
      .eq('status', status)
      .gte(column, start);
    if (error) throw new Error(`sent today: ${error.message}`);
    return c ?? 0;
  };
  // Why in-flight sends count too: a 'sending' row may already be in the
  // recipient's inbox (the reaper decides later), so leaving it out would
  // let a tick overshoot the warm-up cap while earlier sends are unresolved.
  const [sent, inFlight] = await Promise.all([count('sent', 'sent_at'), count('sending', 'claimed_at')]);
  return sent + inFlight;
}

/** Due and stale counts, both cheap head queries. */
async function countWork(db: AdminDb): Promise<{ due: number; stale: number }> {
  const cutoff = new Date(Date.now() - STALE_SEND_MS).toISOString();
  const [due, stale] = await Promise.all([
    db.from('outreach_messages').select('id', { count: 'exact', head: true })
      .eq('channel', 'email').eq('status', 'scheduled').lte('scheduled_for', new Date().toISOString()),
    db.from('outreach_messages').select('id', { count: 'exact', head: true })
      .eq('channel', 'email').eq('status', 'sending')
      .or(`claimed_at.lt.${cutoff},claimed_at.is.null`),
  ]);
  if (due.error) throw new Error(`due emails: ${due.error.message}`);
  if (stale.error) throw new Error(`stale emails: ${stale.error.message}`);
  return { due: due.count ?? 0, stale: stale.count ?? 0 };
}

/** Send what's due, up to the cap. */
export async function sendDueEmails(db: AdminDb, deadline: number): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, skipped: 0, deferred: 0 };
  const settings = await loadSettings(db);
  if (settings.sending_paused) return result;

  const { due, stale } = await countWork(db);
  if (due === 0 && stale === 0) return result;

  const mailbox = await mailboxAccess(db).catch(async (err: unknown) => {
    if (err instanceof GmailError && err.permanent) {
      await pauseSending(db, 'Gmail disconnected: reconnect the mailbox in Outreach settings.');
      await db.from('outreach_mailbox').update({ last_error: err.message }).eq('id', true);
      await sendAlert({ type: 'outreach_paused', severity: 'error', reason: `mailbox token rejected: ${err.message}` });
      return null;
    }
    throw err;
  });
  if (!mailbox) return result;
  const gmail = new GmailClient(mailbox.accessToken);

  // Recovery runs even when the cap is full: it only settles what Gmail
  // already accepted, and it must not wait for headroom.
  if (stale > 0) {
    try {
      await recoverStaleSends(db, gmail);
    } catch (err) {
      void sendAlert({
        type: 'app_error', severity: 'error', source: 'outreach.reaper',
        message: err instanceof Error ? err.message.slice(0, 500) : String(err),
      });
    }
  }
  if (due === 0) return result;

  const todayKey = localDateKey(new Date(), CAP_TIMEZONE);
  const cap = rampCap(todayKey, settings.ramp_started_on, settings.email_ramp, settings.email_daily_cap);
  const headroom = Math.min(PER_TICK, cap - (await sentToday(db)));
  if (headroom <= 0) return result;

  const { data: claimed, error } = await db.rpc('outreach_claim_due_emails', { p_limit: headroom });
  if (error) throw new Error(`claim emails: ${error.message}`);

  let schedule: ScheduleContext | null = null;
  const ctx: SendContext = {
    db, gmail, ownEmail: mailbox.email, settings, result,
    schedule: async () => (schedule ??= await loadScheduleContext(db)),
  };

  let halted = false;
  let firstError: unknown = null;
  for (const msg of (claimed ?? []) as OutreachMessage[]) {
    if (halted || Date.now() > deadline) {
      await release(db, msg);
      continue;
    }
    try {
      if ((await sendClaimed(ctx, msg)) === 'halt') halted = true;
    } catch (err) {
      // Nothing was sent for this message (see send-message), so give it back.
      firstError ??= err;
      await release(db, msg);
    }
  }
  if (firstError) throw firstError instanceof Error ? firstError : new Error(String(firstError));
  return result;
}
