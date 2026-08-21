import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/calendar/free-busy', () => ({
  getBusyIntervals: vi.fn(),
  FreeBusyUnavailableError: class FreeBusyUnavailableError extends Error {
    constructor(public provider: string, cause?: unknown) {
      super(`free/busy unavailable for ${provider}`);
      this.name = 'FreeBusyUnavailableError';
      this.cause = cause;
    }
  },
}));

import {
  BookingsUnavailableError,
  getBookableSlots,
  isSlotBookable,
  loadBookingContext,
  loadBookingContextByManageToken,
  type BookingContext,
} from '@/lib/booking/availability';
import { FreeBusyUnavailableError, getBusyIntervals } from '@/lib/calendar/free-busy';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

/**
 * Minimal supabase stub supporting select().eq(...).gte(...).lt(...) chaining.
 * Returns a thenable/awaitable query builder.
 */
function fakeSupabase(
  data: Record<string, unknown[] | null> = {},
): {
  from: (table: string) => any;
  calls: Array<{ table: string; method: string; args: unknown[] }>;
} {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  const createQueryBuilder = (
    table: string,
    tableData: unknown,
    filters: Array<{ column: string; op: string; value: unknown }> = [],
  ) => {
    const applyFilters = (): unknown[] => {
      if (!Array.isArray(tableData)) return [];
      let result = [...tableData];
      for (const filter of filters) {
        result = result.filter((row: Record<string, unknown>) => {
          const rowVal = row[filter.column] as unknown;
          const filterVal = filter.value as unknown;
          if (filter.op === 'eq') return rowVal === filterVal;
          if (filter.op === 'gte') return (rowVal as any) >= (filterVal as any);
          if (filter.op === 'lt') return (rowVal as any) < (filterVal as any);
          return true;
        });
      }
      return result;
    };

    return {
      eq: (col: string, val: unknown) => {
        calls.push({ table, method: 'eq', args: [col, val] });
        return createQueryBuilder(table, tableData, [...filters, { column: col, op: 'eq', value: val }]);
      },
      gte: (col: string, val: unknown) => {
        calls.push({ table, method: 'gte', args: [col, val] });
        return createQueryBuilder(table, tableData, [...filters, { column: col, op: 'gte', value: val }]);
      },
      lt: (col: string, val: unknown) => {
        calls.push({ table, method: 'lt', args: [col, val] });
        return createQueryBuilder(table, tableData, [...filters, { column: col, op: 'lt', value: val }]);
      },
      single: async () => {
        const result = applyFilters();
        const row = result[0];
        return { data: row ?? null, error: null };
      },
      then: (onFulfilled?: (result: any) => any) => {
        const result = applyFilters();
        const response = { data: result, error: null };
        return Promise.resolve(onFulfilled ? onFulfilled(response) : response);
      },
    };
  };

  return {
    from: (table: string) => ({
      select: (cols: string) => {
        calls.push({ table, method: 'select', args: [cols] });
        return createQueryBuilder(table, data[table] ?? []);
      },
    }),
    calls,
  };
}

function fakeMeetingType(
  overrides: Partial<Database['public']['Tables']['meeting_types']['Row']> = {},
): Database['public']['Tables']['meeting_types']['Row'] {
  return {
    id: 'mt-1',
    user_id: 'user-1',
    name: 'Discovery Call',
    share_token: 'token-1',
    duration_minutes: 30,
    buffer_before_minutes: 15,
    buffer_after_minutes: 15,
    min_notice_hours: 24,
    max_advance_days: 60,
    active: true,
    address: null,
    location_type: 'online',
    description: null,
    reminder_enabled: true,
    uses_custom_availability: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function fakeRule(
  overrides: Partial<Database['public']['Tables']['availability_rules']['Row']> = {},
): Database['public']['Tables']['availability_rules']['Row'] {
  return {
    id: 'rule-1',
    user_id: 'user-1',
    weekday: 1,
    start_time: '09:00:00',
    end_time: '17:00:00',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function fakeOverride(
  overrides: Partial<Database['public']['Tables']['availability_overrides']['Row']> = {},
): Database['public']['Tables']['availability_overrides']['Row'] {
  return {
    id: 'override-1',
    user_id: 'user-1',
    date: '2026-08-25',
    available: true,
    start_time: '10:00:00',
    end_time: '12:00:00',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function fakeBooking(
  overrides: Partial<Database['public']['Tables']['bookings']['Row']> = {},
): Database['public']['Tables']['bookings']['Row'] {
  return {
    id: 'book-1',
    manage_token: 'manage-token-1',
    meeting_type_id: 'mt-1',
    couple_id: null,
    name: 'Alice',
    email: 'alice@example.com',
    phone: '0400000000',
    status: 'confirmed',
    starts_at: '2026-08-25T10:00:00Z',
    ends_at: '2026-08-25T10:30:00Z',
    notes: null,
    cancelled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    partner_name: null,
    user_id: 'user-1',
    timezone: 'Australia/Sydney',
    external_event_ids: null,
    video_join_url: null,
    reminder_sent_at: null,
    ...overrides,
  };
}

describe('loadBookingContext', () => {
  beforeEach(() => {
    vi.mocked(getBusyIntervals).mockReset();
    vi.mocked(createAdminClient).mockReset();
  });

  it('returns null when share token is unknown', async () => {
    const admin = fakeSupabase();
    vi.mocked(createAdminClient).mockReturnValue(admin as any);

    const db = fakeSupabase() as any;
    const result = await loadBookingContext(db, 'unknown-token');
    expect(result).toBeNull();
  });

  it('returns null when meeting type is inactive', async () => {
    const admin = fakeSupabase({
      meeting_types: [
        fakeMeetingType({ active: false, id: 'mt-1' }),
      ] as Database['public']['Tables']['meeting_types']['Row'][],
    });
    vi.mocked(createAdminClient).mockReturnValue(admin as any);

    const db = fakeSupabase() as any;
    const result = await loadBookingContext(db, 'token-1');
    expect(result).toBeNull();
  });

  it('loads meeting type, rules, overrides and defaults timezone to Sydney', async () => {
    const mt = fakeMeetingType({ id: 'mt-1' });
    const rule = fakeRule({ user_id: 'user-1' });
    const override = fakeOverride({ user_id: 'user-1' });

    const admin = fakeSupabase({
      meeting_types: [mt],
      availability_rules: [rule],
      availability_overrides: [override],
      user_public_settings: [{ timezone: null, user_id: 'user-1' }] as any,
    });
    vi.mocked(createAdminClient).mockReturnValue(admin as any);

    const db = fakeSupabase() as any;
    const result = await loadBookingContext(db, 'token-1');
    expect(result).not.toBeNull();
    expect(result!.timezone).toBe('Australia/Sydney');
    expect(result!.rules).toHaveLength(1);
    expect(result!.overrides).toHaveLength(1);
  });

  it('reads the type\'s own hours when it is on custom availability', async () => {
    const mt = fakeMeetingType({ id: 'mt-1', uses_custom_availability: true });

    const admin = fakeSupabase({
      meeting_types: [mt],
      // The MC's standard week says Monday 9-5. This type says Saturday 8-11,
      // and custom hours replace rather than narrow, so only Saturday shows.
      availability_rules: [fakeRule({ user_id: 'user-1', weekday: 1 })],
      meeting_type_availability_rules: [
        { meeting_type_id: 'mt-1', weekday: 6, start_time: '08:00:00', end_time: '11:00:00' },
      ] as any,
      availability_overrides: [],
      user_public_settings: [{ timezone: 'Australia/Sydney', user_id: 'user-1' }] as any,
    });
    vi.mocked(createAdminClient).mockReturnValue(admin as any);

    const db = fakeSupabase() as any;
    const result = await loadBookingContext(db, 'token-1');

    expect(result!.rules).toEqual([
      { weekday: 6, start_time: '08:00', end_time: '11:00' },
    ]);
  });

  it('still applies user-level date overrides to a custom-hours type', async () => {
    const mt = fakeMeetingType({ id: 'mt-1', uses_custom_availability: true });

    const admin = fakeSupabase({
      meeting_types: [mt],
      availability_rules: [],
      meeting_type_availability_rules: [
        { meeting_type_id: 'mt-1', weekday: 6, start_time: '08:00:00', end_time: '11:00:00' },
      ] as any,
      availability_overrides: [fakeOverride({ user_id: 'user-1' })],
      user_public_settings: [{ timezone: 'Australia/Sydney', user_id: 'user-1' }] as any,
    });
    vi.mocked(createAdminClient).mockReturnValue(admin as any);

    const db = fakeSupabase() as any;
    const result = await loadBookingContext(db, 'token-1');

    expect(result!.overrides).toHaveLength(1);
  });

  it('leaves a custom-hours type with no windows unbookable rather than falling back', async () => {
    const mt = fakeMeetingType({ id: 'mt-1', uses_custom_availability: true });

    const admin = fakeSupabase({
      meeting_types: [mt],
      availability_rules: [fakeRule({ user_id: 'user-1' })],
      meeting_type_availability_rules: [],
      availability_overrides: [],
      user_public_settings: [{ timezone: 'Australia/Sydney', user_id: 'user-1' }] as any,
    });
    vi.mocked(createAdminClient).mockReturnValue(admin as any);

    const db = fakeSupabase() as any;
    const result = await loadBookingContext(db, 'token-1');

    expect(result!.rules).toEqual([]);
  });

  it('uses user timezone when available', async () => {
    const mt = fakeMeetingType({ id: 'mt-1' });

    const admin = fakeSupabase({
      meeting_types: [mt],
      availability_rules: [],
      availability_overrides: [],
      user_public_settings: [{ timezone: 'America/New_York', user_id: 'user-1' }] as any,
    });
    vi.mocked(createAdminClient).mockReturnValue(admin as any);

    const db = fakeSupabase() as any;
    const result = await loadBookingContext(db, 'token-1');
    expect(result!.timezone).toBe('America/New_York');
  });
});

describe('getBookableSlots', () => {
  beforeEach(() => {
    vi.mocked(getBusyIntervals).mockReset();
  });

  it('propagates FreeBusyUnavailableError', async () => {
    const ctx: BookingContext = {
      meetingType: fakeMeetingType(),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockRejectedValue(
      new FreeBusyUnavailableError('google', new Error('auth failed')),
    );

    const db = fakeSupabase({ bookings: [] });

    vi.mocked(createAdminClient).mockReturnValue(db as any);

    await expect(
      getBookableSlots(ctx, { start: new Date('2026-08-24'), end: new Date('2026-08-31') }),
    ).rejects.toThrow(FreeBusyUnavailableError);
  });

  it('excludes confirmed bookings from available slots', async () => {
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockResolvedValue([]);

    const db = fakeSupabase({
      bookings: [
        fakeBooking({
          status: 'confirmed',
          starts_at: '2026-08-25T10:00:00Z',
          ends_at: '2026-08-25T10:30:00Z',
        }),
      ] as Database['public']['Tables']['bookings']['Row'][],
    });
    vi.mocked(createAdminClient).mockReturnValue(db as any);

    const slots = await getBookableSlots(
      ctx,
      { start: new Date('2026-08-25'), end: new Date('2026-08-26') },
      new Date('2026-08-25T08:00:00Z'),
    );

    // The confirmed booking should prevent the overlapping slot
    const bookedSlot = slots.find(
      (s) => s.start === '2026-08-25T10:00:00Z' && s.end === '2026-08-25T10:30:00Z',
    );
    expect(bookedSlot).toBeUndefined();
  });

  it('returns slots when no busy intervals or bookings', async () => {
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockResolvedValue([]);

    const db = fakeSupabase({ bookings: [] });

    vi.mocked(createAdminClient).mockReturnValue(db as any);

    // Monday 2026-08-24 Sydney time = 2026-08-23T14:00:00Z to 2026-08-24T14:00:00Z
    const slots = await getBookableSlots(
      ctx,
      { start: new Date('2026-08-23T14:00:00Z'), end: new Date('2026-08-24T14:00:00Z') },
      new Date('2026-08-23T14:00:00Z'),
    );

    expect(slots.length).toBeGreaterThan(0);
  });
});

describe('isSlotBookable', () => {
  beforeEach(() => {
    vi.mocked(getBusyIntervals).mockReset();
  });

  it('returns true for an offered slot', async () => {
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockResolvedValue([]);

    const db = fakeSupabase({ bookings: [] });

    vi.mocked(createAdminClient).mockReturnValue(db as any);

    // 2026-08-23T23:00:00Z is 2026-08-24T09:00:00 Sydney (Monday 9am)
    const isBookable = await isSlotBookable(
        ctx,
      new Date('2026-08-23T23:00:00Z'),
      new Date('2026-08-23T23:30:00Z'),
      new Date('2026-08-23T14:00:00Z'),
    );

    expect(isBookable).toBe(true);
  });

  it('returns false for an overlapping slot', async () => {
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockResolvedValue([
      {
        start: '2026-08-25T10:15:00Z',
        end: '2026-08-25T10:45:00Z',
      },
    ]);

    const db = fakeSupabase({ bookings: [] });

    vi.mocked(createAdminClient).mockReturnValue(db as any);

    const isBookable = await isSlotBookable(
        ctx,
      new Date('2026-08-25T10:00:00Z'),
      new Date('2026-08-25T10:30:00Z'),
      new Date('2026-08-25T08:00:00Z'),
    );

    expect(isBookable).toBe(false);
  });

  it('returns false for wrong duration', async () => {
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockResolvedValue([]);

    const db = fakeSupabase({ bookings: [] });

    vi.mocked(createAdminClient).mockReturnValue(db as any);

    const isBookable = await isSlotBookable(
        ctx,
      new Date('2026-08-25T10:00:00Z'),
      new Date('2026-08-25T11:00:00Z'), // 60 minutes instead of 30
      new Date('2026-08-25T08:00:00Z'),
    );

    expect(isBookable).toBe(false);
  });

  it('correctly handles day boundary: UTC slot on previous day maps to correct local date', async () => {
    // Regression: isSlotBookable must compute the local date, not UTC date.
    // 2026-08-23T23:00:00Z is Sunday 23:00 UTC, but Monday 09:00 AEST (Sydney UTC+10).
    // With Monday rule 09:00-17:00, the slot should be bookable.
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockResolvedValue([]);

    const db = fakeSupabase({ bookings: [] }) as any;

    vi.mocked(createAdminClient).mockReturnValue(db);

    // 2026-08-23T23:00:00Z = 2026-08-24T09:00:00 Sydney (Monday 09:00)
    const isBookable = await isSlotBookable(
        ctx,
      new Date('2026-08-23T23:00:00Z'),
      new Date('2026-08-23T23:30:00Z'),
      new Date('2026-08-23T14:00:00Z'),
    );

    // Must be true because this is Monday 09:00-09:30 in Sydney time
    expect(isBookable).toBe(true);
  });

  it('getBookableSlots throws BookingsUnavailableError when bookings query fails', async () => {
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockResolvedValue([]);

    // Create a fake Supabase that returns an error for bookings query
    const db = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      from: (_table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                lt: () =>
                  Promise.resolve({
                    data: null,
                    error: new Error('bookings permission denied'),
                  }),
              }),
            }),
          }),
        }),
      }),
    } as any;
    vi.mocked(createAdminClient).mockReturnValue(db);

    await expect(
      getBookableSlots(
      ctx,
        { start: new Date('2026-08-23T14:00:00Z'), end: new Date('2026-08-24T14:00:00Z') },
        new Date('2026-08-23T14:00:00Z'),
      ),
    ).rejects.toThrow(BookingsUnavailableError);
  });

  it('isSlotBookable throws BookingsUnavailableError when bookings query fails', async () => {
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockResolvedValue([]);

    // Create a fake Supabase that returns an error for bookings query
    const db = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      from: (_table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                lt: () =>
                  Promise.resolve({
                    data: null,
                    error: new Error('bookings permission denied'),
                  }),
              }),
            }),
          }),
        }),
      }),
    } as any;
    vi.mocked(createAdminClient).mockReturnValue(db);

    await expect(
      isSlotBookable(
        ctx,
        new Date('2026-08-23T23:00:00Z'),
        new Date('2026-08-23T23:30:00Z'),
        new Date('2026-08-23T14:00:00Z'),
      ),
    ).rejects.toThrow(BookingsUnavailableError);
  });
});

describe('loadBookingContextByManageToken', () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReset();
  });

  it('returns null when manage token is unknown', async () => {
    const admin = fakeSupabase({
      bookings: [],
    });
    vi.mocked(createAdminClient).mockReturnValue(admin as any);

    const db = fakeSupabase() as any;

    vi.mocked(createAdminClient).mockReturnValue(db);
    const result = await loadBookingContextByManageToken(db, 'unknown-manage-token');
    expect(result).toBeNull();
  });

  it('loads booking context by manage token and returns booking metadata', async () => {
    const mt = fakeMeetingType({ id: 'mt-1', user_id: 'user-1' });
    const rule = fakeRule({ user_id: 'user-1' });
    const override = fakeOverride({ user_id: 'user-1' });
    const booking = fakeBooking({
      id: 'book-1',
      manage_token: 'manage-token-1',
      meeting_type_id: 'mt-1',
      status: 'confirmed',
      starts_at: '2026-08-25T10:00:00Z',
      ends_at: '2026-08-25T10:30:00Z',
      user_id: 'user-1',
    });

    const admin = fakeSupabase({
      meeting_types: [mt],
      availability_rules: [rule],
      availability_overrides: [override],
      user_public_settings: [{ timezone: 'Australia/Sydney', user_id: 'user-1' }] as any,
      bookings: [booking],
    });
    vi.mocked(createAdminClient).mockReturnValue(admin as any);

    const db = fakeSupabase({ bookings: [booking] }) as any;

    const result = await loadBookingContextByManageToken(db, 'manage-token-1');

    expect(result).not.toBeNull();
    expect(result!.ctx).toBeDefined();
    expect(result!.bookingId).toBe('book-1');
    expect(result!.startsAt).toBe('2026-08-25T10:00:00Z');
    expect(result!.endsAt).toBe('2026-08-25T10:30:00Z');
    expect(result!.status).toBe('confirmed');
  });
});

describe('getBookableSlots with excludeBookingId', () => {
  beforeEach(() => {
    vi.mocked(getBusyIntervals).mockReset();
  });

  it('excludes the specified booking while other bookings remain busy', async () => {
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockResolvedValue([]);

    const excludedBooking = fakeBooking({
      id: 'book-excluded',
      status: 'confirmed',
      starts_at: '2026-08-23T23:00:00Z', // Monday 09:00 Sydney
      ends_at: '2026-08-23T23:30:00Z', // Monday 09:30 Sydney
    });
    const otherBooking = fakeBooking({
      id: 'book-other',
      status: 'confirmed',
      starts_at: '2026-08-24T04:00:00Z', // Monday 14:00 Sydney
      ends_at: '2026-08-24T04:30:00Z', // Monday 14:30 Sydney
    });

    const db = fakeSupabase({
      bookings: [excludedBooking, otherBooking],
    });
    vi.mocked(createAdminClient).mockReturnValue(db as any);

    const slots = await getBookableSlots(
      ctx,
      { start: new Date('2026-08-23T14:00:00Z'), end: new Date('2026-08-24T14:00:00Z') }, // Sunday to Monday in Sydney
      new Date('2026-08-23T14:00:00Z'),
      'book-excluded',
    );

    // The excluded booking should be available (09:00-09:30 should appear)
    const excludedSlot = slots.find(
      (s) => s.start === '2026-08-23T23:00:00Z' && s.end === '2026-08-23T23:30:00Z',
    );
    expect(excludedSlot).toBeDefined();

    // The other booking should remain unavailable (14:00-14:30 should not appear)
    const otherSlot = slots.find(
      (s) => s.start === '2026-08-24T04:00:00Z' && s.end === '2026-08-24T04:30:00Z',
    );
    expect(otherSlot).toBeUndefined();
  });
});

describe('isSlotBookable with excludeBookingId', () => {
  beforeEach(() => {
    vi.mocked(getBusyIntervals).mockReset();
  });

  it('returns true for the excluded booking\'s own current slot', async () => {
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    vi.mocked(getBusyIntervals).mockResolvedValue([]);

    const excludedBooking = fakeBooking({
      id: 'book-1',
      status: 'confirmed',
      starts_at: '2026-08-23T23:00:00Z', // Monday 09:00 Sydney
      ends_at: '2026-08-23T23:30:00Z', // Monday 09:30 Sydney
    });

    const db = fakeSupabase({
      bookings: [excludedBooking],
    });
    vi.mocked(createAdminClient).mockReturnValue(db as any);

    // Check if the excluded booking's own time slot is available when excluded
    const isBookable = await isSlotBookable(
        ctx,
      new Date('2026-08-23T23:00:00Z'),
      new Date('2026-08-23T23:30:00Z'),
      new Date('2026-08-23T14:00:00Z'),
      'book-1',
    );

    expect(isBookable).toBe(true);
  });

  it('returns true when external calendar covers excluded booking, but exclusion subtracts the interval', async () => {
    // Regression: when a booking is pushed to the MC's calendar, getBusyIntervals
    // reports that window as busy. Excluding the booking must also remove it from
    // external busy to free the slot.
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    const excludedBooking = fakeBooking({
      id: 'book-1',
      status: 'confirmed',
      starts_at: '2026-08-23T23:00:00Z', // Monday 09:00 Sydney
      ends_at: '2026-08-23T23:30:00Z', // Monday 09:30 Sydney
    });

    // External calendar reports the booking's window as busy (it was pushed there)
    vi.mocked(getBusyIntervals).mockResolvedValue([
      {
        start: '2026-08-23T23:00:00Z',
        end: '2026-08-23T23:30:00Z',
      },
    ]);

    const db = fakeSupabase({
      bookings: [excludedBooking],
    });
    vi.mocked(createAdminClient).mockReturnValue(db as any);

    // Without exclusion, this slot should NOT be bookable (blocked by external busy)
    const isNotBookableWithoutExclusion = await isSlotBookable(
        ctx,
      new Date('2026-08-23T23:00:00Z'),
      new Date('2026-08-23T23:30:00Z'),
      new Date('2026-08-23T14:00:00Z'),
    );

    expect(isNotBookableWithoutExclusion).toBe(false);

    // With exclusion, it SHOULD be bookable (external busy interval subtracted)
    const isBookableWithExclusion = await isSlotBookable(
        ctx,
      new Date('2026-08-23T23:00:00Z'),
      new Date('2026-08-23T23:30:00Z'),
      new Date('2026-08-23T14:00:00Z'),
      'book-1',
    );

    expect(isBookableWithExclusion).toBe(true);
  });

  it('allows rescheduling by subtracting external calendar entry', async () => {
    // Scenario: booker moves their 9:00am-9:30am meeting to 10:00am-10:30am.
    // Their original meeting was pushed to the MC's calendar as a single block.
    // Without exclusion, that external calendar entry blocks the move.
    // With exclusion, we subtract their booking's window from external busy,
    // freeing them to reschedule.
    const ctx: BookingContext = {
      meetingType: fakeMeetingType({
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 0,
        max_advance_days: 60,
      }),
      userId: 'user-1',
      timezone: 'Australia/Sydney',
      rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
      overrides: [],
    };

    // Current booking: 9:00am-9:30am Sydney = 23:00:00Z-23:30:00Z (previous day UTC)
    const currentBooking = fakeBooking({
      id: 'book-current',
      status: 'confirmed',
      starts_at: '2026-08-23T23:00:00Z',
      ends_at: '2026-08-23T23:30:00Z',
    });

    // External calendar has the pushed event (just the booking window, no buffers)
    vi.mocked(getBusyIntervals).mockResolvedValue([
      {
        start: '2026-08-23T23:00:00Z', // 9:00am Sydney
        end: '2026-08-23T23:30:00Z', // 9:30am Sydney
      },
    ]);

    const db = fakeSupabase({
      bookings: [currentBooking],
    });
    vi.mocked(createAdminClient).mockReturnValue(db as any);

    // Target slot: 10:00am-10:30am Sydney = 00:00:00Z-00:30:00Z (next day UTC)
    const targetSlot = {
      start: new Date('2026-08-24T00:00:00Z'),
      end: new Date('2026-08-24T00:30:00Z'),
    };

    // This should be bookable because external busy is subtracted
    const isBookable = await isSlotBookable(
        ctx,
      targetSlot.start,
      targetSlot.end,
      new Date('2026-08-23T14:00:00Z'),
      'book-current',
    );

    expect(isBookable).toBe(true);
  });
});
