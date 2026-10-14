/**
 * Checks that run on a claimed email just before it goes out.
 *
 * - {@link inboundAfter}: has the person replied (or bounced) in the thread
 *   since we last wrote? Then the follow-up is withdrawn and the reply path
 *   stops the sequence.
 * - {@link deferToWindow}: a message due outside its recipient's send window
 *   (an outage, a settings change, a paused campaign) moves to the next
 *   allowed slot rather than going out at night.
 *
 * @module lib/outreach/services/send-guards
 */
import { classifyInbound } from '../gmail/classify';
import type { GmailThread } from '../gmail/client';
import { headerOf } from '../gmail/client';
import { nextSendTime, type ScheduleSettings } from '../sequencer/schedule';
import type { AdminDb, OutreachMessage, OutreachSettings } from '../types';

import { capFor, type ScheduleContext } from './sequencer';

/**
 * True when a real reply or a bounce is in the thread, dated after `after`.
 * Auto-replies don't count: an out-of-office must not stop the sequence,
 * and our own messages are excluded by their From address.
 *
 * Pure.
 */
export function inboundAfter(thread: GmailThread, ownEmail: string, after: Date): boolean {
  return (thread.messages ?? []).some((m) => {
    const kind = classifyInbound({
      from: headerOf(m, 'From') ?? '',
      contentType: headerOf(m, 'Content-Type'),
      autoSubmitted: headerOf(m, 'Auto-Submitted'),
      subject: headerOf(m, 'Subject'),
    }, ownEmail);
    if (kind !== 'reply' && kind !== 'bounce') return false;
    return Number(m.internalDate ?? 0) > after.getTime();
  });
}

/** The window settings the scheduler reads, from the settings row. */
export function windowOf(settings: OutreachSettings): ScheduleSettings {
  return {
    windowStart: settings.send_window_start,
    windowEnd: settings.send_window_end,
    weekdays: settings.send_weekdays,
  };
}

/**
 * Move an out-of-window message to the next allowed slot, in its
 * recipient's window and under the daily caps. Not an attempt, so the
 * claim's attempt is given back. Returns false when no slot exists within
 * the scheduler's horizon; the caller then cancels the message.
 */
export async function deferToWindow(
  db: AdminDb,
  msg: OutreachMessage,
  timezone: string,
  settings: OutreachSettings,
  schedule: ScheduleContext,
  now: Date,
): Promise<boolean> {
  const at = nextSendTime({
    base: now,
    delayDays: 0,
    timezone,
    settings: windowOf(settings),
    notBefore: now,
    dayCounts: schedule.dayCounts.email,
    capFor: capFor(schedule, 'email'),
    random: schedule.random,
  });
  if (!at) return false;
  const { error } = await db.from('outreach_messages').update({
    status: 'scheduled',
    scheduled_for: at.toISOString(),
    claimed_at: null,
    attempts: Math.max(0, msg.attempts - 1),
  }).eq('id', msg.id);
  if (error) throw new Error(`defer email: ${error.message}`);
  return true;
}
