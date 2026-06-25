/**
 * Integration coverage for `bulkCreateCouplesAction` against local
 * Supabase (real schema, real RLS).
 *
 * Proves:
 * - Happy path: a Pro user imports many couples in one call; every
 *   row lands owned by the authenticated user.
 * - Invalid rows are reported (not inserted) while valid rows in the
 *   same batch still import.
 * - Starter-cap slicing: the action fills the remaining quota and
 *   reports the overflow as `skippedForLimit` instead of failing the
 *   whole batch on the Postgres trigger.
 * - Cross-tenant: `user_id` is taken from the session, so an imported
 *   row is always owned by the acting user (never a spoofed owner).
 * - The 500-row payload cap is enforced.
 *
 * The action reads its session from `@/lib/supabase/server`; we mock
 * that to return the active test user's RLS-scoped client.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userInState } from '../helpers/billing-states';
import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser)
      throw new Error('No active test user — set `activeUser` before calling');
    return activeUser.client;
  }),
}));

// eslint-disable-next-line import/order
import { bulkCreateCouplesAction } from '@/app/(dashboard)/couples/actions';
// eslint-disable-next-line import/order
import type { CoupleInput } from '@/app/(dashboard)/couples/actions';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

/** A minimal valid import row (schema defaults fill the rest).
 *  `event_date` is nullable-but-required by the schema, so it's set. */
function row(name: string): CoupleInput {
  return { name, status: 'new', event_date: null };
}

afterEach(() => {
  activeUser = null;
});

describe('bulkCreateCouplesAction — happy path', () => {
  it('imports many couples owned by the authenticated user', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await bulkCreateCouplesAction([
        row('Anna & Jake'),
        row('Mia & Sam'),
        row('Lee & Jo'),
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.data.created).toBe(3);
      expect(result.data.skippedForLimit).toBe(0);
      expect(result.data.invalidRows).toHaveLength(0);

      const admin = serviceClient();
      const { count } = await admin
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      expect(count).toBe(3);
    } finally {
      await user.cleanup();
    }
  });
});

describe('bulkCreateCouplesAction — invalid rows', () => {
  it('reports invalid rows and imports the valid ones', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await bulkCreateCouplesAction([
        row('Valid One'),
        { name: '', status: 'new', event_date: null }, // empty name → invalid
        row('Valid Two'),
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.data.created).toBe(2);
      expect(result.data.invalidRows).toHaveLength(1);
      expect(result.data.invalidRows[0]!.index).toBe(1);
    } finally {
      await user.cleanup();
    }
  });
});

describe('bulkCreateCouplesAction — Starter cap slicing', () => {
  it('fills remaining quota and reports the overflow as skipped', async () => {
    const user = await userInState('never_trialled');
    activeUser = user;
    try {
      // Pre-seed 4 couples directly (under the 5-cap), leaving 1 slot.
      for (let i = 0; i < 4; i++) {
        const { error } = await user.client
          .from('couples')
          .insert({ name: `Seed ${i}`, user_id: user.id });
        expect(error).toBeNull();
      }

      const result = await bulkCreateCouplesAction([
        row('Import A'),
        row('Import B'),
        row('Import C'),
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.data.created).toBe(1);
      expect(result.data.skippedForLimit).toBe(2);

      const admin = serviceClient();
      const { count } = await admin
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      expect(count).toBe(5);
    } finally {
      await user.cleanup();
    }
  });
});

describe('bulkCreateCouplesAction — cross-tenant ownership', () => {
  it('always stamps the acting user as owner', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      activeUser = userB;
      const result = await bulkCreateCouplesAction([row('B Couple')]);
      expect(result.ok).toBe(true);

      const admin = serviceClient();
      const { count: ownedByB } = await admin
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userB.id);
      const { count: ownedByA } = await admin
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userA.id);
      expect(ownedByB).toBe(1);
      expect(ownedByA).toBe(0);
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});

describe('bulkCreateCouplesAction — payload cap', () => {
  it('rejects more than 500 rows without inserting', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const rows = Array.from({ length: 501 }, (_, i) => row(`C ${i}`));
      const result = await bulkCreateCouplesAction(rows);
      expect(result.ok).toBe(false);

      const admin = serviceClient();
      const { count } = await admin
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      expect(count).toBe(0);
    } finally {
      await user.cleanup();
    }
  });
});
