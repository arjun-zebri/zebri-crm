/**
 * Deleting a prospect, a sequence or a campaign against local Supabase:
 * what each delete takes with it, what it must keep (suppression rows,
 * sent history), and when it refuses.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { OutreachUserError } from '@/lib/outreach/services/admin-ops';
import { deleteCampaign, deleteProspect, deleteSequence } from '@/lib/outreach/services/deletes';

import { serviceClient } from '../helpers/supabase';

import { cleanupTracked, enrol, makeCampaign, makeDueMessage, makeProspect, makeSequence, newTracker, type Tracker } from './pipeline-fixtures';

const db = serviceClient();
let t: Tracker;

beforeAll(() => {
  t = newTracker('del');
});

afterAll(async () => {
  await cleanupTracked(db, t);
});

async function count(table: 'outreach_enrollments' | 'outreach_messages' | 'outreach_events', column: string, value: string) {
  const { count: n, error } = await db.from(table).select('id', { count: 'exact', head: true }).eq(column, value);
  if (error) throw new Error(`${table}: ${error.message}`);
  return n ?? 0;
}

/** A prospect enrolled in a fresh campaign and sequence, with one message in `status`. */
async function enrolled(n: string, status: 'scheduled' | 'sent', campaignStatus: 'active' | 'paused' = 'paused') {
  const campaignId = await makeCampaign(db, t, campaignStatus);
  const { sequenceId, step1Id } = await makeSequence(db, t);
  const { error: aErr } = await db.from('outreach_campaign_arms').insert({ campaign_id: campaignId, sequence_id: sequenceId, weight: 1 });
  if (aErr) throw new Error(`arm: ${aErr.message}`);
  const p = await makeProspect(db, t, n);
  const enrollmentId = await enrol(db, campaignId, p.id, sequenceId);
  const messageId = await makeDueMessage(db, { enrollmentId, prospectId: p.id, stepId: step1Id });
  if (status === 'sent') {
    const { error } = await db.from('outreach_messages').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', messageId);
    if (error) throw new Error(`mark sent: ${error.message}`);
  }
  await db.from('outreach_events').insert({ prospect_id: p.id, type: 'enrolled', actor: 'system', campaign_id: campaignId, enrollment_id: enrollmentId });
  return { campaignId, sequenceId, prospect: p, enrollmentId, messageId };
}

describe('deleteProspect', () => {
  it('removes the prospect with their enrolments, messages and history', async () => {
    const x = await enrolled('p1', 'sent');
    await deleteProspect(db, x.prospect.id);

    const { data } = await db.from('outreach_prospects').select('id').eq('id', x.prospect.id);
    expect(data).toEqual([]);
    expect(await count('outreach_enrollments', 'prospect_id', x.prospect.id)).toBe(0);
    expect(await count('outreach_messages', 'prospect_id', x.prospect.id)).toBe(0);
    expect(await count('outreach_events', 'prospect_id', x.prospect.id)).toBe(0);
  });

  it('keeps their opt-out, so adding them back cannot make them reachable', async () => {
    const p = await makeProspect(db, t, 'p2');
    t.suppressedEmails.push(p.email);
    const { error } = await db.from('outreach_suppression').insert({ kind: 'email', value: p.email, reason: 'opted_out', source: 'test' });
    if (error) throw new Error(`suppress: ${error.message}`);

    await deleteProspect(db, p.id);
    const { data } = await db.from('outreach_suppression').select('reason').eq('kind', 'email').eq('value', p.email);
    expect(data).toEqual([{ reason: 'opted_out' }]);
  });

  it('says so when the prospect is already gone', async () => {
    await expect(deleteProspect(db, crypto.randomUUID())).rejects.toThrow(OutreachUserError);
  });
});

describe('deleteSequence', () => {
  it('deletes an unused sequence with its steps and variants', async () => {
    const { sequenceId, step1Id } = await makeSequence(db, t);
    await deleteSequence(db, sequenceId);
    const { data: steps } = await db.from('outreach_sequence_steps').select('id').eq('sequence_id', sequenceId);
    const { data: variants } = await db.from('outreach_variants').select('id').eq('step_id', step1Id);
    expect(steps).toEqual([]);
    expect(variants).toEqual([]);
  });

  it('refuses while a campaign uses it', async () => {
    const x = await enrolled('s1', 'scheduled');
    await expect(deleteSequence(db, x.sequenceId)).rejects.toThrow('used by a campaign');
  });

  it('refuses once anyone has been through it, even after the campaign dropped it', async () => {
    const x = await enrolled('s2', 'scheduled');
    await db.from('outreach_campaign_arms').delete().eq('sequence_id', x.sequenceId);
    await expect(deleteSequence(db, x.sequenceId)).rejects.toThrow('Archive it instead');
  });
});

describe('deleteCampaign', () => {
  it('deletes a campaign that has sent nothing, with its enrolments and unsent messages', async () => {
    const x = await enrolled('c1', 'scheduled');
    await deleteCampaign(db, x.campaignId);

    const { data } = await db.from('outreach_campaigns').select('id').eq('id', x.campaignId);
    expect(data).toEqual([]);
    expect(await count('outreach_enrollments', 'id', x.enrollmentId)).toBe(0);
    expect(await count('outreach_messages', 'id', x.messageId)).toBe(0);
    // The prospect stays, and their history keeps the event with the campaign link cleared.
    const { data: events } = await db.from('outreach_events').select('campaign_id').eq('prospect_id', x.prospect.id);
    expect(events).toEqual([{ campaign_id: null }]);
  });

  it('refuses once a message has gone out, so replies to it are still caught', async () => {
    const x = await enrolled('c2', 'sent');
    await expect(deleteCampaign(db, x.campaignId)).rejects.toThrow('Finish it instead');
    expect(await count('outreach_messages', 'id', x.messageId)).toBe(1);
  });

  it('refuses while the campaign is active', async () => {
    const x = await enrolled('c3', 'scheduled', 'active');
    await expect(deleteCampaign(db, x.campaignId)).rejects.toThrow('Pause or finish');
  });

  it('can delete the campaign once its contacted prospect is deleted', async () => {
    // The clean-up path for a test run: delete the test prospect, then its campaign.
    const x = await enrolled('c4', 'sent');
    await deleteProspect(db, x.prospect.id);
    await deleteCampaign(db, x.campaignId);
    const { data } = await db.from('outreach_campaigns').select('id').eq('id', x.campaignId);
    expect(data).toEqual([]);
  });
});
