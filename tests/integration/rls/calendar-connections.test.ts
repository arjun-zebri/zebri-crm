import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `calendar_connections` (Scheduler Phase A).
 *
 * Rows hold encrypted OAuth tokens for an MC's external calendars.
 * Cross-tenant access would leak another MC's connected account email
 * and token ciphertext, so every verb is owner-only. Token columns are
 * ciphertext (AES-256-GCM under the server-only EMAIL_CRED_KEY), which
 * is why owner SELECT of those columns is acceptable, matching the
 * user_public_settings precedent.
 */
describe('RLS: calendar_connections tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;
  let rowAId: string;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const { data, error } = await userA.client
      .from('calendar_connections')
      .insert({
        user_id: userA.id,
        provider: 'google',
        account_email: 'mc@example.com',
        access_token_encrypted: 'v1:fake.fake.fake',
        refresh_token_encrypted: 'v1:fake.fake.fake',
        token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    rowAId = data!.id;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own connection', async () => {
    const { data } = await userA.client
      .from('calendar_connections')
      .select('id')
      .eq('id', rowAId);
    expect(data).toHaveLength(1);
  });

  it('another tenant cannot SELECT it', async () => {
    const { data, error } = await userB.client
      .from('calendar_connections')
      .select('*')
      .eq('id', rowAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('another tenant cannot INSERT a row owned by userA', async () => {
    const { error } = await userB.client.from('calendar_connections').insert({
      user_id: userA.id,
      provider: 'microsoft',
      account_email: 'attacker@example.com',
      access_token_encrypted: 'v1:x.x.x',
      refresh_token_encrypted: 'v1:x.x.x',
      token_expires_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it('another tenant cannot UPDATE it', async () => {
    const { data } = await userB.client
      .from('calendar_connections')
      .update({ account_email: 'hijack@example.com' })
      .eq('id', rowAId)
      .select('id');
    expect(data).toEqual([]);
  });

  it('another tenant cannot DELETE it', async () => {
    await userB.client.from('calendar_connections').delete().eq('id', rowAId);
    const { data } = await userA.client
      .from('calendar_connections')
      .select('id')
      .eq('id', rowAId);
    expect(data).toHaveLength(1);
  });

  it('anonymous clients see nothing', async () => {
    const { data } = await anonClient()
      .from('calendar_connections')
      .select('id');
    expect(data ?? []).toEqual([]);
  });

  it('a second connection for the same provider upserts, not duplicates', async () => {
    const { error } = await userA.client.from('calendar_connections').insert({
      user_id: userA.id,
      provider: 'google',
      account_email: 'other@example.com',
      access_token_encrypted: 'v1:y.y.y',
      refresh_token_encrypted: 'v1:y.y.y',
      token_expires_at: new Date().toISOString(),
    });
    // unique (user_id, provider) rejects the plain insert
    expect(error).not.toBeNull();
  });
});
