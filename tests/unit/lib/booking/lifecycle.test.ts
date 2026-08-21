/**
 * Unit tests for `lib/booking/lifecycle` (Phase E: Task 4).
 *
 * Tests the post-RPC orchestration for booking cancel and reschedule:
 * calendar sync, email dispatch, MC notification, and error handling.
 * Both functions must never throw, even when all dependencies fail.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CancelRpcResult, RescheduleRpcResult } from '@/lib/booking/lifecycle';
import { completeCancellation, completeReschedule } from '@/lib/booking/lifecycle';

// Mock calendar event push
vi.mock('@/lib/calendar/event-push', () => ({
  EventPushError: class EventPushError extends Error {
    constructor(
      public provider: 'google' | 'microsoft',
      public status: number,
    ) {
      super(`event push failed for ${provider} (status ${status})`);
    }
  },
  deleteBookingEvent: vi.fn(),
  updateBookingEvent: vi.fn(),
}));

// Mock email senders
vi.mock('@/lib/email/booking', () => ({
  sendBookingCancelledEmail: vi.fn(),
  sendBookingChangeNotificationEmail: vi.fn(),
  sendBookingRescheduledEmail: vi.fn(),
}));

// Mock alerts
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/alerts/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

/**
 * Double for the meeting-type read, which is now
 * `.select().eq('id', …).eq('user_id', …).maybeSingle()`.
 *
 * The second `eq` is the tenant scope. It used to be a single
 * `.eq('name', …)` with the service-role client, which ignores RLS and could
 * therefore return another MC's meeting type: `meeting_types.name` is not
 * unique and "Consultation" is the default template name.
 */
function meetingTypeQuery(row: { location_type: string; address: string | null } | null) {
  const terminal = { maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }) };
  return { eq: vi.fn(() => ({ eq: vi.fn(() => terminal) })) };
}

/** The same double, for the "database is down" paths. */
function meetingTypeQueryFailing() {
  const terminal = {
    maybeSingle: vi.fn().mockRejectedValue(new Error('database down')),
  };
  return { eq: vi.fn(() => ({ eq: vi.fn(() => terminal) })) };
}

// Mock admin client setup
const mockAdminClient = () => {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => meetingTypeQuery(null)),
    })),
    auth: {
      admin: {
        getUserById: vi.fn(),
      },
    },
  } as unknown as SupabaseClient;
};

describe('audience-specific timezones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Admin double that answers both reads lifecycle makes: the meeting type
   * (`.single()`) and the MC's display zone (`.limit()`).
   */
  function adminWithMcTimezone(mcTimezone: string | null) {
    const admin = mockAdminClient();
    (admin.from as any).mockImplementation((table: string) => {
      if (table === 'user_public_settings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: mcTimezone === null ? [] : [{ timezone: mcTimezone }],
              }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() =>
          meetingTypeQuery({ location_type: 'in_person', address: '123 Main St' }),
        ),
      };
    });
    (admin.auth.admin.getUserById as any).mockResolvedValue({
      data: { user: { email: 'mc@test.com' } },
      error: null,
    });
    return admin;
  }

  const perthBooking: CancelRpcResult = {
    ok: true,
    booking_id: 'b1',
    user_id: 'u1',
    starts_at: '2026-08-22T06:00:00Z',
    ends_at: '2026-08-22T06:30:00Z',
    // The booking row carries the BOOKER's zone.
    timezone: 'Australia/Perth',
    name: 'Jane Booker',
    email: 'jane@example.com',
    business_name: 'My Business',
    external_event_ids: {},
    meeting_type_id: 'mt1',
    meeting_type_name: 'Consultation',
  };

  it("mails the booker in their zone and the MC in the MC's own", async () => {
    const { sendBookingCancelledEmail, sendBookingChangeNotificationEmail } =
      await import('@/lib/email/booking');

    await completeCancellation(adminWithMcTimezone('Australia/Sydney'), perthBooking);

    // The couple reads the time where they are...
    expect(sendBookingCancelledEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ timezone: 'Australia/Perth' }),
    );
    // ...and the MC reads their own diary in their own zone. Sending the MC
    // the booker's zone would have them converting their own calendar.
    expect(sendBookingChangeNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        booking: expect.objectContaining({ timezone: 'Australia/Sydney' }),
      }),
    );
  });

  it("falls back to the booker's zone when the MC has no timezone set", async () => {
    const { sendBookingChangeNotificationEmail } = await import('@/lib/email/booking');

    await completeCancellation(adminWithMcTimezone(null), perthBooking);

    expect(sendBookingChangeNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        booking: expect.objectContaining({ timezone: 'Australia/Perth' }),
      }),
    );
  });
});

describe('completeCancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes event and sends both emails on success', async () => {
    const { deleteBookingEvent: deleteBookingEventMock } =
      await import('@/lib/calendar/event-push');
    const { sendBookingCancelledEmail, sendBookingChangeNotificationEmail } =
      await import('@/lib/email/booking');

    const admin = mockAdminClient();

    // Setup: meeting type fetch succeeds
    (admin.from as any).mockReturnValue({
      select: vi.fn(() => meetingTypeQuery({ location_type: 'in_person', address: '123 Main St' })),
    });

    // Setup: MC email fetch succeeds
    (admin.auth.admin.getUserById as any).mockResolvedValue({
      data: { user: { email: 'mc@test.com' } },
      error: null,
    });

    const result: CancelRpcResult = {
      ok: true,
      booking_id: 'b1',
      user_id: 'u1',
      starts_at: '2025-01-01T10:00:00Z',
      ends_at: '2025-01-01T11:00:00Z',
      timezone: 'UTC',
      name: 'John Doe',
      email: 'john@example.com',
      business_name: 'My Business',
      external_event_ids: { google: 'event-123' },
      meeting_type_id: 'mt1',
      meeting_type_name: 'Consultation',
    };

    await completeCancellation(admin, result);

    expect(deleteBookingEventMock).toHaveBeenCalledWith(admin, 'u1', { google: 'event-123' });
    expect(sendBookingCancelledEmail).toHaveBeenCalled();
    expect(sendBookingChangeNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'cancelled',
        to: 'mc@test.com',
      }),
    );
  });

  it('sends both emails even when event delete throws EventPushError', async () => {
    const { deleteBookingEvent, EventPushError } = await import('@/lib/calendar/event-push');
    const { sendBookingCancelledEmail } = await import('@/lib/email/booking');
    const { sendAlert } = await import('@/lib/alerts/send-alert');

    const admin = mockAdminClient();

    // Setup: delete fails with EventPushError
    (deleteBookingEvent as any).mockRejectedValue(new EventPushError('google', 400));

    // Setup: meeting type fetch succeeds
    (admin.from as any).mockReturnValue({
      select: vi.fn(() => meetingTypeQuery({ location_type: 'video', address: null })),
    });

    // Setup: MC email fetch succeeds
    (admin.auth.admin.getUserById as any).mockResolvedValue({
      data: { user: { email: 'mc@test.com' } },
      error: null,
    });

    const result: CancelRpcResult = {
      ok: true,
      booking_id: 'b1',
      user_id: 'u1',
      starts_at: '2025-01-01T10:00:00Z',
      ends_at: '2025-01-01T11:00:00Z',
      timezone: 'UTC',
      name: 'John Doe',
      email: 'john@example.com',
      business_name: 'My Business',
      external_event_ids: { google: 'event-123' },
      meeting_type_id: 'mt1',
      meeting_type_name: 'Consultation',
    };

    // Should not throw
    await completeCancellation(admin, result);

    // Should have sent emails despite event delete failure
    expect(sendBookingCancelledEmail).toHaveBeenCalled();
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'booking_event_push_failed',
        bookingId: 'b1',
      }),
    );
  });

  it('sends MC notification even when booker email fails', async () => {
    await import('@/lib/calendar/event-push');
    const { sendBookingCancelledEmail, sendBookingChangeNotificationEmail } =
      await import('@/lib/email/booking');

    const admin = mockAdminClient();

    // Setup: meeting type fetch succeeds
    (admin.from as any).mockReturnValue({
      select: vi.fn(() => meetingTypeQuery({ location_type: 'in_person', address: null })),
    });

    // Setup: booker email fails
    (sendBookingCancelledEmail as any).mockRejectedValue(new Error('email service down'));

    // Setup: MC email fetch succeeds
    (admin.auth.admin.getUserById as any).mockResolvedValue({
      data: { user: { email: 'mc@test.com' } },
      error: null,
    });

    const result: CancelRpcResult = {
      ok: true,
      booking_id: 'b1',
      user_id: 'u1',
      starts_at: '2025-01-01T10:00:00Z',
      ends_at: '2025-01-01T11:00:00Z',
      timezone: 'UTC',
      name: 'John Doe',
      email: 'john@example.com',
      business_name: 'My Business',
      external_event_ids: {},
      meeting_type_id: 'mt1',
      meeting_type_name: 'Consultation',
    };

    // Should not throw
    await completeCancellation(admin, result);

    // Should have sent both emails (booker email failed but MC still sent)
    expect(sendBookingCancelledEmail).toHaveBeenCalled();
    expect(sendBookingChangeNotificationEmail).toHaveBeenCalled();
  });

  it('never throws even when all dependencies fail', async () => {
    const { deleteBookingEvent, EventPushError } = await import('@/lib/calendar/event-push');
    const { sendBookingCancelledEmail, sendBookingChangeNotificationEmail } =
      await import('@/lib/email/booking');

    const admin = mockAdminClient();

    // Setup: everything fails
    (deleteBookingEvent as any).mockRejectedValue(new EventPushError('google', 500));
    (admin.from as any).mockReturnValue({
      select: vi.fn(() => meetingTypeQueryFailing()),
    });
    (sendBookingCancelledEmail as any).mockRejectedValue(new Error('email service down'));
    (sendBookingChangeNotificationEmail as any).mockRejectedValue(new Error('email service down'));
    (admin.auth.admin.getUserById as any).mockRejectedValue(new Error('auth service down'));

    const result: CancelRpcResult = {
      ok: true,
      booking_id: 'b1',
      user_id: 'u1',
      starts_at: '2025-01-01T10:00:00Z',
      ends_at: '2025-01-01T11:00:00Z',
      timezone: 'UTC',
      name: 'John Doe',
      email: 'john@example.com',
      business_name: 'My Business',
      external_event_ids: { google: 'event-123' },
      meeting_type_id: 'mt1',
      meeting_type_name: 'Consultation',
    };

    // Should not throw
    expect(async () => {
      await completeCancellation(admin, result);
    }).not.toThrow();
  });
});

describe('completeReschedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates event and sends both emails on success', async () => {
    const { updateBookingEvent } = await import('@/lib/calendar/event-push');
    const { sendBookingRescheduledEmail, sendBookingChangeNotificationEmail } =
      await import('@/lib/email/booking');

    const admin = mockAdminClient();

    // Setup: meeting type fetch succeeds
    (admin.from as any).mockReturnValue({
      select: vi.fn(() => meetingTypeQuery({ location_type: 'video', address: null })),
    });

    // Setup: MC email fetch succeeds
    (admin.auth.admin.getUserById as any).mockResolvedValue({
      data: { user: { email: 'mc@test.com' } },
      error: null,
    });

    const result: RescheduleRpcResult = {
      ok: true,
      booking_id: 'b1',
      user_id: 'u1',
      previous_starts_at: '2025-01-01T10:00:00Z',
      starts_at: '2025-01-01T14:00:00Z',
      ends_at: '2025-01-01T15:00:00Z',
      timezone: 'UTC',
      name: 'John Doe',
      email: 'john@example.com',
      business_name: 'My Business',
      external_event_ids: { google: 'event-123' },
      meeting_type_id: 'mt1',
      meeting_type_name: 'Consultation',
    };

    await completeReschedule(admin, result, 'token-abc123');

    expect(updateBookingEvent).toHaveBeenCalledWith(
      admin,
      'u1',
      { google: 'event-123' },
      expect.objectContaining({
        summary: 'Consultation: John Doe',
      }),
    );
    expect(sendBookingRescheduledEmail).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        previousStart: new Date('2025-01-01T10:00:00Z'),
        start: new Date('2025-01-01T14:00:00Z'),
      }),
    );
    expect(sendBookingChangeNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rescheduled',
        to: 'mc@test.com',
      }),
    );
  });

  it('passes previousStart through to reschedule email', async () => {
    const { sendBookingRescheduledEmail } = await import('@/lib/email/booking');

    const admin = mockAdminClient();

    // Setup: meeting type fetch succeeds
    (admin.from as any).mockReturnValue({
      select: vi.fn(() => meetingTypeQuery({ location_type: 'in_person', address: '456 Oak Ave' })),
    });

    // Setup: MC email fetch succeeds
    (admin.auth.admin.getUserById as any).mockResolvedValue({
      data: { user: { email: 'mc@test.com' } },
      error: null,
    });

    const previousDate = new Date('2025-01-01T10:00:00Z');
    const newDate = new Date('2025-01-02T10:00:00Z');

    const result: RescheduleRpcResult = {
      ok: true,
      booking_id: 'b2',
      user_id: 'u2',
      previous_starts_at: previousDate.toISOString(),
      starts_at: newDate.toISOString(),
      ends_at: new Date('2025-01-02T11:00:00Z').toISOString(),
      timezone: 'America/New_York',
      name: 'Jane Smith',
      email: 'jane@example.com',
      business_name: 'Jane Business',
      external_event_ids: { microsoft: 'event-456' },
      meeting_type_name: 'Strategy Session',
    };

    await completeReschedule(admin, result, 'manage-token-xyz');

    expect(sendBookingRescheduledEmail).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        previousStart: previousDate,
        start: newDate,
        meetingTypeName: 'Strategy Session',
      }),
    );
  });

  it('sends MC notification even when reschedule email fails', async () => {
    await import('@/lib/calendar/event-push');
    const { sendBookingRescheduledEmail, sendBookingChangeNotificationEmail } =
      await import('@/lib/email/booking');

    const admin = mockAdminClient();

    // Setup: meeting type fetch succeeds
    (admin.from as any).mockReturnValue({
      select: vi.fn(() => meetingTypeQuery({ location_type: 'phone', address: null })),
    });

    // Setup: reschedule email fails
    (sendBookingRescheduledEmail as any).mockRejectedValue(
      new Error('email service temporarily down'),
    );

    // Setup: MC email fetch succeeds
    (admin.auth.admin.getUserById as any).mockResolvedValue({
      data: { user: { email: 'mc@test.com' } },
      error: null,
    });

    const result: RescheduleRpcResult = {
      ok: true,
      booking_id: 'b3',
      user_id: 'u3',
      previous_starts_at: '2025-01-01T10:00:00Z',
      starts_at: '2025-01-01T14:00:00Z',
      ends_at: '2025-01-01T15:00:00Z',
      timezone: 'UTC',
      name: 'Bob',
      email: 'bob@example.com',
      business_name: 'Bob Inc',
      external_event_ids: {},
      meeting_type_name: 'Quick Call',
    };

    // Should not throw
    await completeReschedule(admin, result, 'token');

    // Should have sent both emails despite reschedule email failure
    expect(sendBookingRescheduledEmail).toHaveBeenCalled();
    expect(sendBookingChangeNotificationEmail).toHaveBeenCalled();
  });

  it('never throws even when all dependencies fail', async () => {
    const { updateBookingEvent, EventPushError } = await import('@/lib/calendar/event-push');
    const { sendBookingRescheduledEmail, sendBookingChangeNotificationEmail } =
      await import('@/lib/email/booking');

    const admin = mockAdminClient();

    // Setup: everything fails
    (updateBookingEvent as any).mockRejectedValue(new EventPushError('microsoft', 500));
    (admin.from as any).mockReturnValue({
      select: vi.fn(() => meetingTypeQueryFailing()),
    });
    (sendBookingRescheduledEmail as any).mockRejectedValue(new Error('email service down'));
    (sendBookingChangeNotificationEmail as any).mockRejectedValue(new Error('email service down'));
    (admin.auth.admin.getUserById as any).mockRejectedValue(new Error('auth service down'));

    const result: RescheduleRpcResult = {
      ok: true,
      booking_id: 'b4',
      user_id: 'u4',
      previous_starts_at: '2025-01-01T10:00:00Z',
      starts_at: '2025-01-01T14:00:00Z',
      ends_at: '2025-01-01T15:00:00Z',
      timezone: 'UTC',
      name: 'Alice',
      email: 'alice@example.com',
      business_name: 'Alice LLC',
      external_event_ids: { google: 'event-789', microsoft: 'event-101' },
      meeting_type_name: 'Meeting',
    };

    // Should not throw
    expect(async () => {
      await completeReschedule(admin, result, 'token');
    }).not.toThrow();
  });
});

describe('meeting-type resolution (tenant scoping)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Records the filters applied to the meeting_types read. */
  function adminRecordingFilters(calls: Array<[string, unknown]>) {
    const admin = mockAdminClient();
    const terminal = {
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { location_type: 'video', address: null }, error: null }),
    };
    (admin.from as any).mockImplementation((table: string) => {
      if (table === 'user_public_settings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [] }) })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn((col: string, val: unknown) => {
            calls.push([col, val]);
            return {
              eq: vi.fn((col2: string, val2: unknown) => {
                calls.push([col2, val2]);
                return terminal;
              }),
            };
          }),
        })),
      };
    });
    (admin.auth.admin.getUserById as any).mockResolvedValue({
      data: { user: { email: 'mc@test.com' } },
      error: null,
    });
    return admin;
  }

  const cancelResult: CancelRpcResult = {
    ok: true,
    booking_id: 'b1',
    user_id: 'u1',
    starts_at: '2026-08-22T06:00:00Z',
    ends_at: '2026-08-22T06:30:00Z',
    timezone: 'UTC',
    name: 'Jane',
    email: 'jane@example.com',
    business_name: 'My Business',
    external_event_ids: {},
    meeting_type_id: 'mt-1',
    meeting_type_name: 'Consultation',
  };

  it('resolves the meeting type by id AND owner, never by name', async () => {
    const calls: Array<[string, unknown]> = [];
    await completeCancellation(adminRecordingFilters(calls), cancelResult);

    // The name is not unique across tenants, and this read runs on the
    // service-role client, which ignores RLS. Filtering on it could return
    // another MC's row and put their venue address in a booker's inbox.
    expect(calls).toEqual([
      ['id', 'mt-1'],
      ['user_id', 'u1'],
    ]);
    expect(calls.map(([col]) => col)).not.toContain('name');
  });

  it('falls back to in-person with no address when the id is absent', async () => {
    const { sendBookingCancelledEmail } = await import('@/lib/email/booking');
    const calls: Array<[string, unknown]> = [];
    const admin = adminRecordingFilters(calls);

    const { meeting_type_id: _omitted, ...withoutId } = cancelResult;
    await completeCancellation(admin, withoutId);

    // An older RPC payload still in flight across a deploy: no id to scope
    // on, so we take the safe default rather than guessing by name.
    expect(calls).toEqual([]);
    expect(sendBookingCancelledEmail).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ locationType: 'in_person', address: null }),
    );
  });
});

describe('reschedule keeps the existing video link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const rescheduleResult: RescheduleRpcResult = {
    ok: true,
    booking_id: 'b1',
    user_id: 'u1',
    previous_starts_at: '2026-08-22T04:00:00Z',
    starts_at: '2026-08-22T06:00:00Z',
    ends_at: '2026-08-22T06:30:00Z',
    timezone: 'UTC',
    name: 'Jane',
    email: 'jane@example.com',
    business_name: 'My Business',
    external_event_ids: {},
    meeting_type_id: 'mt-1',
    meeting_type_name: 'Consultation',
    video_join_url: 'https://meet.google.com/abc-defg-hij',
  };

  function adminWithVideoMeetingType() {
    const admin = mockAdminClient();
    (admin.from as any).mockImplementation((table: string) => {
      if (table === 'user_public_settings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [] }) })),
          })),
        };
      }
      return { select: vi.fn(() => meetingTypeQuery({ location_type: 'video', address: null })) };
    });
    (admin.auth.admin.getUserById as any).mockResolvedValue({
      data: { user: { email: 'mc@test.com' } },
      error: null,
    });
    return admin;
  }

  it('sends the booker the link they already have', async () => {
    const { sendBookingRescheduledEmail } = await import('@/lib/email/booking');
    const admin = adminWithVideoMeetingType();

    await completeReschedule(admin, rescheduleResult, 'token-abc');

    // Rescheduling moves the times in place, so the meeting keeps its link.
    // Hard-coding null here told a couple whose Meet link had not changed
    // that a link was still "to follow".
    expect(sendBookingRescheduledEmail).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ joinUrl: 'https://meet.google.com/abc-defg-hij' }),
    );
  });

  it('tells the MC the same link', async () => {
    const { sendBookingChangeNotificationEmail } = await import('@/lib/email/booking');

    await completeReschedule(adminWithVideoMeetingType(), rescheduleResult, 'token-abc');

    expect(sendBookingChangeNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        booking: expect.objectContaining({ joinUrl: 'https://meet.google.com/abc-defg-hij' }),
      }),
    );
  });

  it('still sends null when the booking has no video link', async () => {
    const { sendBookingRescheduledEmail } = await import('@/lib/email/booking');
    const admin = adminWithVideoMeetingType();
    const { video_join_url: _none, ...noLink } = rescheduleResult;

    await completeReschedule(admin, noLink, 'token-abc');

    expect(sendBookingRescheduledEmail).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ joinUrl: null }),
    );
  });
});
