/**
 * The founder's manual operations: edit a prospect, log touches, work
 * the IG queue, and save sequences, campaigns and settings.
 *
 * Every change writes an `actor: 'admin'` event so the timeline shows
 * what was automated and what was done by hand.
 *
 * @module lib/outreach/services/admin-ops
 */
import { checkEmail } from '../checks/email-check';
import { normaliseInstagram, normaliseWebsite } from '../import/normalise';
import { activationProblems } from '../readiness';
import { templateFields } from '../render';
import type { AdminDb, ProspectUpdate, Stage } from '../types';

import { autoAdvance, optOut, recordEvent, recordEvents, stopActiveEnrollment, type EventInput } from './events';
import { loadReadinessFacts, templateUsage } from './readiness';
import { advanceAfter, loadScheduleContext, markIgSent } from './sequencer';

/** A user-facing failure (shown in a toast), as opposed to a bug. */
export class OutreachUserError extends Error {}

// ───── Prospects ──────────────────────────────────────────────────────

/** Fields the drawer can edit. */
export interface ProspectPatch {
  email?: string | null | undefined;
  instagram_handle?: string | null | undefined;
  website?: string | null | undefined;
  phone?: string | null | undefined;
  notes?: string | null | undefined;
  stage?: Stage | undefined;
  reply_sentiment?: 'positive' | 'neutral' | 'negative' | null | undefined;
  lost_reason?: string | null | undefined;
  do_not_contact?: boolean | undefined;
  /** True when the founder has checked a scraped address and vouches for it. Sets the email to manual. */
  confirm_email?: boolean | undefined;
}

/** Apply a drawer edit, logging each meaningful change. */
export async function updateProspect(db: AdminDb, id: string, patch: ProspectPatch): Promise<void> {
  const { data: current, error } = await db.from('outreach_prospects').select('*').eq('id', id).single();
  if (error || !current) throw new OutreachUserError('Prospect not found.');
  const update: ProspectUpdate = { updated_at: new Date().toISOString() };
  const events: EventInput[] = [];

  if (patch.email !== undefined && patch.email !== current.email) {
    update.email = patch.email?.toLowerCase() ?? null;
    update.email_source = patch.email ? 'manual' : null;
    update.email_check = 'unverified';
    if (update.email) {
      update.email_check = await checkEmail(update.email).catch(() => 'unverified' as const);
      update.email_checked_at = new Date().toISOString();
    }
  }
  if (patch.confirm_email === true) {
    const address = update.email !== undefined ? update.email : current.email;
    if (!address) throw new OutreachUserError('There is no email to confirm.');
    // Why: a scraped address is only a suggestion until the founder vouches for it. The
    // send path and the arms ignore 'found' emails, so this is the one way one becomes mailable.
    update.email_source = 'manual';
    events.push({ prospectId: id, type: 'manual_touch', actor: 'admin', payload: { kind: 'email_confirmed', email: address } });
  }
  if (patch.instagram_handle !== undefined) {
    const handle = patch.instagram_handle ? normaliseInstagram(patch.instagram_handle) : null;
    if (handle !== current.instagram_handle) {
      update.instagram_handle = handle;
      update.instagram_source = handle ? 'manual' : null;
      update.ig_status = null;
      update.ig_checked_at = null;
    }
  }
  if (patch.website !== undefined) {
    const site = patch.website ? normaliseWebsite(patch.website) : null;
    if (patch.website && !site) throw new OutreachUserError("That doesn't look like a website address.");
    update.website = site;
    update.website_source = site ? 'manual' : null;
  }
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.notes !== undefined && patch.notes !== current.notes) {
    update.notes = patch.notes;
    events.push({ prospectId: id, type: 'note_added', actor: 'admin' });
  }
  if (patch.reply_sentiment !== undefined && patch.reply_sentiment !== current.reply_sentiment) {
    update.reply_sentiment = patch.reply_sentiment;
    events.push({ prospectId: id, type: 'sentiment_set', actor: 'admin', payload: { sentiment: patch.reply_sentiment } });
  }
  if (patch.lost_reason !== undefined) update.lost_reason = patch.lost_reason as Exclude<ProspectUpdate['lost_reason'], undefined>;
  // 'opted_out' goes through optOut() below, which also stops the sends.
  // Writing the stage here would leave a prospect marked opted out who is
  // still being emailed.
  if (patch.stage !== undefined && patch.stage !== current.stage && patch.stage !== 'opted_out') {
    update.stage = patch.stage;
    events.push({ prospectId: id, type: 'stage_changed', actor: 'admin', payload: { from: current.stage, to: patch.stage } });
  }

  const { error: upErr } = await db.from('outreach_prospects').update(update).eq('id', id);
  if (upErr) throw new Error(`update prospect: ${upErr.message}`);
  await recordEvents(db, events);

  if (patch.stage === 'lost') await stopActiveEnrollment(db, id, 'manual', 'admin');
  if (patch.stage === 'opted_out' && current.stage !== 'opted_out') await optOut(db, id, 'manual', 'admin');
  if (patch.do_not_contact === true && !current.do_not_contact) await optOut(db, id, 'manual', 'admin');
  if (patch.do_not_contact === false && current.do_not_contact) await undoOptOut(db, id);
}

/** Reverse an opt-out (a false positive from the STOP detector). */
export async function undoOptOut(db: AdminDb, id: string): Promise<void> {
  const { error } = await db
    .from('outreach_prospects')
    .update({ do_not_contact: false, opted_out_at: null, stage: 'replied', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`undo opt-out: ${error.message}`);
  await recordEvent(db, { prospectId: id, type: 'opt_out_undone', actor: 'admin' });
}

/** Override verdicts by hand; re-runs never overwrite these. */
export async function setVerdicts(db: AdminDb, ids: string[], verdict: 'active' | 'inactive' | 'needs_review'): Promise<void> {
  const { data: before } = await db.from('outreach_prospects').select('id, verdict').in('id', ids);
  const { error } = await db
    .from('outreach_prospects')
    .update({ verdict, verdict_source: 'manual', verdict_reason: 'manual', updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(`set verdicts: ${error.message}`);
  await recordEvents(db, (before ?? []).filter((p) => p.verdict !== verdict).map((p) => ({
    prospectId: p.id, type: 'verdict_changed' as const, actor: 'admin' as const, payload: { from: p.verdict, to: verdict, reason: 'manual' },
  })));
}

/** Record a touch Zebri can't see (call, IG comment, ...). */
export async function logTouch(db: AdminDb, id: string, kind: string, note?: string): Promise<void> {
  await recordEvent(db, { prospectId: id, type: 'manual_touch', actor: 'admin', payload: { kind, note: note ?? null } });
}

/** Mark a reply that arrived outside Gmail (IG DM, phone). Stops the sequence. */
export async function markReplied(db: AdminDb, id: string, channel: 'instagram' | 'email' | 'other', note?: string): Promise<void> {
  await recordEvent(db, {
    prospectId: id, type: 'replied', channel: channel === 'other' ? null : channel, actor: 'admin',
    payload: { manual: true, snippet: note?.slice(0, 280) ?? null },
  });
  await stopActiveEnrollment(db, id, 'replied', 'admin');
  await autoAdvance(db, id, 'replied');
}

/** Link a prospect to an existing Zebri account. */
export async function linkUser(db: AdminDb, id: string, email: string): Promise<void> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`list users: ${error.message}`);
    const user = data.users.find((u) => u.email?.toLowerCase() === target);
    if (user) {
      await db.from('outreach_prospects').update({ linked_user_id: user.id }).eq('id', id);
      await recordEvent(db, { prospectId: id, type: 'linked_user', actor: 'admin', payload: { user_id: user.id } });
      await recordEvent(db, { prospectId: id, type: 'signed_up', actor: 'admin', payload: { user_id: user.id, matched_by: 'manual' } });
      await autoAdvance(db, id, 'signed_up');
      return;
    }
    if (data.users.length < 200) break;
  }
  throw new OutreachUserError('No Zebri account has that email.');
}

// ───── IG queue ───────────────────────────────────────────────────────

async function scheduledIg(db: AdminDb, messageId: string) {
  const { data, error } = await db.from('outreach_messages').select('*').eq('id', messageId).eq('channel', 'instagram').single();
  if (error || !data) throw new OutreachUserError('That DM is no longer in the queue.');
  return data;
}

/** The founder copied the DM and opened the profile. */
export async function igCopied(db: AdminDb, messageId: string): Promise<void> {
  const m = await scheduledIg(db, messageId);
  await recordEvent(db, { prospectId: m.prospect_id, type: 'ig_copied', channel: 'instagram', actor: 'admin', messageId, enrollmentId: m.enrollment_id });
}

/**
 * Why a DM is no longer waiting, in words the founder can act on. The
 * Today queue can be stale (a reply arrived after the page loaded), and
 * "Something went wrong" for a DM that was cancelled on purpose reads as
 * a bug.
 */
function notWaitingMessage(m: { status: string; skip_reason: string | null }): string {
  if (m.status === 'sent') return 'That DM is already marked sent.';
  if (m.skip_reason === 'replied') return 'They replied, so this DM was cancelled. No need to send it.';
  if (m.skip_reason === 'opted_out') return 'They opted out, so this DM was cancelled.';
  if (m.status === 'skipped') return 'That DM was skipped.';
  return 'That DM is no longer waiting to be sent.';
}

/** The DM went out. */
export async function igSent(db: AdminDb, messageId: string): Promise<void> {
  const m = await scheduledIg(db, messageId);
  if (m.status !== 'scheduled') throw new OutreachUserError(notWaitingMessage(m));
  await markIgSent(db, messageId);
}

/** Skip this DM and move on to the next step. */
export async function igSkip(db: AdminDb, messageId: string, reason: string): Promise<void> {
  const m = await scheduledIg(db, messageId);
  if (m.status !== 'scheduled') throw new OutreachUserError(notWaitingMessage(m));
  await db.from('outreach_messages').update({ status: 'skipped', skip_reason: reason }).eq('id', messageId);
  await recordEvent(db, { prospectId: m.prospect_id, type: 'ig_skipped', channel: 'instagram', actor: 'admin', messageId, enrollmentId: m.enrollment_id, payload: { reason } });
  await advanceFromMessage(db, m.enrollment_id, m.prospect_id, m.step_id);
}

/** The account doesn't accept DMs: no more IG steps for this person. */
export async function igCantDm(db: AdminDb, messageId: string): Promise<void> {
  const m = await scheduledIg(db, messageId);
  if (m.status !== 'scheduled') throw new OutreachUserError(notWaitingMessage(m));
  await db.from('outreach_messages').update({ status: 'skipped', skip_reason: 'cant_dm' }).eq('id', messageId);
  // Marking the IG status private removes the channel; later IG steps are skipped.
  await db.from('outreach_prospects').update({ ig_status: 'private' }).eq('id', m.prospect_id);
  await recordEvent(db, { prospectId: m.prospect_id, type: 'ig_cant_dm', channel: 'instagram', actor: 'admin', messageId, enrollmentId: m.enrollment_id });
  await advanceFromMessage(db, m.enrollment_id, m.prospect_id, m.step_id);
  const { count } = await db.from('outreach_messages').select('id', { count: 'exact', head: true }).eq('enrollment_id', m.enrollment_id).eq('status', 'scheduled');
  if (!count) {
    const { data: e } = await db.from('outreach_enrollments').select('status').eq('id', m.enrollment_id).single();
    if (e?.status === 'active') await stopActiveEnrollment(db, m.prospect_id, 'cant_dm', 'admin');
  }
}

/** Schedule the step after a skipped one (no send happened, so no `afterSend`). */
async function advanceFromMessage(db: AdminDb, enrollmentId: string, prospectId: string, stepId: string): Promise<void> {
  const [{ data: enrollment }, { data: prospect }, { data: step }] = await Promise.all([
    db.from('outreach_enrollments').select('*').eq('id', enrollmentId).single(),
    db.from('outreach_prospects').select('*').eq('id', prospectId).single(),
    db.from('outreach_sequence_steps').select('*').eq('id', stepId).single(),
  ]);
  if (!enrollment || !prospect || !step) return;
  await advanceAfter(db, await loadScheduleContext(db), enrollment, prospect, step.position, new Date());
}

/** Put a failed email back in the queue for the next tick. */
export async function retryMessage(db: AdminDb, messageId: string): Promise<void> {
  const { data, error } = await db
    .from('outreach_messages')
    .update({ status: 'scheduled', attempts: 0, error: null, scheduled_for: new Date().toISOString() })
    .eq('id', messageId).eq('status', 'failed')
    .select('id');
  if (error) throw new Error(`retry: ${error.message}`);
  if (!data?.length) throw new OutreachUserError('That message is not in a failed state.');
}

// ───── Sequences ──────────────────────────────────────────────────────

/** A sequence as the editor submits it. */
export interface SequenceInput {
  id?: string | undefined;
  name: string;
  steps: {
    id?: string | undefined;
    channel: 'email' | 'instagram';
    delay_days: number;
    is_new_thread: boolean;
    variants: { id?: string | undefined; label: string; subject: string | null; body: string; weight: number; active: boolean }[];
  }[];
}

/** Validation problems the editor shows before saving. */
export function sequenceProblems(input: SequenceInput): string[] {
  const problems: string[] = [];
  input.steps.forEach((step, i) => {
    step.variants.forEach((v) => {
      const unknown = [...templateFields(v.body).unknown, ...templateFields(v.subject ?? '').unknown];
      if (unknown.length) problems.push(`Step ${i + 1}, variant ${v.label}: unknown field ${unknown.map((u) => `{{${u}}}`).join(', ')}.`);
      if (step.channel === 'email' && (i === 0 || step.is_new_thread) && !v.subject?.trim()) {
        problems.push(`Step ${i + 1}, variant ${v.label}: an email that starts a thread needs a subject.`);
      }
    });
    if (!step.variants.some((v) => v.active && v.weight > 0)) problems.push(`Step ${i + 1} has no active variant.`);
  });
  return problems;
}

/**
 * Save a sequence with replace semantics. Steps and variants that have
 * already been sent can't be deleted (their history anchors analytics);
 * variants are deactivated instead, and steps must stay.
 */
export async function saveSequence(db: AdminDb, input: SequenceInput): Promise<string> {
  const problems = sequenceProblems(input);
  if (problems.length) throw new OutreachUserError(problems[0]!);

  let sequenceId = input.id;
  if (sequenceId) {
    const { error } = await db.from('outreach_sequences').update({ name: input.name, updated_at: new Date().toISOString() }).eq('id', sequenceId);
    if (error) throw new Error(`update sequence: ${error.message}`);
  } else {
    const { data, error } = await db.from('outreach_sequences').insert({ name: input.name }).select('id').single();
    if (error || !data) throw new Error(`create sequence: ${error?.message}`);
    sequenceId = data.id;
  }

  const { data: existingSteps } = await db.from('outreach_sequence_steps').select('id').eq('sequence_id', sequenceId);
  const keepStepIds = new Set(input.steps.map((s) => s.id).filter(Boolean));
  const removed = (existingSteps ?? []).filter((s) => !keepStepIds.has(s.id)).map((s) => s.id);
  if (removed.length) {
    const { count } = await db.from('outreach_messages').select('id', { count: 'exact', head: true }).in('step_id', removed);
    if (count) throw new OutreachUserError('A step that has already sent messages can\'t be removed. Turn its variants off instead, or make a new sequence.');
    await db.from('outreach_sequence_steps').delete().in('id', removed);
  }

  // Positions are unique per sequence: park existing steps out of the way first.
  for (const s of existingSteps ?? []) {
    if (keepStepIds.has(s.id)) await db.from('outreach_sequence_steps').update({ position: 1000 + Math.floor(Math.random() * 100000) }).eq('id', s.id);
  }

  for (const [i, step] of input.steps.entries()) {
    let stepId = step.id;
    const fields = { position: i + 1, channel: step.channel, delay_days: step.delay_days, is_new_thread: step.is_new_thread };
    if (stepId) {
      const { error } = await db.from('outreach_sequence_steps').update(fields).eq('id', stepId).eq('sequence_id', sequenceId);
      if (error) throw new Error(`update step: ${error.message}`);
    } else {
      const { data, error } = await db.from('outreach_sequence_steps').insert({ sequence_id: sequenceId, ...fields }).select('id').single();
      if (error || !data) throw new Error(`create step: ${error?.message}`);
      stepId = data.id;
    }

    const { data: existingVariants } = await db.from('outreach_variants').select('id').eq('step_id', stepId);
    const keepVariantIds = new Set(step.variants.map((v) => v.id).filter(Boolean));
    for (const v of existingVariants ?? []) {
      if (keepVariantIds.has(v.id)) continue;
      const { count } = await db.from('outreach_messages').select('id', { count: 'exact', head: true }).eq('variant_id', v.id);
      if (count) await db.from('outreach_variants').update({ active: false }).eq('id', v.id);
      else await db.from('outreach_variants').delete().eq('id', v.id);
    }
    for (const v of step.variants) {
      const row = { label: v.label, subject: step.channel === 'email' ? v.subject : null, body: v.body, weight: v.weight, active: v.active };
      if (v.id) {
        const { error } = await db.from('outreach_variants').update(row).eq('id', v.id).eq('step_id', stepId);
        if (error) throw new Error(`update variant: ${error.message}`);
      } else {
        const { error } = await db.from('outreach_variants').insert({ step_id: stepId, ...row });
        if (error) throw new Error(`create variant: ${error.message}`);
      }
    }
  }
  return sequenceId;
}

/** Archive a sequence (kept for analytics; hidden from editors). */
export async function archiveSequence(db: AdminDb, id: string): Promise<void> {
  const { count } = await db.from('outreach_campaign_arms').select('campaign_id', { count: 'exact', head: true }).eq('sequence_id', id);
  if (count) throw new OutreachUserError('That sequence is used by a campaign. Remove it from the campaign first.');
  const { error } = await db.from('outreach_sequences').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`archive: ${error.message}`);
}

// ───── Campaigns ──────────────────────────────────────────────────────

/** A campaign as the editor submits it. */
export interface CampaignInput {
  id?: string | undefined;
  name: string;
  audience: { states?: string[] | undefined; minScore?: number | undefined };
  daily_new_enrolments: number;
  arms: { sequence_id: string; weight: number }[];
}

/** Create or update a campaign and replace its arms. */
export async function saveCampaign(db: AdminDb, input: CampaignInput): Promise<string> {
  const audience = {
    ...(input.audience.states?.length ? { states: input.audience.states } : {}),
    ...(input.audience.minScore !== undefined ? { minScore: input.audience.minScore } : {}),
  };
  let campaignId = input.id;
  if (campaignId) {
    const { error } = await db.from('outreach_campaigns').update({ name: input.name, audience, daily_new_enrolments: input.daily_new_enrolments }).eq('id', campaignId);
    if (error) throw new Error(`update campaign: ${error.message}`);
  } else {
    const { data, error } = await db.from('outreach_campaigns').insert({ name: input.name, audience, daily_new_enrolments: input.daily_new_enrolments }).select('id').single();
    if (error || !data) throw new Error(`create campaign: ${error?.message}`);
    campaignId = data.id;
  }
  await db.from('outreach_campaign_arms').delete().eq('campaign_id', campaignId);
  const { error: armErr } = await db.from('outreach_campaign_arms').insert(input.arms.map((a) => ({ campaign_id: campaignId!, ...a })));
  if (armErr) throw new Error(`arms: ${armErr.message}`);
  return campaignId;
}

/**
 * Activate, pause or finish a campaign. Activation checks the things
 * that would otherwise fail silently later: a mailbox and a Spam Act
 * signature for email arms, a booking page when a template links to it.
 */
export async function setCampaignStatus(db: AdminDb, id: string, status: 'active' | 'paused' | 'finished'): Promise<void> {
  if (status === 'active') {
    const { data: arms } = await db.from('outreach_campaign_arms').select('sequence_id').eq('campaign_id', id);
    const seqIds = (arms ?? []).map((a) => a.sequence_id);
    if (seqIds.length === 0) throw new OutreachUserError('Add a sequence before activating.');
    // Why: the same rules the Ready to send checklist shows, so the toast never names a
    // problem the checklist did not already show.
    const [first] = activationProblems({ ...(await loadReadinessFacts(db)), ...(await templateUsage(db, seqIds)) });
    if (first) throw new OutreachUserError(first);
  }
  const { error } = await db
    .from('outreach_campaigns')
    .update({ status, ...(status === 'active' ? { activated_at: new Date().toISOString() } : {}) })
    .eq('id', id);
  if (error) throw new Error(`campaign status: ${error.message}`);
  if (status === 'finished') {
    const { data: live } = await db.from('outreach_enrollments').select('prospect_id').eq('campaign_id', id).eq('status', 'active');
    for (const e of live ?? []) await stopActiveEnrollment(db, e.prospect_id, 'manual', 'admin');
  }
}
