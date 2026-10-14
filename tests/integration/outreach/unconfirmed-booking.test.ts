/**
 * A public booking matched to a prospect only by the email typed into the
 * form is recorded but not counted until the founder confirms it: anyone
 * can type a prospect's email. This proves the funnel filter keeps normal
 * events (no flag) and drops only flagged ones.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { recordEvent } from '@/lib/outreach/services/events';
import { newRefCode } from '@/lib/outreach/services/import';
import { loadFunnel } from '@/lib/outreach/services/queries';

import { serviceClient } from '../helpers/supabase';

const db = serviceClient();
const tag = `unconf${Date.now()}`;
const ids: string[] = [];

async function prospect(n: string): Promise<string> {
  const { data, error } = await db.from('outreach_prospects').insert({
    full_name: `${n} ${tag}`, dedupe_key: `${n} ${tag}|`, ref_code: newRefCode(), sheet_raw: {},
  }).select('id').single();
  if (error || !data) throw new Error(error?.message);
  ids.push(data.id);
  return data.id;
}

describe('unconfirmed bookings', () => {
  afterAll(async () => {
    await db.from('outreach_prospects').delete().in('id', ids);
  });

  it('counts a confirmed booking and ignores one matched only by email', async () => {
    const before = await loadFunnel(db);
    await recordEvent(db, { prospectId: await prospect('a'), type: 'demo_booked', payload: { matched_by: 'ref' } });
    await recordEvent(db, { prospectId: await prospect('b'), type: 'demo_booked', payload: { matched_by: 'email', needs_confirmation: true } });
    await recordEvent(db, { prospectId: await prospect('c'), type: 'demo_booked' });
    const after = await loadFunnel(db);
    expect(after.demoBooked - before.demoBooked).toBe(2);
  });
});
