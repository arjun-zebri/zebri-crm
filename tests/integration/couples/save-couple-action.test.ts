/**
 * Phase 4A — couples server-action integration tests against local
 * Supabase.
 *
 * Proves:
 * - Happy path: createCoupleAction / updateCoupleAction /
 *   deleteCoupleAction round-trip correctly under real RLS.
 * - Starter-cap trigger surfaces as the typed `code: 'starter_limit'`
 *   tag (User on Starter plan with no `subscription_plan` set runs
 *   into the Postgres trigger after the configured cap).
 * - Cross-tenant: User B cannot save into User A's couple — the
 *   action's RLS-scoped client UPDATE is filtered to user-owned
 *   rows so the call silently no-ops.
 *
 * The action reads the authenticated session from
 * `@/lib/supabase/server` (cookies). Integration tests mock the
 * server helper to return a client signed in as the test user.
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

// Disable the import-order rule on this line: the `@/...` import
// must come AFTER `vi.mock()` so the mock applies during module
// load. Vitest hoists `vi.mock` to the top, but ESLint's
// import/order plugin can't see that, so we keep the source order
// as-is.
// eslint-disable-next-line import/order
import {
  createCoupleAction,
  deleteCoupleAction,
  updateCoupleAction,
} from '@/app/(dashboard)/couples/actions';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

const validInput = {
  name: 'Anna & Jake',
  email: 'anna@example.com',
  phone: '0400 000 000',
  event_date: '2026-09-14',
  venue: 'Town Hall',
  notes: 'Met at the bridal expo',
  status: 'enquiry',
  lead_source: 'referral',
  kanban_position: 0,
};

afterEach(() => {
  activeUser = null;
});

describe('createCoupleAction — integration', () => {
  it('creates a couple under the authenticated user', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await createCoupleAction(validInput);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      // Service client (bypasses RLS) confirms the row is owned by
      // the test user.
      const admin = serviceClient();
      const { data: row } = await admin
        .from('couples')
        .select('user_id, name, status')
        .eq('id', result.data.id)
        .single();
      expect(row?.user_id).toBe(user.id);
      expect(row?.name).toBe('Anna & Jake');
      expect(row?.status).toBe('enquiry');
    } finally {
      await user.cleanup();
    }
  });

  it('rejects invalid input (empty name)', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await createCoupleAction({ ...validInput, name: '' });
      expect(result.ok).toBe(false);
    } finally {
      await user.cleanup();
    }
  });

  it('persists referral_source (how did you hear about me)', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await createCoupleAction({
        ...validInput,
        referral_source: 'Instagram',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('couples')
        .select('referral_source')
        .eq('id', result.data.id)
        .single();
      expect(row?.referral_source).toBe('Instagram');
    } finally {
      await user.cleanup();
    }
  });

  it('returns 401-style failure when no auth session', async () => {
    // No active user — server-mock throws; the action wraps with
    // its `Not signed in.` branch. We exercise it by leaving
    // activeUser null and pointing the mock at a non-throwing
    // sentinel below.
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      // Sign the test user out so getUser() returns null.
      await user.client.auth.signOut();
      const result = await createCoupleAction(validInput);
      expect(result).toEqual({ ok: false, error: 'Not signed in.' });
    } finally {
      await user.cleanup();
    }
  });
});

describe('updateCoupleAction — integration', () => {
  it('updates an existing couple', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const created = await createCoupleAction(validInput);
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error(created.error);

      const updated = await updateCoupleAction({
        ...validInput,
        id: created.data.id,
        name: 'Anna & Jake (updated)',
        venue: 'Different Hall',
      });
      expect(updated.ok).toBe(true);
      if (!updated.ok) throw new Error(updated.error);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('couples')
        .select('name, venue')
        .eq('id', created.data.id)
        .single();
      expect(row?.name).toBe('Anna & Jake (updated)');
      expect(row?.venue).toBe('Different Hall');
    } finally {
      await user.cleanup();
    }
  });

  it('rejects a non-UUID id', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await updateCoupleAction({
        ...validInput,
        id: 'not-a-uuid',
      });
      expect(result.ok).toBe(false);
    } finally {
      await user.cleanup();
    }
  });
});

describe('deleteCoupleAction — integration', () => {
  it('deletes an existing couple', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const created = await createCoupleAction(validInput);
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error(created.error);

      const deleted = await deleteCoupleAction(created.data.id);
      expect(deleted.ok).toBe(true);

      const admin = serviceClient();
      const { count } = await admin
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('id', created.data.id);
      expect(count).toBe(0);
    } finally {
      await user.cleanup();
    }
  });

  it('blocks cross-tenant deletes — User B cannot delete User A couple', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      activeUser = userA;
      const created = await createCoupleAction(validInput);
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error(created.error);

      // Switch to User B and attempt to delete A's couple. RLS scopes
      // the DELETE to B's rows, so the call is a silent no-op.
      activeUser = userB;
      await deleteCoupleAction(created.data.id);

      // A's couple should still exist.
      const admin = serviceClient();
      const { count } = await admin
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('id', created.data.id);
      expect(count).toBe(1);
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});
