import { afterAll, describe, expect, it, vi } from 'vitest';

import { recordAdminAction } from '@/lib/admin/audit';

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

// Mock sendAlert so a real Slack hit isn't required when the helper's
// failure path fires. The integration here is `recordAdminAction → DB`,
// not the alert channel.
vi.mock('@/lib/alerts', () => ({
  sendAlert: vi.fn(async () => undefined),
}));

/**
 * End-to-end flow: an admin calls `recordAdminAction` and a row
 * appears in `public.admin_audit_log` with the exact actor / target /
 * action / details we passed in. Phase 13.
 */
describe('recordAdminAction → admin_audit_log', () => {
  const cleanup: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const fn of cleanup) await fn().catch(() => undefined);
  });

  async function arrangePair(): Promise<{ admin: TestUser; vendor: TestUser }> {
    const admin = await createTestUser({}, { account_type: 'admin' });
    const vendor = await createTestUser({}, {
      account_type: 'vendor',
      subscription_status: 'active',
      subscription_plan: 'pro',
    });
    cleanup.push(admin.cleanup, vendor.cleanup);
    return { admin, vendor };
  }

  it('inserts a row with actor + target + action + details', async () => {
    const { admin, vendor } = await arrangePair();
    const ok = await recordAdminAction({
      actorId: admin.id,
      targetUserId: vendor.id,
      action: 'comp_user',
      details: { plan: 'pro', cancelledStripeSubId: null },
    });
    expect(ok).toBe(true);

    const svc = serviceClient();
    const { data } = await svc
      .from('admin_audit_log')
      .select('actor_id, target_user_id, action, details')
      .eq('actor_id', admin.id)
      .eq('action', 'comp_user');
    expect(data).toHaveLength(1);
    const row = data![0]!;
    expect(row.actor_id).toBe(admin.id);
    expect(row.target_user_id).toBe(vendor.id);
    expect(row.details).toEqual({ plan: 'pro', cancelledStripeSubId: null });
  });

  it('accepts a null target (e.g. exit_shadow has no specific target)', async () => {
    const { admin } = await arrangePair();
    const ok = await recordAdminAction({
      actorId: admin.id,
      targetUserId: null,
      action: 'exit_shadow',
      details: {},
    });
    expect(ok).toBe(true);

    const svc = serviceClient();
    const { data } = await svc
      .from('admin_audit_log')
      .select('action, target_user_id')
      .eq('actor_id', admin.id)
      .eq('action', 'exit_shadow');
    expect(data).toHaveLength(1);
    expect(data![0]!.target_user_id).toBeNull();
  });

  it('returns false (does not throw) when actor_id is invalid', async () => {
    // Foreign-key constraint on actor_id → auth.users(id) means an
    // unknown UUID fails the insert. The helper must catch + alert
    // + return false rather than throw to the caller.
    const ok = await recordAdminAction({
      actorId: '00000000-0000-0000-0000-000000000000',
      targetUserId: null,
      action: 'enter_shadow',
      details: {},
    });
    expect(ok).toBe(false);
  });
});
