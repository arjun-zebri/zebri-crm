import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * Test the branding overhaul migration (20260717000000).
 *
 * Covers:
 * - enabled_surfaces defaults to all six surfaces on user_branding insert
 * - get_vendor_timeline returns branding + branding_blocks keys for a valid portal token
 * - Cross-tenant RLS still denies reading another user's user_branding row
 */
describe('Branding overhaul migration', () => {
  let userA: TestUser;
  let userB: TestUser;
  let coupleA: { id: string; portal_token: string };

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' };
    userA = await createTestUser({}, pro);
    userB = await createTestUser({}, pro);

    const admin = serviceClient();

    // Create user_branding rows for the test users
    // (they're not auto-created on signup; tests must insert them)
    await admin
      .from('user_branding')
      .insert({ user_id: userA.id })
      .select();

    await admin
      .from('user_branding')
      .insert({ user_id: userB.id })
      .select();

    // Create a couple for userA with portal token enabled
    const { data: coupleData, error: coupleError } = await admin
      .from('couples')
      .insert({
        user_id: userA.id,
        name: 'Test Couple A',
        portal_token_enabled: true,
      })
      .select('id, portal_token')
      .single();

    expect(coupleError).toBeNull();
    coupleA = coupleData!;
  });

  afterAll(async () => {
    await userA?.cleanup();
    await userB?.cleanup();
  });

  it('enabled_surfaces defaults to all six surfaces on user_branding insert', async () => {
    const admin = serviceClient();

    // Get the user_branding row for userA
    const { data, error } = await admin
      .from('user_branding')
      .select('enabled_surfaces')
      .eq('user_id', userA.id)
      .single();

    expect(error).toBeNull();
    expect(data?.enabled_surfaces).toEqual([
      'proposal',
      'invoice',
      'contract',
      'portal',
      'vendorTimeline',
      'questionnaire',
    ]);
  });

  it('get_vendor_timeline returns branding + branding_blocks keys for a valid portal token', async () => {
    const admin = serviceClient();

    // Call get_vendor_timeline with the valid portal token
    const { data, error } = await admin.rpc('get_vendor_timeline', {
      token: coupleA.portal_token,
    });

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // Narrow the Json type to access properties
    const payload = data as unknown as {
      events: unknown[];
      timeline_items: unknown[];
      branding: unknown;
      branding_blocks: unknown;
    };

    expect(payload).toHaveProperty('events');
    expect(payload).toHaveProperty('timeline_items');
    expect(payload).toHaveProperty('branding');
    expect(payload).toHaveProperty('branding_blocks');

    // branding should be a jsonb object with branding fields
    expect(typeof payload.branding).toBe('object');
    // branding_blocks can be null if no blocks have been configured
    expect(payload.branding_blocks === null || typeof payload.branding_blocks === 'object').toBe(
      true,
    );
  });

  it('cross-tenant RLS denies reading another user\'s user_branding row', async () => {
    // userB tries to read userA's branding (the RLS policy should deny access)
    const { data, error } = await userB.client
      .from('user_branding')
      .select('user_id')
      .eq('user_id', userA.id);

    // RLS should silently return empty result (not an error)
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('get_vendor_timeline with invalid token returns null', async () => {
    const admin = serviceClient();

    // Call get_vendor_timeline with an invalid token
    const { data, error } = await admin.rpc('get_vendor_timeline', {
      token: '00000000-0000-0000-0000-000000000000',
    });

    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
