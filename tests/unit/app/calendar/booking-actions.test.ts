/**
 * Tests for authenticated booking actions.
 *
 * Covers ownership verification, cancel workflow, reschedule with availability
 * re-check, error mapping, and unauthenticated rejection.
 *
 * @module tests/unit/app/calendar/booking-actions.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock the admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

// Mock lifecycle helpers
vi.mock('@/lib/booking/lifecycle', () => ({
  completeCancellation: vi.fn(),
  completeReschedule: vi.fn(),
}));

// Mock availability helpers
vi.mock('@/lib/booking/availability', async () => {
  const actual = await vi.importActual<typeof import('@/lib/booking/availability')>(
    '@/lib/booking/availability',
  );
  return {
    loadBookingContextByManageToken: vi.fn(),
    isSlotBookable: vi.fn(),
    BookingsUnavailableError: actual?.BookingsUnavailableError,
  };
});

// Mock calendar free-busy
vi.mock('@/lib/calendar/free-busy', async () => {
  const actual = await vi.importActual<typeof import('@/lib/calendar/free-busy')>(
    '@/lib/calendar/free-busy',
  );
  return {
    FreeBusyUnavailableError: actual?.FreeBusyUnavailableError,
  };
});

// Mock logger
vi.mock('@/lib/alerts/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import * as bookingActions from '@/app/(dashboard)/calendar/booking-actions';
import { BookingsUnavailableError, isSlotBookable, loadBookingContextByManageToken } from '@/lib/booking/availability';
import { completeCancellation, completeReschedule } from '@/lib/booking/lifecycle';
import { FreeBusyUnavailableError } from '@/lib/calendar/free-busy';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

describe('cancelBookingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthenticated error when session expired', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await bookingActions.cancelBookingAction('booking-id');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Session expired');
    }
  });

  it('returns not-found error when booking does not exist', async () => {
    const mockUser = { id: 'user-123' };
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'No row found' } }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await bookingActions.cancelBookingAction('nonexistent-id');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Booking not found.');
    }
  });

  it('calls cancel_booking RPC with manage_token from owned booking', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooking: Partial<Database['public']['Tables']['bookings']['Row']> = {
      id: 'booking-id',
      manage_token: 'manage-token-123',
      status: 'confirmed',
    };
    const mockRpcResult = {
      ok: true,
      booking_id: 'booking-id',
      user_id: 'user-123',
      starts_at: '2026-09-15T10:00:00Z',
      ends_at: '2026-09-15T11:00:00Z',
      timezone: 'Australia/Sydney',
      name: 'John Doe',
      email: 'john@example.com',
      business_name: 'My Business',
      meeting_type_name: 'Consultation',
    };

    const mockAdminClient = {};
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockRpcResult, error: null }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as any);

    const result = await bookingActions.cancelBookingAction('booking-id');

    expect(result.ok).toBe(true);
    expect(mockClient.rpc).toHaveBeenCalledWith('cancel_booking', {
      p_manage_token: 'manage-token-123',
    });
    expect(completeCancellation).toHaveBeenCalledWith(mockAdminClient, mockRpcResult);
  });

  it('returns already_cancelled error from RPC', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooking: Partial<Database['public']['Tables']['bookings']['Row']> = {
      id: 'booking-id',
      manage_token: 'manage-token-123',
      status: 'cancelled',
    };
    const mockRpcResult = {
      error: 'already_cancelled',
    };

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockRpcResult, error: null }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await bookingActions.cancelBookingAction('booking-id');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('already cancelled');
    }
  });

  it('returns past error when booking is in the past', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooking: Partial<Database['public']['Tables']['bookings']['Row']> = {
      id: 'booking-id',
      manage_token: 'manage-token-123',
    };
    const mockRpcResult = {
      error: 'past',
    };

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockRpcResult, error: null }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await bookingActions.cancelBookingAction('booking-id');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('past');
    }
  });
});

describe('rescheduleBookingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthenticated error when session expired', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await bookingActions.rescheduleBookingAction(
      'booking-id',
      '2026-09-15T10:00:00Z',
      'Australia/Sydney',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Session expired');
    }
  });

  it('returns validation error for invalid ISO datetime', async () => {
    const mockUser = { id: 'user-123' };
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await bookingActions.rescheduleBookingAction(
      'booking-id',
      'not-a-date',
      'Australia/Sydney',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid');
    }
  });

  it('returns validation error for invalid timezone', async () => {
    const mockUser = { id: 'user-123' };
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await bookingActions.rescheduleBookingAction(
      'booking-id',
      '2026-09-15T10:00:00Z',
      'InvalidTimeZone',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid');
    }
  });

  it('returns not-found error when booking does not exist', async () => {
    const mockUser = { id: 'user-123' };
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'No row found' } }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await bookingActions.rescheduleBookingAction(
      'nonexistent-id',
      '2026-09-15T10:00:00Z',
      'Australia/Sydney',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Booking not found.');
    }
  });

  it('returns error when booking context cannot be loaded', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooking: Partial<Database['public']['Tables']['bookings']['Row']> = {
      id: 'booking-id',
      manage_token: 'manage-token-123',
    };
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);
    vi.mocked(loadBookingContextByManageToken).mockResolvedValue(null);

    const result = await bookingActions.rescheduleBookingAction(
      'booking-id',
      '2026-09-15T10:00:00Z',
      'Australia/Sydney',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('unavailable');
    }
  });

  it('returns slot unavailable error when slot is not bookable', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooking: Partial<Database['public']['Tables']['bookings']['Row']> = {
      id: 'booking-id',
      manage_token: 'manage-token-123',
      meeting_type_id: 'mt-123',
    };
    const mockMeetingType: Partial<Database['public']['Tables']['meeting_types']['Row']> = {
      id: 'mt-123',
      duration_minutes: 60,
    };
    const mockCtx = {
      ctx: {
        meetingType: mockMeetingType,
        userId: 'user-123',
        timezone: 'Australia/Sydney',
        rules: [],
        overrides: [],
      },
      bookingId: 'booking-id',
      startsAt: '2026-09-15T09:00:00Z',
      endsAt: '2026-09-15T10:00:00Z',
      status: 'confirmed',
    };

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);
    vi.mocked(loadBookingContextByManageToken).mockResolvedValue(mockCtx as any);
    vi.mocked(isSlotBookable).mockResolvedValue(false);

    const result = await bookingActions.rescheduleBookingAction(
      'booking-id',
      '2026-09-15T10:00:00Z',
      'Australia/Sydney',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('no longer available');
    }
  });

  it('maps BookingsUnavailableError to tagged error', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooking: Partial<Database['public']['Tables']['bookings']['Row']> = {
      id: 'booking-id',
      manage_token: 'manage-token-123',
      meeting_type_id: 'mt-123',
    };
    const mockMeetingType: Partial<Database['public']['Tables']['meeting_types']['Row']> = {
      id: 'mt-123',
      duration_minutes: 60,
    };
    const mockCtx = {
      ctx: {
        meetingType: mockMeetingType,
        userId: 'user-123',
        timezone: 'Australia/Sydney',
        rules: [],
        overrides: [],
      },
      bookingId: 'booking-id',
      startsAt: '2026-09-15T09:00:00Z',
      endsAt: '2026-09-15T10:00:00Z',
      status: 'confirmed',
    };

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);
    vi.mocked(loadBookingContextByManageToken).mockResolvedValue(mockCtx as any);
    vi.mocked(isSlotBookable).mockRejectedValue(new BookingsUnavailableError());

    const result = await bookingActions.rescheduleBookingAction(
      'booking-id',
      '2026-09-15T10:00:00Z',
      'Australia/Sydney',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('temporarily unavailable');
    }
  });

  it('maps FreeBusyUnavailableError to tagged error', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooking: Partial<Database['public']['Tables']['bookings']['Row']> = {
      id: 'booking-id',
      manage_token: 'manage-token-123',
      meeting_type_id: 'mt-123',
    };
    const mockMeetingType: Partial<Database['public']['Tables']['meeting_types']['Row']> = {
      id: 'mt-123',
      duration_minutes: 60,
    };
    const mockCtx = {
      ctx: {
        meetingType: mockMeetingType,
        userId: 'user-123',
        timezone: 'Australia/Sydney',
        rules: [],
        overrides: [],
      },
      bookingId: 'booking-id',
      startsAt: '2026-09-15T09:00:00Z',
      endsAt: '2026-09-15T10:00:00Z',
      status: 'confirmed',
    };

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);
    vi.mocked(loadBookingContextByManageToken).mockResolvedValue(mockCtx as any);
    vi.mocked(isSlotBookable).mockRejectedValue(new FreeBusyUnavailableError('google'));

    const result = await bookingActions.rescheduleBookingAction(
      'booking-id',
      '2026-09-15T10:00:00Z',
      'Australia/Sydney',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('temporarily unavailable');
    }
  });

  it('calls reschedule_booking RPC with excludeBookingId when slot is bookable', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooking: Partial<Database['public']['Tables']['bookings']['Row']> = {
      id: 'booking-id',
      manage_token: 'manage-token-123',
      meeting_type_id: 'mt-123',
    };
    const mockMeetingType: Partial<Database['public']['Tables']['meeting_types']['Row']> = {
      id: 'mt-123',
      duration_minutes: 60,
    };
    const mockCtx = {
      ctx: {
        meetingType: mockMeetingType,
        userId: 'user-123',
        timezone: 'Australia/Sydney',
        rules: [],
        overrides: [],
      },
      bookingId: 'booking-id',
      startsAt: '2026-09-15T09:00:00Z',
      endsAt: '2026-09-15T10:00:00Z',
      status: 'confirmed',
    };
    const mockRpcResult = {
      ok: true,
      booking_id: 'booking-id',
      user_id: 'user-123',
      previous_starts_at: '2026-09-15T09:00:00Z',
      starts_at: '2026-09-15T10:00:00Z',
      ends_at: '2026-09-15T11:00:00Z',
      timezone: 'Australia/Sydney',
      name: 'John Doe',
      email: 'john@example.com',
      business_name: 'My Business',
      meeting_type_name: 'Consultation',
    };

    const mockAdminClient = {};
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockRpcResult, error: null }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as any);
    vi.mocked(loadBookingContextByManageToken).mockResolvedValue(mockCtx as any);
    vi.mocked(isSlotBookable).mockResolvedValue(true);

    const result = await bookingActions.rescheduleBookingAction(
      'booking-id',
      '2026-09-15T10:00:00Z',
      'Australia/Sydney',
    );

    expect(result.ok).toBe(true);
    expect(vi.mocked(isSlotBookable)).toHaveBeenCalledWith(
      mockCtx.ctx,
      expect.any(Date),
      expect.any(Date),
      undefined,
      'booking-id',
    );
    expect(mockClient.rpc).toHaveBeenCalledWith('reschedule_booking', {
      p_manage_token: 'manage-token-123',
      p_starts_at: expect.stringContaining('2026-09-15T10:00:00'),
      p_ends_at: expect.stringContaining('2026-09-15T11:00:00'),
    });
    expect(completeReschedule).toHaveBeenCalledWith(
      mockAdminClient,
      mockRpcResult,
      'manage-token-123',
    );

    if (result.ok) {
      expect(result.data).toEqual({
        start: expect.stringContaining('2026-09-15T10:00:00'),
        end: expect.stringContaining('2026-09-15T11:00:00'),
        timezone: 'Australia/Sydney',
      });
    }
  });

  it('returns slot_taken error from RPC', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooking: Partial<Database['public']['Tables']['bookings']['Row']> = {
      id: 'booking-id',
      manage_token: 'manage-token-123',
      meeting_type_id: 'mt-123',
    };
    const mockMeetingType: Partial<Database['public']['Tables']['meeting_types']['Row']> = {
      id: 'mt-123',
      duration_minutes: 60,
    };
    const mockCtx = {
      ctx: {
        meetingType: mockMeetingType,
        userId: 'user-123',
        timezone: 'Australia/Sydney',
        rules: [],
        overrides: [],
      },
      bookingId: 'booking-id',
      startsAt: '2026-09-15T09:00:00Z',
      endsAt: '2026-09-15T10:00:00Z',
      status: 'confirmed',
    };
    const mockRpcResult = {
      error: 'slot_taken',
    };

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockRpcResult, error: null }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);
    vi.mocked(loadBookingContextByManageToken).mockResolvedValue(mockCtx as any);
    vi.mocked(isSlotBookable).mockResolvedValue(true);

    const result = await bookingActions.rescheduleBookingAction(
      'booking-id',
      '2026-09-15T10:00:00Z',
      'Australia/Sydney',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('no longer available');
    }
  });

  it('accepts ISO datetime with milliseconds', async () => {
    const mockUser = { id: 'user-123' };
    const mockBooking: Partial<Database['public']['Tables']['bookings']['Row']> = {
      id: 'booking-id',
      manage_token: 'manage-token-123',
      meeting_type_id: 'mt-123',
    };
    const mockMeetingType: Partial<Database['public']['Tables']['meeting_types']['Row']> = {
      id: 'mt-123',
      duration_minutes: 60,
    };
    const mockCtx = {
      ctx: {
        meetingType: mockMeetingType,
        userId: 'user-123',
        timezone: 'Australia/Sydney',
        rules: [],
        overrides: [],
      },
      bookingId: 'booking-id',
      startsAt: '2026-09-15T09:00:00Z',
      endsAt: '2026-09-15T10:00:00Z',
      status: 'confirmed',
    };
    const mockRpcResult = {
      ok: true,
      booking_id: 'booking-id',
      user_id: 'user-123',
      previous_starts_at: '2026-09-15T09:00:00Z',
      starts_at: '2026-09-15T10:00:00.000Z',
      ends_at: '2026-09-15T11:00:00.000Z',
      timezone: 'Australia/Sydney',
      name: 'John Doe',
      email: 'john@example.com',
      business_name: 'My Business',
      meeting_type_name: 'Consultation',
    };

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockRpcResult, error: null }),
    };
    vi.mocked(createClient).mockResolvedValue(mockClient as any);
    vi.mocked(loadBookingContextByManageToken).mockResolvedValue(mockCtx as any);
    vi.mocked(isSlotBookable).mockResolvedValue(true);

    const result = await bookingActions.rescheduleBookingAction(
      'booking-id',
      '2026-09-15T10:00:00.000Z',
      'Australia/Sydney',
    );

    expect(result.ok).toBe(true);
  });
});
