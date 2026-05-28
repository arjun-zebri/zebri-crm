/**
 * Phase 4C — event action integration tests against local Supabase.
 *
 * Proves the create/update/delete event path round-trips under real
 * RLS and that cross-tenant deletes are silent no-ops.
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
  createEventAction,
  deleteEventAction,
  updateEventAction,
} from '@/lib/events/actions';

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

describe('createEventAction — integration', () => {
  it('creates an event linked to the couple', async () => {
    const user = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(user);
      const result = await createEventAction({
        couple_id: coupleId,
        date: '2026-09-14',
        venue: 'Town Hall',
        timeline_notes: 'arrive 30 min early',
        status: 'upcoming',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('events')
        .select('user_id, couple_id, venue, status')
        .eq('id', result.data.id)
        .single();
      expect(row?.user_id).toBe(user.id);
      expect(row?.couple_id).toBe(coupleId);
      expect(row?.venue).toBe('Town Hall');
      expect(row?.status).toBe('upcoming');
    } finally {
      await user.cleanup();
    }
  });

  it('rejects a malformed date', async () => {
    const user = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(user);
      const result = await createEventAction({
        couple_id: coupleId,
        date: '14/09/2026',
        venue: '',
        timeline_notes: '',
        status: 'upcoming',
      });
      expect(result.ok).toBe(false);
    } finally {
      await user.cleanup();
    }
  });
});

describe('updateEventAction — integration', () => {
  it('updates allowed fields', async () => {
    const user = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(user);
      const created = await createEventAction({
        couple_id: coupleId,
        date: '2026-09-14',
        venue: 'Original',
        timeline_notes: '',
        status: 'upcoming',
      });
      if (!created.ok) throw new Error(created.error);

      const updated = await updateEventAction({
        id: created.data.id,
        couple_id: coupleId,
        date: '2026-10-01',
        venue: 'Different',
        timeline_notes: 'now with notes',
        status: 'upcoming',
      });
      expect(updated.ok).toBe(true);

      const admin = serviceClient();
      const { data: row } = await admin
        .from('events')
        .select('date, venue, timeline_notes')
        .eq('id', created.data.id)
        .single();
      expect(row?.date).toBe('2026-10-01');
      expect(row?.venue).toBe('Different');
      expect(row?.timeline_notes).toBe('now with notes');
    } finally {
      await user.cleanup();
    }
  });
});

describe('deleteEventAction — integration', () => {
  it('blocks cross-tenant deletes', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      const coupleId = await arrangeCouple(userA);
      const created = await createEventAction({
        couple_id: coupleId,
        date: '2026-09-14',
        venue: 'A Venue',
        timeline_notes: '',
        status: 'upcoming',
      });
      if (!created.ok) throw new Error(created.error);

      activeUser = userB;
      await deleteEventAction(created.data.id);

      // A's event should still exist.
      const admin = serviceClient();
      const { count } = await admin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('id', created.data.id);
      expect(count).toBe(1);
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});
