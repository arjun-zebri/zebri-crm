/**
 * Phase 4D — portal-action integration tests against local
 * Supabase.
 *
 * Five spot-tests covering happy paths + cross-tenant denial across
 * the four portal tables. Full Zod-branch coverage lives in the
 * unit suite.
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
  addPortalFileAction,
  addPortalPersonAction,
  addPortalSongAction,
  addPortalSongCategoryAction,
  deletePortalPersonAction,
} from '@/app/(dashboard)/couples/portal-actions';

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

describe('addPortalPersonAction — integration', () => {
  it('inserts a portal_people row owned by the user', async () => {
    const user = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(user);
      const result = await addPortalPersonAction({
        couple_id: coupleId,
        category: 'partner',
        full_name: 'Anna',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('portal_people')
        .select('user_id, couple_id, full_name, category')
        .eq('id', result.data.id)
        .single();
      expect(row?.user_id).toBe(user.id);
      expect(row?.couple_id).toBe(coupleId);
      expect(row?.full_name).toBe('Anna');
    } finally {
      await user.cleanup();
    }
  });
});

describe('addPortalSongAction — integration', () => {
  it('inserts a portal_songs row', async () => {
    const user = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(user);
      const result = await addPortalSongAction({
        couple_id: coupleId,
        category: 'first_dance',
        title: 'Our Song',
      });
      expect(result.ok).toBe(true);
    } finally {
      await user.cleanup();
    }
  });
});

describe('addPortalSongCategoryAction — integration', () => {
  it('inserts a category row', async () => {
    const user = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(user);
      const result = await addPortalSongCategoryAction({
        couple_id: coupleId,
        key: `custom_${Date.now()}`,
        label: 'Custom Category',
      });
      expect(result.ok).toBe(true);
    } finally {
      await user.cleanup();
    }
  });
});

describe('addPortalFileAction — integration', () => {
  it('inserts a portal_files metadata row', async () => {
    const user = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(user);
      const result = await addPortalFileAction({
        couple_id: coupleId,
        name: 'doc.pdf',
        file_url: 'https://example.test/doc.pdf',
        file_size: 1024,
      });
      expect(result.ok).toBe(true);
    } finally {
      await user.cleanup();
    }
  });
});

describe('deletePortalPersonAction — integration', () => {
  it('blocks cross-tenant deletes', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(userA);
      const created = await addPortalPersonAction({
        couple_id: coupleId,
        category: 'partner',
        full_name: 'Anna',
      });
      if (!created.ok) throw new Error(created.error);

      activeUser = userB;
      await deletePortalPersonAction(created.data.id);

      // A's row should still exist.
      const admin = serviceClient();
      const { count } = await admin
        .from('portal_people')
        .select('*', { count: 'exact', head: true })
        .eq('id', created.data.id);
      expect(count).toBe(1);
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});
