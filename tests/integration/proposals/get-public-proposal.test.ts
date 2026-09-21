import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { anonClient, createTestUser, type TestUser } from '../helpers/supabase';

/**
 * `get_public_proposal(token)` is the anon boundary for the public page.
 * It must return null until the MC sends (share_token_enabled), must never
 * leak user_id or share_token, and must report expiry.
 */
describe('get_public_proposal', () => {
  let user: TestUser;
  let proposalId: string;
  let token: string;

  beforeAll(async () => {
    user = await createTestUser({}, { subscription_status: 'active', subscription_plan: 'pro' });
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name: 'Priya and Tom', status: 'new' })
      .select('id')
      .single();
    const { data: proposal } = await user.client
      .from('proposals')
      .insert({
        user_id: user.id,
        couple_id: couple!.id,
        title: 'Priya and Tom, your day',
        proposal_number: 'PR-PUB-1',
        deposit_percent: 30,
        intro_note: { type: 'doc', content: [] },
      })
      .select('id, share_token')
      .single();
    proposalId = proposal!.id;
    token = proposal!.share_token;
    const { data: option } = await user.client
      .from('proposal_options')
      .insert({
        proposal_id: proposalId,
        user_id: user.id,
        position: 1,
        title: 'Full day',
        pricing_mode: 'itemised',
        is_popular: true,
        subtotal: 1500,
      })
      .select('id')
      .single();
    await user.client.from('proposal_option_items').insert([
      { option_id: option!.id, user_id: user.id, description: 'Ceremony', amount: 1000, position: 1, is_addon: false, default_included: true },
      { option_id: option!.id, user_id: user.id, description: 'Late finish', amount: 500, position: 2, is_addon: true, default_included: false },
    ]);
  });

  afterAll(async () => {
    await user?.cleanup();
  });

  it('returns null while the share token is disabled', async () => {
    const { data } = await anonClient().rpc('get_public_proposal', { token });
    expect(data).toBeNull();
  });

  it('returns the payload once sent, without user_id or share_token', async () => {
    await user.client.from('proposals').update({ share_token_enabled: true, status: 'sent' }).eq('id', proposalId);
    const { data, error } = await anonClient().rpc('get_public_proposal', { token });
    expect(error).toBeNull();
    const payload = data as Record<string, unknown>;
    expect(payload.title).toBe('Priya and Tom, your day');
    expect(payload.couple_name).toBe('Priya and Tom');
    expect(payload.deposit_percent).toBe(30);
    expect(payload.expired).toBe(false);
    expect(payload).not.toHaveProperty('user_id');
    expect(payload).not.toHaveProperty('share_token');
    const options = payload.options as Array<{ title: string; is_popular: boolean; items: Array<{ is_addon: boolean }> }>;
    expect(options).toHaveLength(1);
    expect(options[0]?.is_popular).toBe(true);
    expect(options[0]?.items.map((i) => i.is_addon)).toEqual([false, true]);
  });

  it('reports expired when expires_at is in the past', async () => {
    await user.client.from('proposals').update({ expires_at: '2020-01-01' }).eq('id', proposalId);
    const { data } = await anonClient().rpc('get_public_proposal', { token });
    expect((data as { expired: boolean }).expired).toBe(true);
  });

  it('returns null for an unknown token', async () => {
    const { data } = await anonClient().rpc('get_public_proposal', {
      token: '00000000-0000-0000-0000-000000000000',
    });
    expect(data).toBeNull();
  });
});
