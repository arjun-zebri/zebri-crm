import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { attributeBookings } from '@/lib/outreach/services/attribution';
import { repairStrandedEnrolments } from '@/lib/outreach/services/sequencer-repair';
import type { OutreachSettings } from '@/lib/outreach/types';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * Send-safety rules against the real schema: the claim respects a paused
 * campaign, the one-step-per-enrolment unique index holds, a stranded
 * enrolment is repaired, and an email-only booking records but does not
 * stop a sequence. Everything is tagged and removed afterwards, as in flow.test.
 */
describe('outreach send safety', () => {
  const db = serviceClient();
  const tag = `ss${Date.now()}`;
  let mc: TestUser;
  let savedSettings: OutreachSettings;
  const prospectIds: string[] = [];
  const campaignIds: string[] = [];
  let sequenceId = '';
  let stepId = '';
  let meetingTypeId = '';

  async function prospect(n: number, email: string): Promise<string> {
    const { data, error } = await db.from('outreach_prospects').insert({
      full_name: `Celebrant ${tag} ${n}`, dedupe_key: `${tag}|${n}`, ref_code: `${tag}-${n}`,
      state: 'VIC', email, email_check: 'ok', verdict: 'active', stage: 'new',
    }).select('id').single();
    if (error) throw new Error(error.message);
    prospectIds.push(data.id);
    return data.id;
  }

  async function campaign(status: 'active' | 'paused'): Promise<string> {
    const { data, error } = await db.from('outreach_campaigns')
      .insert({ name: `Camp ${tag} ${status}`, status, daily_new_enrolments: 5, audience: {} })
      .select('id').single();
    if (error) throw new Error(error.message);
    campaignIds.push(data.id);
    return data.id;
  }

  beforeAll(async () => {
    mc = await createTestUser({}, { account_type: 'admin' });
    const { data } = await db.from('outreach_settings').select('*').eq('id', true).single();
    savedSettings = data!;
    await db.from('outreach_settings').update({
      apify_monthly_budget_cents: 0, send_weekdays: [1, 2, 3, 4, 5, 6, 7],
      send_window_start: '00:00', send_window_end: '23:59', sending_paused: false,
    }).eq('id', true);
    const { data: seq } = await db.from('outreach_sequences').insert({ name: `Seq ${tag}` }).select('id').single();
    sequenceId = seq!.id;
    const { data: step } = await db.from('outreach_sequence_steps')
      .insert({ sequence_id: sequenceId, position: 1, channel: 'email', delay_days: 0, is_new_thread: true })
      .select('id').single();
    stepId = step!.id;
    await db.from('outreach_variants').insert({ step_id: stepId, label: 'A', subject: 'Hi', body: 'Hello {{first_name|there}}', weight: 1, active: true });
    const { data: mt } = await db.from('meeting_types').insert({ user_id: mc.id, name: `Demo ${tag}`, duration_minutes: 30 }).select('id').single();
    meetingTypeId = mt!.id;
  });

  afterAll(async () => {
    if (campaignIds.length) await db.from('outreach_campaigns').delete().in('id', campaignIds);
    if (prospectIds.length) {
      await db.from('outreach_events').delete().in('prospect_id', prospectIds);
      await db.from('outreach_prospects').delete().in('id', prospectIds);
    }
    if (sequenceId) await db.from('outreach_sequences').delete().eq('id', sequenceId);
    await db.from('meeting_types').delete().eq('id', meetingTypeId);
    await db.from('outreach_settings').update({
      send_weekdays: savedSettings.send_weekdays, send_window_start: savedSettings.send_window_start,
      send_window_end: savedSettings.send_window_end, apify_monthly_budget_cents: savedSettings.apify_monthly_budget_cents,
      sending_paused: savedSettings.sending_paused, booking_meeting_type_id: savedSettings.booking_meeting_type_id,
    }).eq('id', true);
    await mc.cleanup();
  });

  it('does not claim a due email whose campaign is paused', async () => {
    const pid = await prospect(1, `paused-${tag}@example.com`);
    const cid = await campaign('paused');
    const { data: enr } = await db.from('outreach_enrollments')
      .insert({ campaign_id: cid, prospect_id: pid, sequence_id: sequenceId }).select('id').single();
    const { data: msg } = await db.from('outreach_messages').insert({
      enrollment_id: enr!.id, prospect_id: pid, step_id: stepId, channel: 'email', status: 'scheduled',
      scheduled_for: new Date(Date.now() - 60_000).toISOString(), body: 'x', subject: 'Hi',
    }).select('id').single();

    const { data: claimed, error } = await db.rpc('outreach_claim_due_emails', { p_limit: 500 });
    expect(error).toBeNull();
    expect((claimed ?? []).map((m) => m.id)).not.toContain(msg!.id);
    const { data: still } = await db.from('outreach_messages').select('status').eq('id', msg!.id).single();
    expect(still!.status).toBe('scheduled');
  });

  it('allows at most one message per step in an enrolment', async () => {
    const pid = await prospect(2, `unique-${tag}@example.com`);
    const cid = await campaign('active');
    const { data: enr } = await db.from('outreach_enrollments')
      .insert({ campaign_id: cid, prospect_id: pid, sequence_id: sequenceId }).select('id').single();
    const row = { enrollment_id: enr!.id, prospect_id: pid, step_id: stepId, channel: 'email', status: 'scheduled', scheduled_for: new Date().toISOString(), body: 'x' };
    expect((await db.from('outreach_messages').insert(row)).error).toBeNull();
    const dup = await db.from('outreach_messages').insert(row);
    expect(dup.error?.code).toBe('23505');
  });

  it('repairs an active enrolment that has nothing scheduled, and is idempotent', async () => {
    const pid = await prospect(3, `stranded-${tag}@example.com`);
    const cid = await campaign('active');
    const { data: enr } = await db.from('outreach_enrollments')
      .insert({ campaign_id: cid, prospect_id: pid, sequence_id: sequenceId }).select('id').single();
    // Old enough that the repair's age floor doesn't skip it.
    await db.from('outreach_enrollments').update({ enrolled_at: new Date(Date.now() - 10 * 60_000).toISOString() }).eq('id', enr!.id);

    await repairStrandedEnrolments(db, 500);
    const { data: msgs } = await db.from('outreach_messages').select('status').eq('enrollment_id', enr!.id);
    expect(msgs?.length).toBeGreaterThanOrEqual(1);
    await repairStrandedEnrolments(db, 500);
    const { data: again } = await db.from('outreach_messages').select('id').eq('enrollment_id', enr!.id);
    expect(again).toHaveLength(msgs!.length);
  });

  it('records an email-only booking without stopping the sequence', async () => {
    const email = `emailonly-${tag}@example.com`;
    const pid = await prospect(4, email);
    const cid = await campaign('active');
    const { data: enr } = await db.from('outreach_enrollments')
      .insert({ campaign_id: cid, prospect_id: pid, sequence_id: sequenceId }).select('id').single();
    const starts = new Date(Date.now() + 3 * 86_400_000);
    await db.from('bookings').insert({
      user_id: mc.id, meeting_type_id: meetingTypeId, name: 'Stranger', email,
      starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + 1_800_000).toISOString(),
      timezone: 'Australia/Melbourne',
    });

    await attributeBookings(db, meetingTypeId, { booked: 0, demosDone: 0, cancelled: 0, signedUp: 0, paying: 0 });
    const { data: ev } = await db.from('outreach_events').select('payload').eq('prospect_id', pid).eq('type', 'demo_booked').single();
    expect(ev!.payload).toMatchObject({ matched_by: 'email', needs_confirmation: true });
    const { data: e } = await db.from('outreach_enrollments').select('status').eq('id', enr!.id).single();
    expect(e!.status).toBe('active');
    const { data: p } = await db.from('outreach_prospects').select('stage').eq('id', pid).single();
    expect(p!.stage).toBe('new');
  });
});
