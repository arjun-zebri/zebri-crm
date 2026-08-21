/**
 * Per-meeting-type availability, end to end against the real schema.
 *
 * The unit tests cover the resolver with a stubbed Supabase; this proves
 * the same behaviour through real tables, real RLS-owned rows, and the
 * real `loadBookingContext` the public `/book/[token]` page calls: a type
 * on custom hours is bookable during its own windows and nowhere else,
 * while a type on standard hours follows the MC's weekly schedule.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadBookingContext } from '@/lib/booking/availability';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

describe('per-meeting-type availability', () => {
  let mc: TestUser;
  let standardToken: string;
  let customToken: string;
  let emptyCustomToken: string;

  beforeAll(async () => {
    mc = await createTestUser({}, pro);
    const admin = serviceClient();

    // The MC's standard week: Monday 9-5.
    await admin.from('availability_rules').insert({
      user_id: mc.id,
      weekday: 1,
      start_time: '09:00',
      end_time: '17:00',
    });

    const makeType = async (name: string, custom: boolean) => {
      const { data, error } = await admin
        .from('meeting_types')
        .insert({
          user_id: mc.id,
          name,
          duration_minutes: 30,
          uses_custom_availability: custom,
        })
        .select('id, share_token')
        .single();
      expect(error).toBeNull();
      return data!;
    };

    const standard = await makeType('Follow-up call', false);
    standardToken = standard.share_token;

    // Saturday mornings only, deliberately a day the standard week omits.
    const custom = await makeType('Site visit', true);
    customToken = custom.share_token;
    const { error: rulesError } = await admin
      .from('meeting_type_availability_rules')
      .insert([
        {
          user_id: mc.id,
          meeting_type_id: custom.id,
          weekday: 6,
          start_time: '08:00',
          end_time: '11:00',
        },
        {
          user_id: mc.id,
          meeting_type_id: custom.id,
          weekday: 6,
          start_time: '15:00',
          end_time: '18:30',
        },
      ]);
    expect(rulesError).toBeNull();

    // Custom, but with nothing switched on: never bookable.
    const emptyCustom = await makeType('Paused hours', true);
    emptyCustomToken = emptyCustom.share_token;
  });

  afterAll(async () => {
    await mc?.cleanup();
  });

  it('gives a standard type the MC weekly hours', async () => {
    const ctx = await loadBookingContext(serviceClient(), standardToken);

    expect(ctx!.rules).toEqual([
      { weekday: 1, start_time: '09:00', end_time: '17:00' },
    ]);
  });

  it('gives a custom type its own hours instead of the standard ones', async () => {
    const ctx = await loadBookingContext(serviceClient(), customToken);

    expect(ctx!.rules).toHaveLength(2);
    expect(ctx!.rules.every((rule) => rule.weekday === 6)).toBe(true);
    // The standard Monday window must not leak in: custom hours replace.
    expect(ctx!.rules.some((rule) => rule.weekday === 1)).toBe(false);
  });

  it('leaves a custom type with no windows unbookable rather than falling back', async () => {
    const ctx = await loadBookingContext(serviceClient(), emptyCustomToken);

    expect(ctx!.rules).toEqual([]);
  });

  it('keeps one type\'s hours out of another type\'s context', async () => {
    const custom = await loadBookingContext(serviceClient(), customToken);
    const standard = await loadBookingContext(serviceClient(), standardToken);

    expect(custom!.rules).not.toEqual(standard!.rules);
  });

  it('applies the MC date overrides to a custom-hours type too', async () => {
    const admin = serviceClient();
    await admin.from('availability_overrides').insert({
      user_id: mc.id,
      date: '2026-12-19',
      available: false,
    });

    const ctx = await loadBookingContext(serviceClient(), customToken);

    expect(ctx!.overrides).toEqual([
      { date: '2026-12-19', available: false, start_time: null, end_time: null },
    ]);
  });
});
