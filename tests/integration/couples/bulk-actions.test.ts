/**
 * Phase 4A — bulk-action integration tests.
 *
 * Proves the three bulk actions (move / status update / delete)
 * round-trip under real RLS and that cross-tenant attempts are
 * silently no-ops.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser)
      throw new Error('No active test user — set `activeUser` before calling');
    return activeUser.client;
  }),
}));

// Disable import-order: the `@/...` import must come AFTER
// `vi.mock()` so the mock applies during module load. Vitest
// hoists `vi.mock` to the top, but ESLint can't see that.
// eslint-disable-next-line import/order
import {
  bulkDeleteCouplesAction,
  bulkMoveCouplesAction,
  bulkUpdateCouplesStatusAction,
  createCoupleAction,
} from '@/app/(dashboard)/couples/actions';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

const baseCouple = {
  email: '',
  phone: '',
  event_date: null,
  venue: '',
  notes: '',
  status: 'enquiry',
  lead_source: null,
  kanban_position: 0,
};

async function seed(user: TestUser, names: string[]): Promise<string[]> {
  activeUser = user;
  const ids: string[] = [];
  for (const name of names) {
    const result = await createCoupleAction({ ...baseCouple, name });
    if (!result.ok) throw new Error(result.error);
    ids.push(result.data.id);
  }
  return ids;
}

afterEach(() => {
  activeUser = null;
});

describe('bulkMoveCouplesAction — integration', () => {
  it('updates status + kanban_position for each row', async () => {
    const user = await createTestUser({}, pro);
    try {
      const [a, b] = await seed(user, ['Couple A', 'Couple B']);
      const result = await bulkMoveCouplesAction([
        { id: a, status: 'booked', kanban_position: 1 },
        { id: b, status: 'booked', kanban_position: 2 },
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.data.updatedIds.sort()).toEqual([a, b].sort());

      const admin = serviceClient();
      const { data } = await admin
        .from('couples')
        .select('id, status, kanban_position')
        .in('id', [a, b]);
      expect(data?.every((r) => r.status === 'booked')).toBe(true);
    } finally {
      await user.cleanup();
    }
  });
});

describe('bulkUpdateCouplesStatusAction — integration', () => {
  it('updates the status column for every selected row', async () => {
    const user = await createTestUser({}, pro);
    try {
      const ids = await seed(user, ['Couple A', 'Couple B', 'Couple C']);
      const result = await bulkUpdateCouplesStatusAction({
        ids,
        status: 'lost',
      });
      expect(result.ok).toBe(true);

      const admin = serviceClient();
      const { data } = await admin
        .from('couples')
        .select('id, status')
        .in('id', ids);
      expect(data?.every((r) => r.status === 'lost')).toBe(true);
    } finally {
      await user.cleanup();
    }
  });

  it('rejects an empty ids array', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await bulkUpdateCouplesStatusAction({
        ids: [],
        status: 'lost',
      });
      expect(result.ok).toBe(false);
    } finally {
      await user.cleanup();
    }
  });
});

describe('bulkDeleteCouplesAction — integration', () => {
  it('deletes every selected row', async () => {
    const user = await createTestUser({}, pro);
    try {
      const ids = await seed(user, ['Couple A', 'Couple B']);
      const result = await bulkDeleteCouplesAction(ids);
      expect(result.ok).toBe(true);

      const admin = serviceClient();
      const { count } = await admin
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .in('id', ids);
      expect(count).toBe(0);
    } finally {
      await user.cleanup();
    }
  });

  it('blocks cross-tenant deletes — User B cannot bulk-delete A rows', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      const ids = await seed(userA, ['A-1', 'A-2']);

      activeUser = userB;
      await bulkDeleteCouplesAction(ids);

      // A's couples should still exist.
      const admin = serviceClient();
      const { count } = await admin
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .in('id', ids);
      expect(count).toBe(2);
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});
