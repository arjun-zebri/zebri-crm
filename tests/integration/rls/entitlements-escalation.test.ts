import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isAdmin, accountType, isActive, currentPlan } from '@/lib/auth/entitlements';

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * Phase 0.8b — §7.4 escalation-block integration test.
 *
 * Creates a real user against the local Supabase, then tries to use the
 * legitimate `supabase.auth.updateUser({ data: … })` API (which writes
 * to user_metadata — the user-writable bag) to grant the user
 * admin / paid-plan status. Verifies the entitlements helper IGNORES
 * those writes and still returns the server-set values.
 *
 * This is the canonical regression test for the privilege-escalation
 * hole — if it ever fails, a regression has unfixed §7.4.
 */
describe('entitlements: §7.4 privilege-escalation blocks (end-to-end)', () => {
  let attacker: TestUser;

  beforeAll(async () => {
    // No explicit metadata → INSERT trigger should set
    // app_metadata.account_type='vendor' as the migration sentinel.
    attacker = await createTestUser();
  });

  afterAll(async () => {
    await attacker?.cleanup();
  });

  it('newly-created users have app_metadata.account_type set by the INSERT trigger', async () => {
    const admin = serviceClient();
    const { data } = await admin.auth.admin.getUserById(attacker.id);
    expect(data.user?.app_metadata?.account_type).toBe('vendor');
  });

  it('user_metadata.account_type="admin" written via auth.updateUser is IGNORED', async () => {
    // Attacker uses the legitimate update API (they're authenticated as
    // themselves). This writes to user_metadata — by Supabase design.
    const { error } = await attacker.client.auth.updateUser({
      data: { account_type: 'admin' },
    });
    expect(error).toBeNull();

    // Refresh the user from the auth server.
    const admin = serviceClient();
    const { data } = await admin.auth.admin.getUserById(attacker.id);
    const user = data.user!;

    // user_metadata DOES carry the attacker's claim (Supabase allowed it).
    expect(user.user_metadata?.account_type).toBe('admin');
    // …but the entitlements helper IGNORES that and returns the
    // server-authoritative value.
    expect(isAdmin(user)).toBe(false);
    expect(accountType(user)).toBe('vendor');
  });

  it('user_metadata.subscription_status="active" claim does NOT unlock paid features', async () => {
    await attacker.client.auth.updateUser({
      data: {
        subscription_status: 'active',
        subscription_plan: 'max',
        is_subscribed: true,
      },
    });

    const admin = serviceClient();
    const { data } = await admin.auth.admin.getUserById(attacker.id);
    const user = data.user!;

    expect(user.user_metadata?.subscription_status).toBe('active');
    expect(isActive(user)).toBe(false);
    expect(currentPlan(user)).toBe('starter');
  });

  it('server-set entitlements via app_metadata DO grant access (positive case)', async () => {
    const admin = serviceClient();
    // Server writes via the admin API — goes into app_metadata.
    await admin.auth.admin.updateUserById(attacker.id, {
      app_metadata: {
        account_type: 'admin',
        subscription_status: 'active',
        subscription_plan: 'pro',
      },
    });
    const { data } = await admin.auth.admin.getUserById(attacker.id);
    const user = data.user!;

    expect(isAdmin(user)).toBe(true);
    expect(isActive(user)).toBe(true);
    expect(currentPlan(user)).toBe('pro');
  });
});
