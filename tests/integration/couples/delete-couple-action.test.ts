/**
 * Integration coverage for `deleteCoupleAction` against local Supabase
 * (real schema, real RLS).
 *
 * Regression: deleting a couple that owned an event aborted with
 * `automation_events_couple_id_fkey`. The cascade into `events` fired
 * the `event_deleted` emit, whose bus row pointed back at the couple
 * being deleted. Migration 20261027000000 skips that emit mid-cascade.
 * These tests pin:
 * - A couple with an event deletes, and its events go with it.
 * - Deleting a single event (couple kept) still emits `event_deleted`.
 * - Cross-tenant: User B cannot delete User A's couple.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

let activeUser: TestUser | null = null;
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser)
      throw new Error('No active test user, set `activeUser` before calling');
    return activeUser.client;
  }),
}));

// eslint-disable-next-line import/order
import {
  createCoupleAction,
  deleteCoupleAction,
  upsertCoupleEventDateAction,
} from '@/app/(dashboard)/couples/actions';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

afterEach(() => {
  activeUser = null;
});

/** Create a couple with one event, as the active user. */
async function coupleWithEvent(): Promise<string> {
  const created = await createCoupleAction({
    name: 'Test & Test',
    status: 'new',
    event_date: null,
  });
  if (!created.ok) throw new Error(created.error);
  const dated = await upsertCoupleEventDateAction({
    coupleId: created.data.id,
    date: '2027-09-23',
    venue: 'Zonzo Estate',
  });
  if (!dated.ok) throw new Error(dated.error);
  return created.data.id;
}

describe('deleteCoupleAction', () => {
  it('deletes a couple that owns an event', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await coupleWithEvent();

      const result = await deleteCoupleAction(coupleId);
      expect(result).toEqual({ ok: true, data: undefined });

      const admin = serviceClient();
      const { count: couples } = await admin
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('id', coupleId);
      expect(couples).toBe(0);
      const { count: events } = await admin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('couple_id', coupleId);
      expect(events).toBe(0);
    } finally {
      await user.cleanup();
    }
  });

  it('still emits event_deleted when only the event is deleted', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await coupleWithEvent();
      const admin = serviceClient();
      const { data: event } = await admin
        .from('events')
        .select('id')
        .eq('couple_id', coupleId)
        .single();
      expect(event).not.toBeNull();

      const { error } = await user.client
        .from('events')
        .delete()
        .eq('id', event!.id);
      expect(error).toBeNull();

      const { count } = await admin
        .from('automation_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'event_deleted')
        .eq('source_id', event!.id);
      expect(count).toBe(1);
    } finally {
      await user.cleanup();
    }
  });

  it('blocks cross-tenant deletes: User B cannot delete User A couple', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      activeUser = userA;
      const coupleId = await coupleWithEvent();

      activeUser = userB;
      await deleteCoupleAction(coupleId);

      const { count } = await serviceClient()
        .from('couples')
        .select('*', { count: 'exact', head: true })
        .eq('id', coupleId);
      expect(count).toBe(1);
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});
