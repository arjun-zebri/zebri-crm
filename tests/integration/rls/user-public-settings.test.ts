import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS tenant isolation for `user_public_settings`.
 *
 * This table holds each MC's Public Page config: their branded Zebri
 * subdomain and their custom email-sending domain (including the Resend
 * domain id and verification state). A cross-tenant read would leak one
 * MC's domain setup; a cross-tenant write would let a malicious user
 * hijack another MC's sending identity. The policies in
 * `20260621000000_create_user_public_settings.sql` claim to prevent this;
 * these tests prove they do — plus that the subdomain unique index is
 * enforced globally despite RLS hiding other tenants' rows.
 */
describe('RLS: user_public_settings tenant isolation', () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const a = await userA.client.from('user_public_settings').upsert(
      { user_id: userA.id, subdomain: `a-${userA.id.slice(0, 8)}`, email_mode: 'zebri' },
      { onConflict: 'user_id' },
    );
    expect(a.error).toBeNull();

    const b = await userB.client.from('user_public_settings').upsert(
      {
        user_id: userB.id,
        subdomain: `b-${userB.id.slice(0, 8)}`,
        email_mode: 'oauth',
        oauth_provider: 'google',
        oauth_email: 'b@gmail.com',
        oauth_refresh_token_encrypted: 'v1:secret-ciphertext',
        oauth_status: 'connected',
      },
      { onConflict: 'user_id' },
    );
    expect(b.error).toBeNull();
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('owner can read their own row', async () => {
    const { data, error } = await userA.client
      .from('user_public_settings')
      .select('email_mode')
      .eq('user_id', userA.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.email_mode).toBe('zebri');
  });

  it("owner cannot read another user's row, including the encrypted tokens", async () => {
    const { data, error } = await userA.client
      .from('user_public_settings')
      .select('oauth_email, oauth_refresh_token_encrypted')
      .eq('user_id', userB.id);
    expect(error).toBeNull();
    // RLS makes the whole row invisible — the stored tokens never leak.
    expect(data).toEqual([]);
  });

  it("owner cannot UPDATE another user's row", async () => {
    const { error } = await userA.client
      .from('user_public_settings')
      .update({ oauth_email: 'hijacked@gmail.com' })
      .eq('user_id', userB.id);
    expect(error).toBeNull();

    const admin = serviceClient();
    const { data } = await admin
      .from('user_public_settings')
      .select('oauth_email')
      .eq('user_id', userB.id)
      .single();
    expect(data?.oauth_email).toBe('b@gmail.com');
  });

  it('owner cannot INSERT a row claiming a different user_id', async () => {
    const { error } = await userA.client.from('user_public_settings').upsert(
      { user_id: userB.id, subdomain: 'evil', email_mode: 'zebri' },
      { onConflict: 'user_id' },
    );
    expect(error).not.toBeNull();
  });

  it('enforces global subdomain uniqueness despite RLS', async () => {
    // B's subdomain is invisible to A under RLS, but the unique index is
    // a DB-level constraint — claiming a taken subdomain must still fail
    // with a 23505 the server action can translate to "already taken".
    const taken = `b-${userB.id.slice(0, 8)}`;
    const { error } = await userA.client
      .from('user_public_settings')
      .update({ subdomain: taken })
      .eq('user_id', userA.id);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });
});
