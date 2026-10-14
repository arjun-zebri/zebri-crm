/**
 * Row fixtures for the send and reply pipeline tests, against local Supabase.
 *
 * Outreach tables are global, so every row a test makes is recorded in a
 * {@link Tracker} and removed in {@link cleanupTracked}. The settings and
 * mailbox singletons are saved by {@link saveGlobals} and put back by the
 * function it returns.
 *
 * @module tests/integration/outreach/pipeline-fixtures
 */
import type { DbClient } from '../helpers/supabase';

/** The connected mailbox the fake Gmail speaks for. */
export const OWN_EMAIL = 'outreach-owner@zebri.test';
/** Sender identity the footer must show (send_block gate). */
export const SENDER_NAME = 'Pipeline Test MC';
/** Signature with contact details, so hasContactDetails passes. */
export const SIGNATURE = 'Pipeline Test MC\nhello@zebri.test\n0412 345 678';

/** Ids to remove afterwards, collected as the test runs. */
export interface Tracker {
  tag: string;
  prospectIds: string[];
  campaignIds: string[];
  sequenceIds: string[];
  suppressedEmails: string[];
}

/** A fresh tracker, with a run-unique tag for names and addresses. */
export function newTracker(prefix: string): Tracker {
  return {
    tag: `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`,
    prospectIds: [],
    campaignIds: [],
    sequenceIds: [],
    suppressedEmails: [],
  };
}

/** Settings that make scheduling deterministic: every day, all day, no caps in the way. */
const DETERMINISTIC_SETTINGS = {
  sender_name: SENDER_NAME,
  signature: SIGNATURE,
  send_weekdays: [1, 2, 3, 4, 5, 6, 7],
  send_window_start: '00:00',
  send_window_end: '23:59',
  email_ramp: [],
  // The table's ceiling (check constraint); far above what one file sends.
  email_daily_cap: 200,
  sending_paused: false,
  paused_reason: null,
  apify_monthly_budget_cents: 0,
};

/**
 * Point the singleton settings at deterministic values. Returns a function
 * that restores exactly what was there before.
 */
export async function saveGlobals(db: DbClient): Promise<() => Promise<void>> {
  const { data: settings, error: sErr } = await db.from('outreach_settings').select('*').eq('id', true).single();
  if (sErr || !settings) throw new Error(`settings: ${sErr?.message}`);
  const { data: mailbox, error: mErr } = await db.from('outreach_mailbox').select('*').eq('id', true).maybeSingle();
  if (mErr) throw new Error(`mailbox: ${mErr.message}`);

  const { error: uErr } = await db.from('outreach_settings').update(DETERMINISTIC_SETTINGS).eq('id', true);
  if (uErr) throw new Error(`settings update: ${uErr.message}`);
  // The mailbox row must exist for the poll stamp; the token is never read because the tests fake mailboxAccess.
  const { error: bErr } = await db.from('outreach_mailbox').upsert({ id: true, email: OWN_EMAIL, refresh_token_enc: 'fake-token' });
  if (bErr) throw new Error(`mailbox upsert: ${bErr.message}`);

  return async () => {
    // Put back the whole row, including ramp_started_on, which the send path may have set.
    const { id: _id, ...rest } = settings;
    void _id;
    const { error } = await db.from('outreach_settings').update(rest).eq('id', true);
    if (error) throw new Error(`settings restore: ${error.message}`);
    if (mailbox) {
      await db.from('outreach_mailbox').upsert(mailbox);
    } else {
      await db.from('outreach_mailbox').delete().eq('id', true);
    }
  };
}

/** Set the settings fields a single test needs; the caller restores with {@link saveGlobals}'s function. */
export async function patchSettings(db: DbClient, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('outreach_settings').update(patch).eq('id', true);
  if (error) throw new Error(`settings patch: ${error.message}`);
}

/** A campaign in the given status. */
export async function makeCampaign(db: DbClient, t: Tracker, status: 'active' | 'paused' = 'active'): Promise<string> {
  const { data, error } = await db.from('outreach_campaigns')
    .insert({ name: `Pipeline ${t.tag} ${status}`, status, daily_new_enrolments: 50, audience: {} })
    .select('id').single();
  if (error || !data) throw new Error(`campaign: ${error?.message}`);
  t.campaignIds.push(data.id);
  return data.id;
}

/** Two-step sequence: step 1 is a new thread, step 2 a follow-up three days after the real send. */
export async function makeSequence(db: DbClient, t: Tracker): Promise<{ sequenceId: string; step1Id: string; step2Id: string }> {
  const { data: seq, error } = await db.from('outreach_sequences').insert({ name: `Pipeline ${t.tag}` }).select('id').single();
  if (error || !seq) throw new Error(`sequence: ${error?.message}`);
  t.sequenceIds.push(seq.id);
  const { data: steps, error: stepErr } = await db.from('outreach_sequence_steps').insert([
    { sequence_id: seq.id, position: 1, channel: 'email', delay_days: 0, is_new_thread: true },
    { sequence_id: seq.id, position: 2, channel: 'email', delay_days: 3, is_new_thread: false },
  ]).select('id, position');
  if (stepErr || !steps) throw new Error(`steps: ${stepErr?.message}`);
  const step1Id = steps.find((s) => s.position === 1)!.id;
  const step2Id = steps.find((s) => s.position === 2)!.id;
  const { error: vErr } = await db.from('outreach_variants').insert([
    { step_id: step1Id, label: 'A', subject: 'Hello {{first_name|there}}', body: 'First touch', weight: 1, active: true },
    { step_id: step2Id, label: 'A', subject: 'Hello {{first_name|there}}', body: 'Following up', weight: 1, active: true },
  ]);
  if (vErr) throw new Error(`variants: ${vErr.message}`);
  return { sequenceId: seq.id, step1Id, step2Id };
}

/** A prospect with a confirmed address, ready to be mailed. */
export async function makeProspect(
  db: DbClient,
  t: Tracker,
  n: number | string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; email: string }> {
  const email = `p${n}-${t.tag}@example.com`;
  const row = {
    full_name: `Celebrant ${t.tag} ${n}`, first_name: 'Ava', dedupe_key: `${t.tag}|${n}`, ref_code: `${t.tag}${n}`.slice(0, 40),
    state: 'VIC', email, email_source: 'manual', email_check: 'ok', verdict: 'active', stage: 'new',
    ...overrides,
  };
  const { data, error } = await db.from('outreach_prospects').insert(row as never).select('id, email').single();
  if (error || !data) throw new Error(`prospect: ${error?.message}`);
  t.prospectIds.push(data.id);
  return { id: data.id, email: data.email ?? email };
}

/** An active enrolment of a prospect into a sequence. */
export async function enrol(db: DbClient, campaignId: string, prospectId: string, sequenceId: string): Promise<string> {
  const { data, error } = await db.from('outreach_enrollments')
    .insert({ campaign_id: campaignId, prospect_id: prospectId, sequence_id: sequenceId })
    .select('id').single();
  if (error || !data) throw new Error(`enrol: ${error?.message}`);
  return data.id;
}

/** A first-step email that is due now. */
export async function makeDueMessage(
  db: DbClient,
  args: { enrollmentId: string; prospectId: string; stepId: string; subject?: string; body?: string },
): Promise<string> {
  const { data, error } = await db.from('outreach_messages').insert({
    enrollment_id: args.enrollmentId, prospect_id: args.prospectId, step_id: args.stepId, channel: 'email',
    status: 'scheduled', scheduled_for: new Date(Date.now() - 60_000).toISOString(),
    subject: args.subject ?? 'Hello Ava', body: args.body ?? 'First touch',
  }).select('id').single();
  if (error || !data) throw new Error(`message: ${error?.message}`);
  return data.id;
}

/** Read one message row. */
export async function messageRow(db: DbClient, id: string) {
  const { data, error } = await db.from('outreach_messages').select('*').eq('id', id).single();
  if (error || !data) throw new Error(`message ${id}: ${error?.message}`);
  return data;
}

/** Read one prospect row. */
export async function prospectRow(db: DbClient, id: string) {
  const { data, error } = await db.from('outreach_prospects').select('*').eq('id', id).single();
  if (error || !data) throw new Error(`prospect ${id}: ${error?.message}`);
  return data;
}

/** Remove every row the tracker recorded, children first. */
export async function cleanupTracked(db: DbClient, t: Tracker): Promise<void> {
  if (t.prospectIds.length) {
    await db.from('outreach_events').delete().in('prospect_id', t.prospectIds);
    await db.from('outreach_messages').delete().in('prospect_id', t.prospectIds);
    await db.from('outreach_enrollments').delete().in('prospect_id', t.prospectIds);
    await db.from('outreach_prospects').delete().in('id', t.prospectIds);
  }
  if (t.suppressedEmails.length) {
    await db.from('outreach_suppression').delete().eq('kind', 'email').in('value', t.suppressedEmails);
  }
  if (t.campaignIds.length) await db.from('outreach_campaigns').delete().in('id', t.campaignIds);
  if (t.sequenceIds.length) await db.from('outreach_sequences').delete().in('id', t.sequenceIds);
}
