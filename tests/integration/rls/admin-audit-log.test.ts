import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

/**
 * RLS coverage for `admin_audit_log` (Phase 13).
 *
 * The table is admin-only on SELECT and has NO write policies — the
 * only sanctioned writer is the service-role helper at
 * lib/admin/audit.ts. These tests prove:
 *
 *   1. A regular (non-admin) authenticated user CANNOT read the
 *      table — even a self-claim of admin via user_metadata is
 *      ignored (the SELECT policy reads app_metadata via auth.jwt()).
 *   2. An admin user CAN read the table.
 *   3. NO session — admin OR vendor — can INSERT, because no
 *      INSERT policy exists.
 *   4. Anonymous clients see nothing.
 */
describe('RLS: admin_audit_log', () => {
  let admin: TestUser;
  let vendor: TestUser;
  let escalator: TestUser;
  let seededRowId: string;

  beforeAll(async () => {
    admin = await createTestUser({}, { account_type: 'admin' });
    vendor = await createTestUser({}, {
      account_type: 'vendor',
      subscription_status: 'active',
      subscription_plan: 'pro',
    });
    // §7.4 probe: this user claims admin in *user_metadata* (which is
    // user-writable) but app_metadata still says vendor. The SELECT
    // policy reads from app_metadata via auth.jwt(), so the claim
    // must be ignored.
    escalator = await createTestUser(
      { account_type: 'admin' },
      {
        account_type: 'vendor',
        subscription_status: 'active',
        subscription_plan: 'pro',
      },
    );

    const svc = serviceClient();
    const { data, error } = await svc
      .from('admin_audit_log')
      .insert({
        actor_id: admin.id,
        target_user_id: vendor.id,
        action: 'comp_user',
        details: { plan: 'pro' },
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    seededRowId = data!.id;
  });

  afterAll(async () => {
    const svc = serviceClient();
    if (seededRowId) {
      await svc.from('admin_audit_log').delete().eq('id', seededRowId);
    }
    await admin?.cleanup();
    await vendor?.cleanup();
    await escalator?.cleanup();
  });

  it('admin can SELECT the seeded row', async () => {
    const { data, error } = await admin.client
      .from('admin_audit_log')
      .select('id, action')
      .eq('id', seededRowId)
      .single();
    expect(error).toBeNull();
    expect(data?.action).toBe('comp_user');
  });

  it('regular vendor cannot SELECT — RLS filters everything', async () => {
    const { data, error } = await vendor.client
      .from('admin_audit_log')
      .select('id');
    // RLS makes rows invisible — no error, just an empty result.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('§7.4: a user with user_metadata.account_type=admin still sees nothing', async () => {
    // The JWT carries app_metadata, which says 'vendor'. The SELECT
    // policy reads from app_metadata, so the user_metadata claim
    // cannot grant SELECT.
    const { data, error } = await escalator.client
      .from('admin_audit_log')
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('admin INSERT is rejected (no INSERT policy)', async () => {
    const { error } = await admin.client.from('admin_audit_log').insert({
      actor_id: admin.id,
      target_user_id: vendor.id,
      action: 'comp_user',
      details: {},
    });
    expect(error).not.toBeNull();
  });

  it('vendor INSERT is rejected (no INSERT policy)', async () => {
    const { error } = await vendor.client.from('admin_audit_log').insert({
      actor_id: vendor.id,
      target_user_id: admin.id,
      action: 'comp_user',
      details: {},
    });
    expect(error).not.toBeNull();
  });

  it('admin UPDATE is rejected (no UPDATE policy)', async () => {
    await admin.client
      .from('admin_audit_log')
      .update({ action: 'tampered' })
      .eq('id', seededRowId);
    const svc = serviceClient();
    const { data } = await svc
      .from('admin_audit_log')
      .select('action')
      .eq('id', seededRowId)
      .single();
    expect(data?.action).toBe('comp_user');
  });

  it('admin DELETE is rejected (no DELETE policy)', async () => {
    await admin.client.from('admin_audit_log').delete().eq('id', seededRowId);
    const svc = serviceClient();
    const { data } = await svc
      .from('admin_audit_log')
      .select('id')
      .eq('id', seededRowId);
    expect(data).toHaveLength(1);
  });

  it('anonymous client sees nothing', async () => {
    const anon = anonClient();
    const { data } = await anon.from('admin_audit_log').select('id');
    expect(data).toEqual([]);
  });
});
