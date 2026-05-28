/**
 * Phase 5 — contact-action integration tests against local Supabase.
 *
 * Proves the create / update / delete / bulk paths round-trip
 * under real RLS and that cross-tenant attempts silently no-op.
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
  bulkDeleteContactsAction,
  bulkUpdateContactsStatusAction,
  createContactAction,
  deleteContactAction,
  updateContactAction,
} from '@/app/(dashboard)/contacts/actions';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

afterEach(() => {
  activeUser = null;
});

describe('createContactAction — integration', () => {
  it('creates a contact owned by the user', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await createContactAction({
        name: 'Test Photographer',
        category: 'photographer',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('contacts')
        .select('user_id, name, category, status')
        .eq('id', result.data.id)
        .single();
      expect(row?.user_id).toBe(user.id);
      expect(row?.name).toBe('Test Photographer');
      expect(row?.category).toBe('photographer');
      expect(row?.status).toBe('active'); // default
    } finally {
      await user.cleanup();
    }
  });

  it('rejects an invalid category (not in the canonical enum)', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await createContactAction({
        name: 'Sneaky',
        // Cast through unknown — the Zod schema is the runtime gate;
        // we're deliberately handing it a value the type system would
        // reject, to exercise the rejection branch.
        category: 'astronaut' as unknown as 'photographer',
      });
      expect(result.ok).toBe(false);
    } finally {
      await user.cleanup();
    }
  });
});

describe('updateContactAction — integration', () => {
  it('updates allowed fields', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const created = await createContactAction({
        name: 'Original Vendor',
        category: 'florist',
      });
      if (!created.ok) throw new Error(created.error);

      const updated = await updateContactAction({
        id: created.data.id,
        name: 'Renamed Vendor',
        category: 'florist',
        email: 'vendor@example.test',
        phone: '0400 000 000',
      });
      expect(updated.ok).toBe(true);
      if (!updated.ok) throw new Error(updated.error);
      expect(updated.data.name).toBe('Renamed Vendor');
      expect(updated.data.email).toBe('vendor@example.test');
    } finally {
      await user.cleanup();
    }
  });
});

describe('deleteContactAction — integration', () => {
  it('blocks cross-tenant deletes', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      activeUser = userA;
      const created = await createContactAction({
        name: 'A Vendor',
        category: 'photographer',
      });
      if (!created.ok) throw new Error(created.error);

      activeUser = userB;
      await deleteContactAction(created.data.id);

      // A's contact should still exist.
      const admin = serviceClient();
      const { count } = await admin
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('id', created.data.id);
      expect(count).toBe(1);
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});

describe('bulkDeleteContactsAction — integration', () => {
  it('deletes every selected row', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const a = await createContactAction({
        name: 'Vendor A',
        category: 'photographer',
      });
      const b = await createContactAction({
        name: 'Vendor B',
        category: 'videographer',
      });
      if (!a.ok || !b.ok) throw new Error('seed failed');

      const result = await bulkDeleteContactsAction([a.data.id, b.data.id]);
      expect(result.ok).toBe(true);

      const admin = serviceClient();
      const { count } = await admin
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .in('id', [a.data.id, b.data.id]);
      expect(count).toBe(0);
    } finally {
      await user.cleanup();
    }
  });
});

describe('bulkUpdateContactsStatusAction — integration', () => {
  it('flips status on every selected row', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const a = await createContactAction({
        name: 'V1',
        category: 'florist',
      });
      const b = await createContactAction({
        name: 'V2',
        category: 'celebrant',
      });
      if (!a.ok || !b.ok) throw new Error('seed failed');

      const result = await bulkUpdateContactsStatusAction({
        ids: [a.data.id, b.data.id],
        status: 'inactive',
      });
      expect(result.ok).toBe(true);

      const admin = serviceClient();
      const { data } = await admin
        .from('contacts')
        .select('status')
        .in('id', [a.data.id, b.data.id]);
      expect(data?.every((r) => r.status === 'inactive')).toBe(true);
    } finally {
      await user.cleanup();
    }
  });
});
