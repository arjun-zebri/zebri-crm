/**
 * Write to the outreach timeline and apply the stage / stop rules that
 * follow from what happened.
 *
 * Every state change in outreach goes through here so the event log
 * stays complete: analytics reads only events and messages, so anything
 * not recorded here is invisible to the founder's experiments.
 *
 * @module lib/outreach/services/events
 */
import type { Json } from '@/types/database';

import { canAutoAdvance, type AdminDb, type EventType, type Stage } from '../types';

import { suppressAddress } from './suppression';

/** One event to record. */
export interface EventInput {
  prospectId: string | null;
  type: EventType;
  channel?: 'email' | 'instagram' | null;
  campaignId?: string | null;
  enrollmentId?: string | null;
  messageId?: string | null;
  actor?: 'system' | 'admin';
  payload?: Record<string, unknown>;
}

/** Append events. Throws on failure: a silently lost event corrupts analytics. */
export async function recordEvents(db: AdminDb, events: EventInput[]): Promise<void> {
  if (events.length === 0) return;
  const { error } = await db.from('outreach_events').insert(
    events.map((e) => ({
      prospect_id: e.prospectId,
      type: e.type,
      channel: e.channel ?? null,
      campaign_id: e.campaignId ?? null,
      enrollment_id: e.enrollmentId ?? null,
      message_id: e.messageId ?? null,
      actor: e.actor ?? 'system',
      payload: (e.payload ?? {}) as Json,
    })),
  );
  if (error) throw new Error(`outreach_events insert: ${error.message}`);
}

/** Append one event. */
export function recordEvent(db: AdminDb, event: EventInput): Promise<void> {
  return recordEvents(db, [event]);
}

/**
 * Move a prospect forward along the funnel if automation is allowed to
 * (see {@link canAutoAdvance}). Returns true when the stage changed.
 */
export async function autoAdvance(db: AdminDb, prospectId: string, to: Stage): Promise<boolean> {
  const { data: p, error } = await db.from('outreach_prospects').select('stage').eq('id', prospectId).single();
  if (error || !p) throw new Error(`prospect ${prospectId}: ${error?.message ?? 'not found'}`);
  if (!canAutoAdvance(p.stage as Stage, to)) return false;
  // Conditional on the stage we read, so two passes can't double-advance.
  const { data: updated, error: upErr } = await db
    .from('outreach_prospects')
    .update({ stage: to, updated_at: new Date().toISOString() })
    .eq('id', prospectId)
    .eq('stage', p.stage)
    .select('id');
  if (upErr) throw new Error(`advance stage: ${upErr.message}`);
  if (!updated?.length) return false;
  await recordEvent(db, { prospectId, type: 'stage_changed', payload: { from: p.stage, to, auto: true } });
  return true;
}

/** Why an enrolment stopped. */
export type StopReason = 'replied' | 'booked' | 'signed_up' | 'opted_out' | 'bounced' | 'manual' | 'cant_dm';

/**
 * Stop the prospect's active enrolment (if any) and cancel its pending
 * messages. Returns the stopped enrolment id, or null when none was live.
 */
export async function stopActiveEnrollment(db: AdminDb, prospectId: string, reason: StopReason, actor: 'system' | 'admin' = 'system'): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('outreach_enrollments')
    .update({ status: 'stopped', stop_reason: reason, stopped_at: now })
    .eq('prospect_id', prospectId)
    .eq('status', 'active')
    .select('id, campaign_id');
  if (error) throw new Error(`stop enrollment: ${error.message}`);
  const stopped = data?.[0];
  if (!stopped) return null;
  const { error: cancelErr } = await db
    .from('outreach_messages')
    .update({ status: 'cancelled', skip_reason: reason })
    .eq('enrollment_id', stopped.id)
    .eq('status', 'scheduled');
  if (cancelErr) throw new Error(`cancel messages: ${cancelErr.message}`);
  await recordEvent(db, {
    prospectId,
    type: 'sequence_stopped',
    enrollmentId: stopped.id,
    campaignId: stopped.campaign_id,
    actor,
    payload: { reason },
  });
  return stopped.id;
}

/** Cancel only the pending email steps (after a bounce); IG steps continue. */
export async function cancelPendingEmails(db: AdminDb, prospectId: string, reason: string): Promise<number> {
  const { data, error } = await db
    .from('outreach_messages')
    .update({ status: 'cancelled', skip_reason: reason })
    .eq('prospect_id', prospectId)
    .eq('channel', 'email')
    .eq('status', 'scheduled')
    .select('id');
  if (error) throw new Error(`cancel emails: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Permanently opt a prospect out of every channel: the global suppression
 * list, flag, stop, stage, event. Idempotent.
 */
export async function optOut(db: AdminDb, prospectId: string, source: string, actor: 'system' | 'admin' = 'system'): Promise<void> {
  const now = new Date().toISOString();
  const { data: who, error: whoErr } = await db
    .from('outreach_prospects')
    .select('email, instagram_handle')
    .eq('id', prospectId)
    .maybeSingle();
  if (whoErr) throw new Error(`opt out lookup: ${whoErr.message}`);
  if (!who) return;
  // Why first: the global list is what blocks the address on every other prospect row,
  // so it must be written before the flag. If this write fails, nothing else has changed.
  await suppressAddress(db, { email: who.email, instagram: who.instagram_handle }, 'opted_out', source);
  const { data, error } = await db
    .from('outreach_prospects')
    .update({ do_not_contact: true, opted_out_at: now, stage: 'opted_out', updated_at: now })
    .eq('id', prospectId)
    .eq('do_not_contact', false)
    .select('id');
  if (error) throw new Error(`opt out: ${error.message}`);
  await stopActiveEnrollment(db, prospectId, 'opted_out', actor);
  if (data?.length) await recordEvent(db, { prospectId, type: 'opted_out', actor, payload: { source } });
}
