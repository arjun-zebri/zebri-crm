/**
 * Phase 2D.1 — `connect_accounts` mirror integration test.
 *
 * Proves:
 * - `syncConnectAccount` inserts a row on first call, updates it on
 *   subsequent calls (idempotent upsert).
 * - `readConnectAccount` projects DB columns into the
 *   {@link ConnectAccountState} shape.
 * - `clearConnectBinding({ preserveLastAccountId: true })` moves
 *   account_id → last_account_id and zeroes the capability flags
 *   (the server-initiated disconnect path).
 * - `clearConnectBinding({ preserveLastAccountId: false })` clears
 *   last_account_id too (the `account.application.deauthorized`
 *   path).
 * - **Cross-tenant: RLS denies one user reading another user's row.**
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  clearConnectBinding,
  findUserIdByAccountId,
  readConnectAccount,
  syncConnectAccount,
} from '@/lib/payments/connect-account';

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

// Helpers for ergonomic teardown.
const provisioned: TestUser[] = [];
async function newUser(): Promise<TestUser> {
  const u = await createTestUser({ app_metadata: { account_type: 'vendor' } });
  provisioned.push(u);
  return u;
}

afterEach(async () => {
  while (provisioned.length > 0) {
    const u = provisioned.pop()!;
    await u.cleanup();
  }
});

describe('syncConnectAccount', () => {
  it('inserts a fresh row + projects through readConnectAccount', async () => {
    const u = await newUser();
    const id = await syncConnectAccount(u.id, {
      id: 'acct_1Test',
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
      default_currency: 'aud',
      country: 'AU',
      business_type: 'individual',
      requirements: {
        currently_due: ['individual.dob.day'],
        past_due: [],
        disabled_reason: null,
      },
    });
    expect(id).toBe('acct_1Test');

    const state = await readConnectAccount(u.id);
    expect(state).not.toBeNull();
    expect(state?.accountId).toBe('acct_1Test');
    expect(state?.chargesEnabled).toBe(true);
    expect(state?.payoutsEnabled).toBe(false);
    expect(state?.country).toBe('AU');
    expect(state?.requirementsCurrentlyDue).toEqual(['individual.dob.day']);
    expect(state?.disabledReason).toBeNull();
  });

  it('updates an existing row on second call (idempotent upsert)', async () => {
    const u = await newUser();
    await syncConnectAccount(u.id, { id: 'acct_1', charges_enabled: false });
    await syncConnectAccount(u.id, {
      id: 'acct_1',
      charges_enabled: true,
      payouts_enabled: true,
    });
    const state = await readConnectAccount(u.id);
    expect(state?.chargesEnabled).toBe(true);
    expect(state?.payoutsEnabled).toBe(true);
  });

  it('findUserIdByAccountId resolves the owning user', async () => {
    const u = await newUser();
    await syncConnectAccount(u.id, { id: 'acct_finder' });
    const found = await findUserIdByAccountId('acct_finder');
    expect(found).toBe(u.id);
  });

  it('findUserIdByAccountId returns null for an unknown account', async () => {
    const found = await findUserIdByAccountId('acct_does_not_exist');
    expect(found).toBeNull();
  });
});

describe('clearConnectBinding', () => {
  it('with preserveLastAccountId: moves account_id → last_account_id', async () => {
    const u = await newUser();
    await syncConnectAccount(u.id, {
      id: 'acct_save',
      charges_enabled: true,
    });
    await clearConnectBinding(u.id, { preserveLastAccountId: true });
    const state = await readConnectAccount(u.id);
    expect(state?.accountId).toBeNull();
    expect(state?.lastAccountId).toBe('acct_save');
    expect(state?.chargesEnabled).toBe(false);
  });

  it('without preserveLastAccountId: clears the last_account_id too', async () => {
    const u = await newUser();
    await syncConnectAccount(u.id, {
      id: 'acct_drop',
      charges_enabled: true,
    });
    await clearConnectBinding(u.id, { preserveLastAccountId: false });
    const state = await readConnectAccount(u.id);
    expect(state?.accountId).toBeNull();
    expect(state?.lastAccountId).toBeNull();
  });
});

describe('RLS', () => {
  it('owner can read their own row; non-owner cannot', async () => {
    const a = await newUser();
    const b = await newUser();
    await syncConnectAccount(a.id, { id: 'acct_owned_by_a' });

    // User A reads their own row (via the anon client with their JWT,
    // not the service-role client) — should succeed.
    const { data: ownRow, error: ownErr } = await a.client
      .from('connect_accounts')
      .select('*')
      .eq('user_id', a.id)
      .maybeSingle();
    expect(ownErr).toBeNull();
    expect(ownRow?.account_id).toBe('acct_owned_by_a');

    // User B tries to read A's row — RLS filters it out (maybeSingle
    // returns null, no error).
    const { data: crossRow, error: crossErr } = await b.client
      .from('connect_accounts')
      .select('*')
      .eq('user_id', a.id)
      .maybeSingle();
    expect(crossErr).toBeNull();
    expect(crossRow).toBeNull();

    // The row itself still exists (service-role can see it).
    const svc = serviceClient();
    const { data: serviceRow } = await svc
      .from('connect_accounts')
      .select('*')
      .eq('user_id', a.id)
      .maybeSingle();
    expect(serviceRow?.account_id).toBe('acct_owned_by_a');
  });
});
