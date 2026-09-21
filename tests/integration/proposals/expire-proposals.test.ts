/**
 * expire_proposals: sent/viewed proposals past expires_at flip to expired;
 * accepted, not-yet-due, and draft proposals are left alone. Not granted to
 * anon or authenticated (the cron route calls it via the service-role
 * client), so this test goes through serviceClient(). Local Supabase.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let user: TestUser;
let coupleId: string;

beforeAll(async () => {
  user = await createTestUser();
  const { data: c } = await user.client.from('couples').insert({ user_id: user.id, name: 'A & B', status: 'new' }).select('id').single();
  coupleId = c!.id;
});
afterAll(async () => { await user.cleanup(); });

describe('expire_proposals', () => {
  it('stamps sent and viewed proposals past their expiry and leaves the rest alone', async () => {
    const rows = [
      { proposal_number: 'PR-E1', status: 'sent', expires_at: '2020-01-01' },
      { proposal_number: 'PR-E2', status: 'viewed', expires_at: '2020-01-01' },
      { proposal_number: 'PR-E3', status: 'accepted', expires_at: '2020-01-01', accepted_at: new Date().toISOString() },
      { proposal_number: 'PR-E4', status: 'sent', expires_at: '2999-01-01' },
      { proposal_number: 'PR-E5', status: 'draft', expires_at: '2020-01-01' },
    ].map((r) => ({ user_id: user.id, couple_id: coupleId, title: 'T', share_token_enabled: true, ...r }));
    const { data: inserted, error } = await user.client.from('proposals').insert(rows).select('id, proposal_number');
    if (error) throw error;
    const { data: expired } = await serviceClient().rpc('expire_proposals');
    const ids = new Set((expired as string[]) ?? []);
    const byNumber = Object.fromEntries(inserted!.map((r) => [r.proposal_number, r.id]));
    expect(ids.has(byNumber['PR-E1']!)).toBe(true);
    expect(ids.has(byNumber['PR-E2']!)).toBe(true);
    expect(ids.has(byNumber['PR-E3']!)).toBe(false);
    expect(ids.has(byNumber['PR-E4']!)).toBe(false);
    expect(ids.has(byNumber['PR-E5']!)).toBe(false);
    const { data: after } = await user.client.from('proposals').select('proposal_number, status').in('id', inserted!.map((r) => r.id));
    const status = Object.fromEntries(after!.map((r) => [r.proposal_number, r.status]));
    expect(status).toMatchObject({ 'PR-E1': 'expired', 'PR-E2': 'expired', 'PR-E3': 'accepted', 'PR-E4': 'sent', 'PR-E5': 'draft' });
  });
});
