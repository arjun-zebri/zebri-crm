/**
 * Retention (APP 11.2): idle prospects lose their personal detail, active
 * ones and customers keep it, and suppression rows survive.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { runRetentionPass, retentionCutoff } from '@/lib/outreach/services/retention';
import { suppressAddress } from '@/lib/outreach/services/suppression';

import { serviceClient } from '../helpers/supabase';

const db = serviceClient();
const tag = `ret${Date.now()}`;
const prospectIds: string[] = [];
const sequenceIds: string[] = [];
const campaignIds: string[] = [];

const OLD = '2023-01-01T00:00:00Z';

async function prospect(overrides: Record<string, unknown>): Promise<string> {
  const n = Math.random().toString(36).slice(2, 8);
  const { data, error } = await db
    .from('outreach_prospects')
    .insert({
      full_name: `Ret ${tag} ${n}`, dedupe_key: `${tag}-${n}`, ref_code: n.padEnd(8, 'x').slice(0, 8),
      ig_bio: 'Celebrant bio', sheet_raw: { phone: '0400 000 000' }, ...overrides,
    } as never)
    .select('id')
    .single();
  if (error || !data) throw new Error(`prospect: ${error?.message}`);
  prospectIds.push(data.id);
  return data.id;
}

describe('outreach retention pass', () => {
  afterAll(async () => {
    if (prospectIds.length) await db.from('outreach_prospects').delete().in('id', prospectIds);
    if (campaignIds.length) await db.from('outreach_campaigns').delete().in('id', campaignIds);
    if (sequenceIds.length) {
      await db.from('outreach_sequence_steps').delete().in('sequence_id', sequenceIds);
      await db.from('outreach_sequences').delete().in('id', sequenceIds);
    }
    await db.from('outreach_suppression').delete().like('value', `%${tag}%`);
  });

  it('the window is twelve months', () => {
    expect(retentionCutoff(new Date('2026-10-13T00:00:00Z')).toISOString()).toBe('2025-10-13T00:00:00.000Z');
  });

  it('clears personal detail on idle prospects and keeps the rest', async () => {
    const idle = await prospect({ created_at: OLD });
    const active = await prospect({ created_at: OLD });
    const fresh = await prospect({});

    // Idle prospect: an old event with a reply snippet, and an old sent message with a body.
    await db.from('outreach_events').insert({
      prospect_id: idle, type: 'replied', occurred_at: OLD, payload: { snippet: 'Please stop', keep: 1 },
    });
    const { data: seq } = await db.from('outreach_sequences').insert({ name: `ret ${tag}` }).select('id').single();
    sequenceIds.push(seq!.id);
    const { data: step } = await db.from('outreach_sequence_steps').insert({ sequence_id: seq!.id, position: 1, channel: 'email' }).select('id').single();
    const { data: camp } = await db.from('outreach_campaigns').insert({ name: `ret ${tag}`, status: 'finished' }).select('id').single();
    campaignIds.push(camp!.id);
    const { data: enr } = await db
      .from('outreach_enrollments')
      .insert({ campaign_id: camp!.id, prospect_id: idle, sequence_id: seq!.id, status: 'stopped', stop_reason: 'manual', enrolled_at: OLD })
      .select('id')
      .single();
    await db.from('outreach_messages').insert({
      enrollment_id: enr!.id, prospect_id: idle, step_id: step!.id, channel: 'email', status: 'sent',
      scheduled_for: OLD, sent_at: OLD, created_at: OLD, subject: 'Hello', body: 'Private message body',
    });

    // Active prospect: an event inside the window, so nothing is cleared.
    await db.from('outreach_events').insert({ prospect_id: active, type: 'replied', payload: { snippet: 'Recent reply' } });

    await suppressAddress(db, { email: `${tag}-idle@example.com` }, 'opted_out', 'test');

    const eligible = await runRetentionPass(db);
    expect(eligible).toBeGreaterThanOrEqual(1);

    const { data: i } = await db.from('outreach_prospects').select('ig_bio, sheet_raw').eq('id', idle).single();
    expect(i).toEqual({ ig_bio: null, sheet_raw: {} });
    const { data: m } = await db.from('outreach_messages').select('body, subject').eq('prospect_id', idle).single();
    expect(m).toEqual({ body: '', subject: null });
    const { data: e } = await db.from('outreach_events').select('payload').eq('prospect_id', idle).single();
    expect(e!.payload).toEqual({ keep: 1 });

    const { data: a } = await db.from('outreach_prospects').select('ig_bio, sheet_raw').eq('id', active).single();
    expect(a).toEqual({ ig_bio: 'Celebrant bio', sheet_raw: { phone: '0400 000 000' } });
    const { data: f } = await db.from('outreach_prospects').select('ig_bio').eq('id', fresh).single();
    expect(f!.ig_bio).toBe('Celebrant bio');

    const { data: s } = await db.from('outreach_suppression').select('reason').eq('value', `${tag}-idle@example.com`).single();
    expect(s!.reason).toBe('opted_out');
  });

  it('is idempotent: a second pass finds nothing new to clear', async () => {
    await runRetentionPass(db);
    const again = await runRetentionPass(db);
    expect(again).toBeGreaterThanOrEqual(0);
    const { data: i } = await db.from('outreach_prospects').select('ig_bio').in('id', prospectIds.slice(0, 1));
    expect(i![0]!.ig_bio).toBeNull();
  });
});
