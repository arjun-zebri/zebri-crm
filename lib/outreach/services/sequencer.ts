/**
 * Enrol prospects into campaigns and schedule each sequence step.
 *
 * Steps are scheduled one at a time: step N+1 is only placed once step N
 * actually went out, so "3 days later" means three days after the real
 * send, not after a slot that slipped behind the daily cap.
 *
 * @module lib/outreach/services/sequencer
 */
import { replySubject } from '../gmail/mime';
import { timezoneForState } from '../import/normalise';
import { mergeValuesFor, renderTemplate, withEmailFooter } from '../render';
import { availabilityOf, eligibleArms, pickWeighted, type Arm, type Channel } from '../sequencer/arms';
import {
  CAP_TIMEZONE,
  localDateKey,
  localParts,
  nextSendTime,
  rampCap,
  zonedTimeToUtc,
} from '../sequencer/schedule';
import type { AdminDb, Enrollment, OutreachSettings, Prospect, SequenceStep, Variant } from '../types';

import { queueEnrolmentIgLookups } from './checks';
import { autoAdvance, recordEvent, recordEvents, type EventInput } from './events';
import { bookingBaseUrl, loadSettings } from './settings';

/** Everything scheduling needs that's shared across one pass. */
export interface ScheduleContext {
  settings: OutreachSettings;
  bookingBase: string | null;
  /** Per channel: messages per Sydney day (scheduled, sending or sent). */
  dayCounts: Record<Channel, Map<string, number>>;
  random: () => number;
}

/** Load settings and per-day message counts once per pass. */
export async function loadScheduleContext(db: AdminDb, random: () => number = Math.random): Promise<ScheduleContext> {
  const settings = await loadSettings(db);
  const now = new Date();
  const p = localParts(now, CAP_TIMEZONE);
  const dayStart = zonedTimeToUtc(p.year, p.month, p.day, 0, 0, CAP_TIMEZONE).toISOString();
  const dayCounts: ScheduleContext['dayCounts'] = { email: new Map(), instagram: new Map() };
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('outreach_messages')
      .select('channel, scheduled_for, sent_at')
      .in('status', ['scheduled', 'sending', 'sent'])
      .or(`scheduled_for.gte.${dayStart},sent_at.gte.${dayStart}`)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`day counts: ${error.message}`);
    for (const m of data ?? []) {
      const key = localDateKey(new Date(m.sent_at ?? m.scheduled_for), CAP_TIMEZONE);
      const map = dayCounts[m.channel as Channel];
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    if (!data || data.length < 1000) break;
  }
  return { settings, bookingBase: await bookingBaseUrl(db, settings), dayCounts, random };
}

/** Daily cap for a channel, as a function of Sydney day key. */
export function capFor(ctx: ScheduleContext, channel: Channel): (dayKey: string) => number {
  const s = ctx.settings;
  return channel === 'email'
    ? (key) => rampCap(key, s.ramp_started_on, s.email_ramp, s.email_daily_cap)
    : () => s.ig_daily_cap;
}

/** Subject for an email step: the thread's subject as a reply, else the variant's. */
async function emailSubject(db: AdminDb, enrollmentId: string, step: SequenceStep, variant: Variant): Promise<string | null> {
  if (!step.is_new_thread) {
    const { data, error } = await db
      .from('outreach_messages')
      .select('subject')
      .eq('enrollment_id', enrollmentId)
      .eq('channel', 'email')
      .eq('status', 'sent')
      .order('sent_at', { ascending: true })
      .limit(1);
    if (error) throw new Error(`thread subject: ${error.message}`);
    const first = data?.[0]?.subject;
    if (first) return replySubject(first);
  }
  return variant.subject?.trim() || null;
}

/**
 * Schedule `step` for an enrolment, `base` being when the delay counts
 * from. Steps that can't be rendered are recorded as skipped and the
 * sequence moves on, so one missing field never strands a prospect.
 */
export async function scheduleStep(
  db: AdminDb,
  ctx: ScheduleContext,
  enrollment: Enrollment,
  prospect: Prospect,
  step: SequenceStep,
  base: Date,
): Promise<void> {
  const { data: variants, error } = await db.from('outreach_variants').select('*').eq('step_id', step.id).eq('active', true);
  if (error) throw new Error(`variants: ${error.message}`);
  const variant = pickWeighted(variants ?? [], ctx.random);
  const channel = step.channel as Channel;

  const skip = async (reason: string) => {
    const now = new Date().toISOString();
    const { data: msg, error: mErr } = await db
      .from('outreach_messages')
      .insert({
        enrollment_id: enrollment.id, prospect_id: prospect.id, step_id: step.id, variant_id: variant?.id ?? null,
        channel, status: 'skipped', scheduled_for: now, body: '', skip_reason: reason,
      })
      .select('id')
      .single();
    // Unique on (enrollment, step): another pass already decided this step.
    if (mErr?.code === '23505') return;
    if (mErr) throw new Error(`skip message: ${mErr.message}`);
    await recordEvent(db, {
      prospectId: prospect.id, type: 'message_skipped', channel, campaignId: enrollment.campaign_id,
      enrollmentId: enrollment.id, messageId: msg.id, payload: { reason, step: step.position },
    });
    await advanceAfter(db, ctx, enrollment, prospect, step.position, base);
  };

  if (!variant) return skip('no_active_variant');
  const values = mergeValuesFor(prospect, { bookingBaseUrl: ctx.bookingBase, senderName: ctx.settings.sender_name });
  const body = renderTemplate(variant.body, values);
  if (!body.ok) return skip(`missing_field:${body.missing.join(',')}`);

  let subject: string | null = null;
  if (channel === 'email') {
    const rawSubject = await emailSubject(db, enrollment.id, step, variant);
    if (!rawSubject) return skip('missing_subject');
    const rendered = renderTemplate(rawSubject, values);
    if (!rendered.ok) return skip(`missing_field:${rendered.missing.join(',')}`);
    subject = rendered.text;
  }

  const tz = timezoneForState(prospect.state);
  const at = nextSendTime({
    base,
    delayDays: step.delay_days,
    timezone: tz,
    settings: {
      windowStart: ctx.settings.send_window_start,
      windowEnd: ctx.settings.send_window_end,
      weekdays: ctx.settings.send_weekdays,
    },
    notBefore: new Date(),
    dayCounts: ctx.dayCounts[channel],
    capFor: capFor(ctx, channel),
    random: ctx.random,
  });
  if (!at) return skip('no_slot');

  const local = localParts(at, tz);
  const { data: msg, error: mErr } = await db
    .from('outreach_messages')
    .insert({
      enrollment_id: enrollment.id, prospect_id: prospect.id, step_id: step.id, variant_id: variant.id,
      channel, status: 'scheduled', scheduled_for: at.toISOString(),
      send_local_hour: local.hour, send_local_weekday: local.weekday,
      subject,
      body: channel === 'email' ? withEmailFooter(body.text, ctx.settings.signature, ctx.settings.sender_name) : body.text,
    })
    .select('id')
    .single();
  // A unique violation means another pass already scheduled this step.
  if (mErr?.code === '23505') return;
  if (mErr) throw new Error(`schedule message: ${mErr.message}`);
  const key = localDateKey(at, CAP_TIMEZONE);
  ctx.dayCounts[channel].set(key, (ctx.dayCounts[channel].get(key) ?? 0) + 1);
  await recordEvent(db, {
    prospectId: prospect.id, type: 'message_scheduled', channel, campaignId: enrollment.campaign_id,
    enrollmentId: enrollment.id, messageId: msg.id,
    payload: { step: step.position, variant: variant.label, scheduled_for: at.toISOString() },
  });
}

/**
 * After step `position` finished (sent or skipped), schedule the next
 * one or complete the enrolment.
 */
export async function advanceAfter(
  db: AdminDb,
  ctx: ScheduleContext,
  enrollment: Enrollment,
  prospect: Prospect,
  position: number,
  base: Date,
): Promise<void> {
  const { data: live } = await db.from('outreach_enrollments').select('status').eq('id', enrollment.id).single();
  if (live?.status !== 'active') return;
  const { data: next, error } = await db
    .from('outreach_sequence_steps')
    .select('*')
    .eq('sequence_id', enrollment.sequence_id)
    .gt('position', position)
    .order('position')
    .limit(1);
  if (error) throw new Error(`next step: ${error.message}`);
  const step = next?.[0];
  if (!step) {
    await db.from('outreach_enrollments').update({ status: 'completed', current_position: position }).eq('id', enrollment.id).eq('status', 'active');
    return;
  }
  // A channel the prospect lost mid-sequence (bounce, can't DM) is skipped, not attempted.
  const available = availabilityOf(prospect);
  if (!available[step.channel as Channel]) {
    const { data: fresh } = await db.from('outreach_prospects').select('*').eq('id', prospect.id).single();
    if (!fresh || !availabilityOf(fresh)[step.channel as Channel]) {
      await recordEvent(db, {
        prospectId: prospect.id, type: 'message_skipped', channel: step.channel as Channel,
        campaignId: enrollment.campaign_id, enrollmentId: enrollment.id,
        payload: { reason: 'channel_unavailable', step: step.position },
      });
      return advanceAfter(db, ctx, enrollment, fresh ?? prospect, step.position, base);
    }
  }
  await db.from('outreach_enrollments').update({ current_position: step.position }).eq('id', enrollment.id);
  await scheduleStep(db, ctx, enrollment, prospect, step, base);
}

/** Arms of a campaign with the channels each sequence uses. */
async function loadArms(db: AdminDb, campaignId: string): Promise<Arm[]> {
  const { data: arms, error } = await db.from('outreach_campaign_arms').select('sequence_id, weight').eq('campaign_id', campaignId);
  if (error) throw new Error(`arms: ${error.message}`);
  const ids = (arms ?? []).map((a) => a.sequence_id);
  if (ids.length === 0) return [];
  const { data: steps, error: sErr } = await db.from('outreach_sequence_steps').select('sequence_id, channel').in('sequence_id', ids);
  if (sErr) throw new Error(`arm steps: ${sErr.message}`);
  return (arms ?? []).map((a) => ({
    sequenceId: a.sequence_id,
    weight: a.weight,
    channels: [...new Set((steps ?? []).filter((s) => s.sequence_id === a.sequence_id).map((s) => s.channel as Channel))],
  }));
}

/** Enrolments created today (Sydney) for a campaign. */
async function enrolledToday(db: AdminDb, campaignId: string): Promise<number> {
  const p = localParts(new Date(), CAP_TIMEZONE);
  const start = zonedTimeToUtc(p.year, p.month, p.day, 0, 0, CAP_TIMEZONE).toISOString();
  const { count, error } = await db
    .from('outreach_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('enrolled_at', start);
  if (error) throw new Error(`enrolled today: ${error.message}`);
  return count ?? 0;
}

/** Result of one enrolment pass. */
export interface EnrolResult {
  enrolled: number;
}

/**
 * Enrol up to each active campaign's daily pace. Paused sending pauses
 * enrolment too, so a pause can't build a backlog that floods on resume.
 */
export async function enrolDue(db: AdminDb, deadline: number, random: () => number = Math.random): Promise<EnrolResult> {
  const ctx = await loadScheduleContext(db, random);
  if (ctx.settings.sending_paused) return { enrolled: 0 };

  const { data: campaigns, error } = await db.from('outreach_campaigns').select('*').eq('status', 'active');
  if (error) throw new Error(`campaigns: ${error.message}`);
  let enrolled = 0;

  for (const campaign of campaigns ?? []) {
    if (Date.now() > deadline) break;
    const headroom = campaign.daily_new_enrolments - (await enrolledToday(db, campaign.id));
    if (headroom <= 0) continue;
    const arms = await loadArms(db, campaign.id);
    if (arms.length === 0) continue;

    // Over-fetch: some candidates fit no arm (missing channel).
    const { data: candidates, error: cErr } = await db.rpc('outreach_enrol_candidates', { p_campaign: campaign.id, p_limit: headroom * 4 });
    if (cErr) throw new Error(`candidates: ${cErr.message}`);

    let taken = 0;
    const igLookups: string[] = [];
    const events: EventInput[] = [];
    let firstError: unknown = null;
    for (const prospect of candidates ?? []) {
      if (taken >= headroom || Date.now() > deadline) break;
      const arm = pickWeighted(eligibleArms(arms, availabilityOf(prospect)), random);
      if (!arm) continue;
      const { data: enrollment, error: eErr } = await db
        .from('outreach_enrollments')
        .insert({ campaign_id: campaign.id, prospect_id: prospect.id, sequence_id: arm.sequenceId })
        .select('*')
        .single();
      // A unique violation means another pass got here first; move on.
      if (eErr) {
        if (eErr.code === '23505') continue;
        throw new Error(`enrol: ${eErr.message}`);
      }
      taken++;
      enrolled++;
      events.push({
        prospectId: prospect.id, type: 'enrolled', campaignId: campaign.id, enrollmentId: enrollment.id,
        payload: { sequence_id: arm.sequenceId, arm_channels: arm.channels },
      });
      if (arm.channels.includes('instagram') && !prospect.ig_checked_at) igLookups.push(prospect.id);
      // Why: a failure here leaves an active enrolment with nothing scheduled.
      // Keep enrolling the others; the stranded-enrolment repair pass finishes it.
      try {
        await advanceAfter(db, ctx, enrollment, prospect, 0, new Date());
      } catch (err) {
        firstError ??= err;
      }
    }
    await recordEvents(db, events);
    await queueEnrolmentIgLookups(db, igLookups);
    if (firstError) throw firstError instanceof Error ? firstError : new Error(String(firstError));
  }
  return { enrolled };
}

/** Mark an IG message sent (the founder pasted it into Instagram) and move on. */
export async function markIgSent(db: AdminDb, messageId: string): Promise<void> {
  const now = new Date();
  const { data: msg, error } = await db
    .from('outreach_messages')
    .update({ status: 'sent', sent_at: now.toISOString() })
    .eq('id', messageId)
    .eq('channel', 'instagram')
    .eq('status', 'scheduled')
    .select('*')
    .single();
  if (error || !msg) throw new Error('That DM is no longer waiting to be sent.');
  await afterSend(db, msg.enrollment_id, msg.prospect_id, msg.step_id, msg.id, 'instagram', now, 'ig_sent');
}

/** Shared tail of an email or IG send: event, stage, next step. */
export async function afterSend(
  db: AdminDb,
  enrollmentId: string,
  prospectId: string,
  stepId: string,
  messageId: string,
  channel: Channel,
  sentAt: Date,
  eventType: 'email_sent' | 'ig_sent',
  extra: Record<string, unknown> = {},
): Promise<void> {
  const [{ data: enrollment }, { data: prospect }, { data: step }] = await Promise.all([
    db.from('outreach_enrollments').select('*').eq('id', enrollmentId).single(),
    db.from('outreach_prospects').select('*').eq('id', prospectId).single(),
    db.from('outreach_sequence_steps').select('*').eq('id', stepId).single(),
  ]);
  if (!enrollment || !prospect || !step) throw new Error('send bookkeeping: rows missing');
  await recordEvent(db, {
    prospectId, type: eventType, channel, campaignId: enrollment.campaign_id, enrollmentId, messageId,
    actor: channel === 'instagram' ? 'admin' : 'system',
    payload: { step: step.position, ...extra },
  });
  await autoAdvance(db, prospectId, 'contacted');
  const ctx = await loadScheduleContext(db);
  await advanceAfter(db, ctx, enrollment, prospect, step.position, sentAt);
}
