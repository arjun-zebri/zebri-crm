/**
 * Phase 4B — per-couple task action integration tests against local
 * Supabase.
 *
 * Proves the create/update/delete task path round-trips under real
 * RLS and that cross-tenant attempts silently no-op.
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

// eslint-disable-next-line import/order
import {
  createCoupleTaskAction,
  deleteCoupleTaskAction,
  updateCoupleTaskAction,
} from '@/app/(dashboard)/couples/actions';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

async function arrangeCouple(user: TestUser): Promise<string> {
  activeUser = user;
  const { data, error } = await user.client
    .from('couples')
    .insert({ user_id: user.id, name: 'A Couple', status: 'enquiry' })
    .select('id')
    .single();
  if (error || !data) throw new Error(`couple insert failed: ${error?.message}`);
  return data.id;
}

afterEach(() => {
  activeUser = null;
});

describe('createCoupleTaskAction — integration', () => {
  it('creates a task linked to the couple', async () => {
    const user = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(user);
      const result = await createCoupleTaskAction({
        coupleId,
        title: 'Send venue floor-plan',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('tasks')
        .select('user_id, related_couple_id, title, status')
        .eq('id', result.data.id)
        .single();
      expect(row?.user_id).toBe(user.id);
      expect(row?.related_couple_id).toBe(coupleId);
      expect(row?.title).toBe('Send venue floor-plan');
      expect(row?.status).toBe('todo');
    } finally {
      await user.cleanup();
    }
  });

  it('rejects an empty title (Zod)', async () => {
    const user = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(user);
      const result = await createCoupleTaskAction({
        coupleId,
        title: '   ',
      });
      expect(result.ok).toBe(false);
    } finally {
      await user.cleanup();
    }
  });
});

describe('updateCoupleTaskAction — integration', () => {
  it('updates allowed fields', async () => {
    const user = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(user);
      const created = await createCoupleTaskAction({
        coupleId,
        title: 'Original',
      });
      if (!created.ok) throw new Error(created.error);

      const updated = await updateCoupleTaskAction({
        id: created.data.id,
        patch: { title: 'Updated', status: 'in_progress' },
      });
      expect(updated.ok).toBe(true);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('tasks')
        .select('title, status')
        .eq('id', created.data.id)
        .single();
      expect(row?.title).toBe('Updated');
      expect(row?.status).toBe('in_progress');
    } finally {
      await user.cleanup();
    }
  });

  it('rejects an empty patch', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await updateCoupleTaskAction({
        id: 'c1c1c1c1-c1c1-4c1c-9c1c-c1c1c1c1c1c1',
        patch: {},
      });
      expect(result.ok).toBe(false);
    } finally {
      await user.cleanup();
    }
  });
});

describe('deleteCoupleTaskAction — integration', () => {
  it('blocks cross-tenant deletes', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(userA);
      const created = await createCoupleTaskAction({
        coupleId,
        title: 'A task',
      });
      if (!created.ok) throw new Error(created.error);

      activeUser = userB;
      await deleteCoupleTaskAction(created.data.id);

      // A's task should still exist (RLS scopes the DELETE to B's rows).
      const admin = serviceClient();
      const { count } = await admin
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('id', created.data.id);
      expect(count).toBe(1);
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});
