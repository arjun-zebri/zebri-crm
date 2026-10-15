/**
 * Delete a prospect, a sequence or a campaign for good.
 *
 * Each delete keeps what outreach must not lose:
 * - Opt-outs live in `outreach_suppression`, keyed by address and handle,
 *   not by prospect. Deleting a prospect never makes an opted-out person
 *   reachable again, even if they are added back.
 * - A campaign that has sent anything is kept. Its sent messages are how
 *   the reply poll finds the threads to watch, so deleting it would let a
 *   reply or a "stop" go unseen. Finishing it is the way to end it.
 * - A sequence someone has been through is kept, because their messages
 *   point at its steps. Archiving it is the way to retire it.
 *
 * @module lib/outreach/services/deletes
 */
import type { AdminDb } from '../types';

import { OutreachUserError } from './admin-ops';

/**
 * Delete a prospect with their enrolments, messages, checks and history
 * (the foreign keys cascade). Their suppression rows stay.
 */
export async function deleteProspect(db: AdminDb, id: string): Promise<void> {
  const { data, error } = await db.from('outreach_prospects').delete().eq('id', id).select('id');
  if (error) throw new Error(`delete prospect: ${error.message}`);
  if (!data?.length) throw new OutreachUserError('That prospect is already gone.');
}

/**
 * Delete a sequence with its steps and variants. Refused while a campaign
 * uses it, and once anyone has been enrolled in it.
 */
export async function deleteSequence(db: AdminDb, id: string): Promise<void> {
  const { count: arms, error: aErr } = await db
    .from('outreach_campaign_arms').select('campaign_id', { count: 'exact', head: true }).eq('sequence_id', id);
  if (aErr) throw new Error(`sequence arms: ${aErr.message}`);
  if (arms) throw new OutreachUserError('That sequence is used by a campaign. Remove it from the campaign first.');

  const { count: enrolled, error: eErr } = await db
    .from('outreach_enrollments').select('id', { count: 'exact', head: true }).eq('sequence_id', id);
  if (eErr) throw new Error(`sequence enrolments: ${eErr.message}`);
  if (enrolled) throw new OutreachUserError('People have been through this sequence, so its history is kept. Archive it instead.');

  const { data, error } = await db.from('outreach_sequences').delete().eq('id', id).select('id');
  if (error) throw new Error(`delete sequence: ${error.message}`);
  if (!data?.length) throw new OutreachUserError('That sequence is already gone.');
}

/**
 * Delete a campaign with its arms, enrolments and unsent messages.
 * Refused while it is active (a send could be claimed mid-delete) and once
 * any message in it has gone out (see the module comment).
 */
export async function deleteCampaign(db: AdminDb, id: string): Promise<void> {
  const { data: campaign, error: cErr } = await db.from('outreach_campaigns').select('status').eq('id', id).maybeSingle();
  if (cErr) throw new Error(`campaign: ${cErr.message}`);
  if (!campaign) throw new OutreachUserError('That campaign is already gone.');
  if (campaign.status === 'active') throw new OutreachUserError('Pause or finish this campaign before deleting it.');

  const { count: sent, error: sErr } = await db
    .from('outreach_messages')
    .select('id, outreach_enrollments!inner(campaign_id)', { count: 'exact', head: true })
    .eq('outreach_enrollments.campaign_id', id)
    .in('status', ['sent', 'sending']);
  if (sErr) throw new Error(`campaign sends: ${sErr.message}`);
  if (sent) {
    throw new OutreachUserError('Messages from this campaign have gone out, so it is kept to catch replies and opt-outs. Finish it instead.');
  }

  const { error } = await db.from('outreach_campaigns').delete().eq('id', id);
  if (error) throw new Error(`delete campaign: ${error.message}`);
}
