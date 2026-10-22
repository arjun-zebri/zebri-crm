import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildProspects, guessColumns, parseSheet } from '@/lib/outreach/import/sheet';
import { igSent, markReplied } from '@/lib/outreach/services/admin-ops';
import { runAttribution } from '@/lib/outreach/services/attribution';
import { processCheckBatch, startActivityRun } from '@/lib/outreach/services/checks';
import { importProspects } from '@/lib/outreach/services/import';
import { enrolDue, markIgSent } from '@/lib/outreach/services/sequencer';
import type { OutreachSettings } from '@/lib/outreach/types';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

/**
 * The outreach engine end to end against the real schema: import, the
 * activity check (no network: these prospects have no website and no
 * email, and the Apify budget is zero), enrolment, the IG queue, the
 * reply stop rule and booking attribution.
 *
 * Outreach tables are global (no tenant), so every row this file makes
 * is tagged with a run-unique suffix and removed afterwards, and the
 * settings row is restored.
 */
describe('outreach flow', () => {
  const db = serviceClient();
  const tag = `it${Date.now()}`;
  let mc: TestUser;
  let savedSettings: OutreachSettings;
  const prospectIds: string[] = [];
  let sequenceId = '';
  let campaignId = '';

  beforeAll(async () => {
    mc = await createTestUser({}, { account_type: 'admin' });
    const { data } = await db.from('outreach_settings').select('*').eq('id', true).single();
    savedSettings = data!;
    // Every day, all day, so scheduling is deterministic whatever time CI runs.
    await db.from('outreach_settings').update({
      apify_monthly_budget_cents: 0, send_weekdays: [1, 2, 3, 4, 5, 6, 7],
      send_window_start: '00:00', send_window_end: '23:59', sending_paused: false, ig_daily_cap: 50,
    }).eq('id', true);
  });

  afterAll(async () => {
    if (campaignId) await db.from('outreach_campaigns').delete().eq('id', campaignId);
    if (prospectIds.length) {
      await db.from('outreach_events').delete().in('prospect_id', prospectIds);
      await db.from('outreach_prospects').delete().in('id', prospectIds);
    }
    if (sequenceId) await db.from('outreach_sequences').delete().eq('id', sequenceId);
    await db.from('outreach_check_runs').delete().contains('scope', { tag });
    const rest: Partial<OutreachSettings> = { ...savedSettings };
    delete rest.id;
    await db.from('outreach_settings').update(rest).eq('id', true);
    await mc?.cleanup();
  });

  it('imports a sheet, merging on re-import', async () => {
    const csv = [
      'Name,State,Suburb,Instagram',
      `Quiet ${tag},NSW,Bondi,`,
      `Insta ${tag},VIC,Fitzroy,@insta_${tag}`,
    ].join('\n');
    const grid = parseSheet(csv);
    const { prospects } = buildProspects(grid, guessColumns(grid.headers));
    const first = await importProspects(db, prospects);
    expect(first.inserted).toBe(2);
    const again = await importProspects(db, prospects);
    expect(again).toEqual({ inserted: 0, merged: 0, unchanged: 2 });

    const { data } = await db.from('outreach_prospects').select('id, ref_code, full_name').like('full_name', `%${tag}`);
    expect(data).toHaveLength(2);
    expect(data!.every((p) => /^[a-z0-9]{8}$/.test(p.ref_code))).toBe(true);
    prospectIds.push(...data!.map((p) => p.id));
  });

  it('runs the activity check without spending past the cap', async () => {
    const { runId, total } = await startActivityRun(db, { prospectIds });
    await db.from('outreach_check_runs').update({ scope: { prospectIds, tag } }).eq('id', runId);
    expect(total).toBe(2);
    for (let i = 0; i < 5; i++) {
      const p = await processCheckBatch(db, Date.now() + 20_000);
      if (!p.active) break;
    }
    const { data } = await db.from('outreach_prospects').select('full_name, verdict, verdict_reason, site_status').in('id', prospectIds);
    const quiet = data!.find((p) => p.full_name.startsWith('Quiet'))!;
    const insta = data!.find((p) => p.full_name.startsWith('Insta'))!;
    expect(quiet).toMatchObject({ verdict: 'inactive', verdict_reason: 'no_presence', site_status: 'no_site' });
    // Has a handle, but the $0 budget means no lookup: review, not a guess.
    expect(insta).toMatchObject({ verdict: 'needs_review', verdict_reason: 'check_incomplete' });
    const { data: run } = await db.from('outreach_check_runs').select('status, cost_cents').eq('id', runId).single();
    expect(run).toEqual({ status: 'done', cost_cents: 0 });
    const { count } = await db.from('outreach_events').select('id', { count: 'exact', head: true })
      .in('prospect_id', prospectIds).eq('type', 'ig_lookup_skipped_budget');
    expect(count).toBe(1);
  });

  it('leaves a run alone while its checks are still being queued', async () => {
    // A batch that lands between "run created" and "checks queued" must not
    // close the run, or every check queued after it is stranded.
    const { data: run } = await db.from('outreach_check_runs')
      .insert({ kind: 'activity', status: 'queuing', total: 1, scope: { tag } }).select('id').single();
    const progress = await processCheckBatch(db, Date.now() + 20_000);
    expect(progress.active).toBe(true);
    const { data: after } = await db.from('outreach_check_runs').select('status').eq('id', run!.id).single();
    expect(after!.status).toBe('queuing');
    await db.from('outreach_check_runs').delete().eq('id', run!.id);
  });

  it('enrols an active prospect into an IG arm and works the DM queue', async () => {
    const insta = prospectIds[1]!;
    await db.from('outreach_prospects').update({ verdict: 'active', verdict_source: 'manual', ig_status: 'ok', ig_checked_at: new Date().toISOString() }).eq('id', insta);

    const { data: seq } = await db.from('outreach_sequences').insert({ name: `Seq ${tag}` }).select('id').single();
    sequenceId = seq!.id;
    const { data: steps } = await db.from('outreach_sequence_steps').insert([
      { sequence_id: sequenceId, position: 1, channel: 'instagram', delay_days: 0, is_new_thread: false },
      { sequence_id: sequenceId, position: 2, channel: 'instagram', delay_days: 2, is_new_thread: false },
    ]).select('id, position');
    for (const s of steps!) {
      await db.from('outreach_variants').insert({ step_id: s.id, label: 'A', subject: null, body: `Hi {{first_name|there}}, step ${s.position}`, weight: 1, active: true });
    }
    const { data: camp } = await db.from('outreach_campaigns')
      .insert({ name: `Camp ${tag}`, status: 'active', daily_new_enrolments: 5, audience: { states: ['VIC'] } })
      .select('id').single();
    campaignId = camp!.id;
    await db.from('outreach_campaign_arms').insert({ campaign_id: campaignId, sequence_id: sequenceId, weight: 1 });

    const result = await enrolDue(db, Date.now() + 20_000, () => 0);
    expect(result.enrolled).toBeGreaterThanOrEqual(1);

    const { data: msgs } = await db.from('outreach_messages').select('*').eq('prospect_id', insta);
    expect(msgs).toHaveLength(1);
    expect(msgs![0]).toMatchObject({ channel: 'instagram', status: 'scheduled', body: 'Hi Insta, step 1' });

    await markIgSent(db, msgs![0]!.id);
    const { data: after } = await db.from('outreach_messages').select('status, body').eq('prospect_id', insta).order('created_at');
    expect(after!.map((m) => m.status)).toEqual(['sent', 'scheduled']);
    const { data: p } = await db.from('outreach_prospects').select('stage').eq('id', insta).single();
    expect(p!.stage).toBe('contacted');
  });

  it('stops the sequence when they reply', async () => {
    const insta = prospectIds[1]!;
    await markReplied(db, insta, 'instagram', 'Sounds good!');
    const { data: e } = await db.from('outreach_enrollments').select('status, stop_reason').eq('prospect_id', insta).single();
    expect(e).toEqual({ status: 'stopped', stop_reason: 'replied' });
    const { data: msgs } = await db.from('outreach_messages').select('status').eq('prospect_id', insta).order('created_at');
    expect(msgs!.map((m) => m.status)).toEqual(['sent', 'cancelled']);
    const { data: p } = await db.from('outreach_prospects').select('stage').eq('id', insta).single();
    expect(p!.stage).toBe('replied');
  });

  it('explains, rather than failing, when a DM cancelled by a reply is marked sent', async () => {
    // A Today page loaded before the reply still shows this DM.
    const insta = prospectIds[1]!;
    const { data: cancelled } = await db.from('outreach_messages').select('id').eq('prospect_id', insta).eq('status', 'cancelled').single();
    await expect(igSent(db, cancelled!.id)).rejects.toThrow('They replied, so this DM was cancelled. No need to send it.');
    const { data: still } = await db.from('outreach_messages').select('status').eq('id', cancelled!.id).single();
    expect(still!.status).toBe('cancelled');
  });

  it('attributes a tagged booking to the prospect', async () => {
    const insta = prospectIds[1]!;
    const { data: prospect } = await db.from('outreach_prospects').select('ref_code').eq('id', insta).single();
    const { data: mt } = await db.from('meeting_types').insert({ user_id: mc.id, name: 'Zebri demo', duration_minutes: 30 }).select('id').single();
    await db.from('outreach_settings').update({ booking_meeting_type_id: mt!.id }).eq('id', true);
    const starts = new Date(Date.now() + 3 * 86_400_000);
    const { data: booking } = await db.from('bookings').insert({
      user_id: mc.id, meeting_type_id: mt!.id, name: 'Someone', email: `other-${tag}@example.com`,
      starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + 1_800_000).toISOString(),
      timezone: 'Australia/Melbourne', source_ref: prospect!.ref_code,
    }).select('id').single();

    const r = await runAttribution(db);
    expect(r.booked).toBeGreaterThanOrEqual(1);
    const { data: ev } = await db.from('outreach_events').select('payload').eq('prospect_id', insta).eq('type', 'demo_booked').single();
    expect(ev!.payload).toMatchObject({ booking_id: booking!.id, matched_by: 'ref' });
    const { data: p } = await db.from('outreach_prospects').select('stage').eq('id', insta).single();
    expect(p!.stage).toBe('demo_booked');

    // Idempotent: a second pass doesn't double-count.
    const again = await runAttribution(db);
    const { count } = await db.from('outreach_events').select('id', { count: 'exact', head: true }).eq('prospect_id', insta).eq('type', 'demo_booked');
    expect(count).toBe(1);
    expect(again.booked).toBe(0);
  });
});
