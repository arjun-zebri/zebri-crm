/**
 * Integration coverage for couple event-date writes against local
 * Supabase (real schema, real RLS).
 *
 * The couple-level `event_date` column is legacy/dead — the schedule
 * lives in the `events` table. So adding a date (manually or via CSV)
 * must create/update a real event row. These tests pin that:
 * - `upsertCoupleEventDateAction` creates an event when the couple has
 *   none, and updates the soonest event (no duplicate) when it does.
 * - Cross-tenant: a user can't write an event onto another's couple.
 * - `bulkCreateCouplesAction` creates events for imported rows that
 *   carry a date + venue.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

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
import {
  bulkCreateCouplesAction,
  createCoupleAction,
  upsertCoupleEventDateAction,
} from '@/app/(dashboard)/couples/actions';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

const baseCouple = { name: 'Anna & Jake', status: 'new', event_date: null };

afterEach(() => {
  activeUser = null;
});

async function newCouple(): Promise<string> {
  const created = await createCoupleAction(baseCouple);
  if (!created.ok) throw new Error(created.error);
  return created.data.id;
}

describe('upsertCoupleEventDateAction', () => {
  it('creates an event when the couple has none', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await newCouple();
      const result = await upsertCoupleEventDateAction({
        coupleId,
        date: '2026-09-14',
        venue: 'Town Hall',
        venue_phone: '02 9000 0000',
        venue_lat: -33.87,
        venue_lng: 151.21,
      });
      expect(result.ok).toBe(true);

      const admin = serviceClient();
      const { data: events } = await admin
        .from('events')
        .select('date, venue, venue_phone, venue_lat')
        .eq('couple_id', coupleId);
      expect(events).toHaveLength(1);
      expect(events?.[0]?.date).toBe('2026-09-14');
      expect(events?.[0]?.venue).toBe('Town Hall');
      expect(events?.[0]?.venue_phone).toBe('02 9000 0000');
      expect(events?.[0]?.venue_lat).toBe(-33.87);
    } finally {
      await user.cleanup();
    }
  });

  it('updates the soonest event instead of creating a duplicate', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const coupleId = await newCouple();
      await upsertCoupleEventDateAction({ coupleId, date: '2026-09-14' });
      await upsertCoupleEventDateAction({ coupleId, date: '2027-01-01' });

      const admin = serviceClient();
      const { data: events } = await admin
        .from('events')
        .select('date')
        .eq('couple_id', coupleId);
      expect(events).toHaveLength(1);
      expect(events?.[0]?.date).toBe('2027-01-01');
    } finally {
      await user.cleanup();
    }
  });

  it('blocks cross-tenant writes — User B cannot date User A couple', async () => {
    const userA = await createTestUser({}, pro);
    const userB = await createTestUser({}, pro);
    try {
      activeUser = userA;
      const coupleId = await newCouple();

      activeUser = userB;
      await upsertCoupleEventDateAction({ coupleId, date: '2026-09-14' });

      const admin = serviceClient();
      const { count } = await admin
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('couple_id', coupleId);
      expect(count).toBe(0);
    } finally {
      await userA.cleanup();
      await userB.cleanup();
    }
  });
});

describe('bulkCreateCouplesAction — event creation', () => {
  it('creates events for imported rows that carry a date + venue', async () => {
    const user = await createTestUser({}, pro);
    activeUser = user;
    try {
      const result = await bulkCreateCouplesAction([
        { name: 'Has Date', status: 'new', event_date: '2026-10-10', venue: 'The Grand' },
        { name: 'No Date', status: 'new', event_date: null },
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.data.created).toBe(2);

      const admin = serviceClient();
      const { data: events } = await admin
        .from('events')
        .select('date, venue, couple:couples(name)')
        .eq('user_id', user.id);
      expect(events).toHaveLength(1);
      expect(events?.[0]?.date).toBe('2026-10-10');
      expect(events?.[0]?.venue).toBe('The Grand');
    } finally {
      await user.cleanup();
    }
  });
});
