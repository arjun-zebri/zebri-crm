/**
 * "Why is nothing sending?" for the Today header. Pure rules over the
 * settings, mailbox, campaigns, today's send count and scheduler
 * heartbeat. {@link loadSendStatus} gathers those inputs read-only.
 *
 * Read-only by design: the cap and window rules here mirror
 * `sendDueEmails` in `send.ts` and `rampCap` in `sequencer/schedule.ts`
 * without editing them, so the summary can drift only if those change.
 *
 * @module lib/outreach/services/send-status
 */
import { readHeartbeat } from '@/lib/workflows/heartbeat';

import { CAP_TIMEZONE, localDateKey, localParts, rampCap, zonedTimeToUtc } from '../sequencer/schedule';
import type { AdminDb, OutreachSettings } from '../types';

/** The scheduler heartbeat row the status reads (written by the automations tick). */
export const SCHEDULER_HEARTBEAT = 'automations-tick';

/** Older than this and the scheduler is treated as not running. Ticks are every 15 minutes. */
export const SCHEDULER_STALE_MINUTES = 20;

const MINUTE_MS = 60_000;

/** Settings the status reads. A subset of {@link OutreachSettings}, so tests need not build the full row. */
export type SendStatusSettings = Pick<
  OutreachSettings,
  | 'sending_paused' | 'paused_reason' | 'send_window_start' | 'send_window_end'
  | 'send_weekdays' | 'email_daily_cap' | 'email_ramp' | 'ramp_started_on'
>;

/** Everything {@link computeSendStatus} needs. */
export interface SendStatusInput {
  now: Date;
  settings: SendStatusSettings;
  mailboxConnected: boolean;
  activeCampaigns: number;
  sentToday: number;
  /** Earliest email still scheduled after `now`, or null. */
  nextScheduledAt: Date | null;
  /** When the automations tick last ran, or null if never. */
  schedulerLastRunAt: Date | null;
}

/** The status the Today header shows. */
export interface SendStatus {
  /** True when at least one reason blocks sending right now. */
  blocked: boolean;
  /** One plain line: the first blocker, or the normal "sending" summary. */
  headline: string;
  /** Every active blocker, in priority order. Empty when sending. */
  reasons: string[];
  /** Emails sent today (Sydney day) and today's limit. */
  sent: number;
  cap: number;
  /** ISO instant of the next scheduled email, or null. */
  nextEmailAt: string | null;
  /** Scheduler warning, or null when it ran recently. */
  schedulerWarning: string | null;
}

/** "9:00 am" from minutes past midnight. */
function clock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? 'am' : 'pm';
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "HH:MM(:SS)" to minutes past midnight. */
function minutesOf(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

const clockFormat = new Intl.DateTimeFormat('en-AU', { timeZone: CAP_TIMEZONE, hour: 'numeric', minute: '2-digit' });

const dayFormat = new Intl.DateTimeFormat('en-AU', { timeZone: CAP_TIMEZONE, weekday: 'long' });

/** Day name in Sydney for an instant, e.g. "Monday". */
function dayName(at: Date): string {
  return dayFormat.format(at);
}

/**
 * The next instant the send window opens, in Sydney time. Looks up to
 * two weeks ahead; returns null when no allowed weekday exists.
 */
export function nextWindowOpening(now: Date, settings: SendStatusSettings): Date | null {
  const startMin = minutesOf(settings.send_window_start);
  const sh = Math.floor(startMin / 60);
  const sm = startMin % 60;
  const today = localParts(now, CAP_TIMEZONE);
  for (let offset = 0; offset < 14; offset++) {
    const base = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const iso = base.getUTCDay() === 0 ? 7 : base.getUTCDay();
    if (!settings.send_weekdays.includes(iso)) continue;
    const at = zonedTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), sh, sm, CAP_TIMEZONE);
    if (at.getTime() > now.getTime()) return at;
  }
  return null;
}

/** Pure status rules. No I/O. */
export function computeSendStatus(input: SendStatusInput): SendStatus {
  const { now, settings } = input;
  const cap = rampCap(localDateKey(now, CAP_TIMEZONE), settings.ramp_started_on, settings.email_ramp, settings.email_daily_cap);
  const p = localParts(now, CAP_TIMEZONE);
  const nowMin = p.hour * 60 + p.minute;
  const startMin = minutesOf(settings.send_window_start);
  const endMin = minutesOf(settings.send_window_end);
  const dayAllowed = settings.send_weekdays.includes(p.weekday);
  const inWindow = dayAllowed && nowMin >= startMin && nowMin < endMin;

  const reasons: string[] = [];
  if (settings.sending_paused) {
    reasons.push(settings.paused_reason ? `Sending is paused: ${settings.paused_reason}` : 'Sending is paused.');
  }
  if (!input.mailboxConnected) reasons.push('No mailbox connected. Connect one in Settings.');
  if (input.activeCampaigns === 0) reasons.push('No active campaign. Activate one in Campaigns.');
  if (!inWindow) {
    const next = nextWindowOpening(now, settings);
    const sameDay = next !== null && localDateKey(next, CAP_TIMEZONE) === localDateKey(now, CAP_TIMEZONE);
    const when = next === null
      ? 'on a day you have allowed'
      : sameDay ? `today at ${clock(startMin)}` : `${dayName(next)} at ${clock(startMin)}`;
    // Why: the window is set in Sydney time for this summary; the scheduler itself applies it to each recipient's clock.
    reasons.push(dayAllowed
      ? `Outside the send window (${clock(startMin)} to ${clock(endMin)}, Sydney time). Next window opens ${when}.`
      : `Sending is off on ${dayName(now)}. Next window opens ${when}.`);
  }
  if (input.sentToday >= cap) reasons.push(`Daily limit reached (${input.sentToday} of ${cap}). Resumes tomorrow.`);

  const last = input.schedulerLastRunAt;
  const minutesAgo = last ? Math.floor((now.getTime() - last.getTime()) / MINUTE_MS) : null;
  const schedulerWarning = minutesAgo === null
    ? 'The scheduler has never run. Scheduled emails will not go out.'
    : minutesAgo > SCHEDULER_STALE_MINUTES
      ? `Scheduler last ran ${minutesAgo} minutes ago. Scheduled emails may be late.`
      : null;

  const blocked = reasons.length > 0;
  const headline = blocked
    ? reasons[0]!
    : input.nextScheduledAt
      ? `Sending. Next email at ${clockFormat.format(input.nextScheduledAt).toLowerCase()}.`
      : 'Sending. Nothing is scheduled right now.';

  return {
    blocked,
    headline,
    reasons,
    sent: input.sentToday,
    cap,
    nextEmailAt: input.nextScheduledAt?.toISOString() ?? null,
    schedulerWarning,
  };
}

/** Read the inputs for {@link computeSendStatus}. Read-only; uses the service-role client. */
export async function loadSendStatus(db: AdminDb, now: Date = new Date()): Promise<SendStatus> {
  const sydney = localParts(now, CAP_TIMEZONE);
  const sydneyMidnight = zonedTimeToUtc(sydney.year, sydney.month, sydney.day, 0, 0, CAP_TIMEZONE).toISOString();
  const [settingsRes, mailboxRes, campaignsRes, sentRes, nextRes, heartbeat] = await Promise.all([
    db.from('outreach_settings').select('*').eq('id', true).single(),
    db.from('outreach_mailbox').select('id').eq('id', true).maybeSingle(),
    db.from('outreach_campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db
      .from('outreach_messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel', 'email')
      .eq('status', 'sent')
      .gte('sent_at', sydneyMidnight),
    db
      .from('outreach_messages')
      .select('scheduled_for')
      .eq('channel', 'email')
      .eq('status', 'scheduled')
      .gt('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(1),
    readHeartbeat(db, SCHEDULER_HEARTBEAT),
  ]);
  if (settingsRes.error || !settingsRes.data) throw new Error(`outreach_settings: ${settingsRes.error?.message ?? 'missing row'}`);
  if (campaignsRes.error) throw new Error(`outreach_campaigns: ${campaignsRes.error.message}`);
  if (sentRes.error) throw new Error(`sent today: ${sentRes.error.message}`);
  if (nextRes.error) throw new Error(`next scheduled: ${nextRes.error.message}`);

  const nextRow = nextRes.data?.[0];
  return computeSendStatus({
    now,
    settings: settingsRes.data,
    mailboxConnected: !!mailboxRes.data,
    activeCampaigns: campaignsRes.count ?? 0,
    sentToday: sentRes.count ?? 0,
    nextScheduledAt: nextRow?.scheduled_for ? new Date(nextRow.scheduled_for) : null,
    schedulerLastRunAt: heartbeat ? new Date(heartbeat) : null,
  });
}
