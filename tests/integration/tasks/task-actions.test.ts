/**
 * Phase 6 — task action integration tests against local Supabase.
 *
 * Spot-coverage for the create / update / delete + bulk paths
 * across both `tasks` and `task_groups`. Cross-tenant denial is
 * the load-bearing test.
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
  bulkDeleteTasksAction,
  bulkUpdateTasksAction,
  createTaskAction,
  createTaskGroupAction,
  deleteTaskAction,
  deleteTaskGroupAction,
  reorderTaskGroupsAction,
  updateTaskAction,
  updateTaskGroupAction,
} from '@/app/(dashboard)/tasks/actions';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

afterEach(() => {
  activeUser = null;
});

describe('createTaskAction — integration', () => {
  it('creates a task owned by the user', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await createTaskAction({ title: 'Send venue floor-plan' });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data } = await admin
        .from('tasks')
        .select('user_id, title, status')
        .eq('id', result.data.id)
        .single();
      expect(data?.user_id).toBe(user.id);
      expect(data?.title).toBe('Send venue floor-plan');
      expect(data?.status).toBe('todo');
    } finally {
      await user.cleanup();
    }
  });
});

describe('updateTaskAction — integration', () => {
  it('updates a single field', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const created = await createTaskAction({ title: 'A task' });
      if (!created.ok) throw new Error(created.error);

      const updated = await updateTaskAction({
        id: created.data.id,
        patch: { status: 'in_progress', priority: 'high' },
      });
      expect(updated.ok).toBe(true);

      const admin = serviceClient();
      const { data } = await admin
        .from('tasks')
        .select('status, priority')
        .eq('id', created.data.id)
        .single();
      expect(data?.status).toBe('in_progress');
      expect(data?.priority).toBe('high');
    } finally {
      await user.cleanup();
    }
  });
});

describe('deleteTaskAction — integration', () => {
  it('blocks cross-tenant deletes', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      activeUser = userA;
      const created = await createTaskAction({ title: 'A task' });
      if (!created.ok) throw new Error(created.error);

      activeUser = userB;
      await deleteTaskAction(created.data.id);

      // A's task should still exist.
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

describe('bulk task actions — integration', () => {
  it('bulkUpdate sets the same status across many rows', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const a = await createTaskAction({ title: 'A' });
      const b = await createTaskAction({ title: 'B' });
      const c = await createTaskAction({ title: 'C' });
      if (!a.ok || !b.ok || !c.ok) throw new Error('seed failed');

      const result = await bulkUpdateTasksAction({
        ids: [a.data.id, b.data.id, c.data.id],
        patch: { status: 'done' },
      });
      expect(result.ok).toBe(true);

      const admin = serviceClient();
      const { data } = await admin
        .from('tasks')
        .select('status')
        .in('id', [a.data.id, b.data.id, c.data.id]);
      expect(data?.every((r) => r.status === 'done')).toBe(true);
    } finally {
      await user.cleanup();
    }
  });

  it('bulkDelete removes every selected row', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const a = await createTaskAction({ title: 'A' });
      const b = await createTaskAction({ title: 'B' });
      if (!a.ok || !b.ok) throw new Error('seed failed');

      const result = await bulkDeleteTasksAction([a.data.id, b.data.id]);
      expect(result.ok).toBe(true);

      const admin = serviceClient();
      const { count } = await admin
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .in('id', [a.data.id, b.data.id]);
      expect(count).toBe(0);
    } finally {
      await user.cleanup();
    }
  });
});

describe('task group actions — integration', () => {
  it('creates / updates / deletes a group', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const created = await createTaskGroupAction({
        name: 'Pre-event',
        color: 'blue',
      });
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error(created.error);

      const updated = await updateTaskGroupAction({
        id: created.data.id,
        patch: { name: 'Pre-wedding', color: 'green' },
      });
      expect(updated.ok).toBe(true);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('task_groups')
        .select('name, color')
        .eq('id', created.data.id)
        .single();
      expect(row?.name).toBe('Pre-wedding');
      expect(row?.color).toBe('green');

      const deleted = await deleteTaskGroupAction(created.data.id);
      expect(deleted.ok).toBe(true);
    } finally {
      await user.cleanup();
    }
  });

  it('reorderTaskGroups sets positions in order', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const a = await createTaskGroupAction({ name: 'A', color: 'red' });
      const b = await createTaskGroupAction({ name: 'B', color: 'amber' });
      const c = await createTaskGroupAction({ name: 'C', color: 'purple' });
      if (!a.ok || !b.ok || !c.ok) throw new Error('seed failed');

      // Reverse order
      const result = await reorderTaskGroupsAction([
        c.data.id,
        b.data.id,
        a.data.id,
      ]);
      expect(result.ok).toBe(true);

      const admin = serviceClient();
      const { data: rows } = await admin
        .from('task_groups')
        .select('id, position')
        .in('id', [a.data.id, b.data.id, c.data.id])
        .order('position', { ascending: true });
      expect(rows?.[0]?.id).toBe(c.data.id);
      expect(rows?.[1]?.id).toBe(b.data.id);
      expect(rows?.[2]?.id).toBe(a.data.id);
    } finally {
      await user.cleanup();
    }
  });
});
