/**
 * Unit tests for calendar busy schema and route.
 *
 * Covers range validation (valid, inverted, over the cap, exactly at it)
 * and malformed input rejection.
 *
 * Also covers the GET /api/calendar/busy route with session auth, title
 * inclusion, and FAIL SOFT error handling.
 *
 * Hook query construction (overlap detection with gt/lt predicates) is
 * verified indirectly through Task 6's calendar grid view tests, which will
 * exercise actual Supabase queries and surface any containment vs overlap bugs.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/calendar/busy/route';
import { busyQuerySchema } from '@/app/api/calendar/busy-schema';
import { FreeBusyUnavailableError, getBusyEvents } from '@/lib/calendar/free-busy';
import { createClient } from '@/lib/supabase/server';

describe('busyQuerySchema', () => {
  it('accepts a valid date range', () => {
    const result = busyQuerySchema.safeParse({
      from: '2026-08-20',
      to: '2026-08-25',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.from).toBe('2026-08-20');
      expect(result.data.to).toBe('2026-08-25');
    }
  });

  it('rejects when to is before from', () => {
    const result = busyQuerySchema.safeParse({
      from: '2026-08-25',
      to: '2026-08-20',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'custom')).toBe(true);
    }
  });

  it('rejects a range exceeding the cap', () => {
    // The cap is 62 days, sized for a padded month grid. 2026-08-20 to
    // 2026-10-22 is 63.
    const result = busyQuerySchema.safeParse({
      from: '2026-08-20',
      to: '2026-10-22',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'custom')).toBe(true);
    }
  });

  it('accepts a padded month grid, which a 31-day cap used to reject', () => {
    // Six weeks of cells plus a week either side. Rejecting this is why the
    // month view showed no external busy time at all.
    const result = busyQuerySchema.safeParse({
      from: '2026-07-26',
      to: '2026-09-08',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a range of exactly 31 days', () => {
    const result = busyQuerySchema.safeParse({
      from: '2026-08-20',
      to: '2026-09-20',
    });
    // 2026-08-20 to 2026-09-20 is 31 days
    // However, let's verify this is exactly 31 days
    const from = new Date('2026-08-20');
    const to = new Date('2026-09-20');
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    // If it's exactly 31 days, it should pass
    if (diffDays <= 31) {
      expect(result.success).toBe(true);
    } else {
      // If it's more than 31, it should fail
      expect(result.success).toBe(false);
    }
  });

  it('rejects malformed from date', () => {
    const result = busyQuerySchema.safeParse({
      from: 'not-a-date',
      to: '2026-08-25',
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed to date', () => {
    const result = busyQuerySchema.safeParse({
      from: '2026-08-20',
      to: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing from parameter', () => {
    const result = busyQuerySchema.safeParse({
      to: '2026-08-25',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing to parameter', () => {
    const result = busyQuerySchema.safeParse({
      from: '2026-08-20',
    });
    expect(result.success).toBe(false);
  });

  it('accepts equal from and to dates (same day)', () => {
    const result = busyQuerySchema.safeParse({
      from: '2026-08-20',
      to: '2026-08-20',
    });
    expect(result.success).toBe(true);
  });
});

// Route handler tests
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/calendar/free-busy', () => ({
  getBusyEvents: vi.fn(),
  FreeBusyUnavailableError: class FreeBusyUnavailableError extends Error {
    constructor(provider: string) {
      super(`free/busy unavailable for ${provider}`);
      this.name = 'FreeBusyUnavailableError';
    }
  },
}));

describe('GET /api/calendar/busy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const request = new NextRequest('http://localhost/api/calendar/busy?from=2026-08-20&to=2026-08-25');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when query parameters are invalid', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const request = new NextRequest('http://localhost/api/calendar/busy?from=not-a-date&to=2026-08-25');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('returns busy events with titles for authenticated user', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const mockBusyEvents = [
      {
        start: '2026-08-20T02:00:00Z',
        end: '2026-08-20T03:00:00Z',
        title: 'Team Meeting',
        provider: 'google' as const,
      },
      {
        start: '2026-08-20T04:00:00Z',
        end: '2026-08-20T05:00:00Z',
        title: 'Client Call',
        provider: 'microsoft' as const,
      },
    ];
    vi.mocked(getBusyEvents).mockResolvedValue(mockBusyEvents);

    const request = new NextRequest('http://localhost/api/calendar/busy?from=2026-08-20&to=2026-08-25');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.busy).toEqual(mockBusyEvents);
    expect(data.unavailable).toBe(false);
    expect(data.busy[0]?.title).toBe('Team Meeting');
    expect(data.busy[1]?.title).toBe('Client Call');
  });

  it('returns empty list with unavailable: true when provider fails (FAIL SOFT)', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    vi.mocked(getBusyEvents).mockRejectedValue(
      new FreeBusyUnavailableError('google', 'connection timeout'),
    );

    const request = new NextRequest('http://localhost/api/calendar/busy?from=2026-08-20&to=2026-08-25');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.busy).toEqual([]);
    expect(data.unavailable).toBe(true);
  });

  it('includes provider field in response', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const mockBusyEvents = [
      {
        start: '2026-08-20T02:00:00Z',
        end: '2026-08-20T03:00:00Z',
        title: 'Google Event',
        provider: 'google' as const,
      },
      {
        start: '2026-08-20T04:00:00Z',
        end: '2026-08-20T05:00:00Z',
        title: 'Microsoft Event',
        provider: 'microsoft' as const,
      },
    ];
    vi.mocked(getBusyEvents).mockResolvedValue(mockBusyEvents);

    const request = new NextRequest('http://localhost/api/calendar/busy?from=2026-08-20&to=2026-08-25');
    const response = await GET(request);

    const data = await response.json();
    expect(data.busy[0]?.provider).toBe('google');
    expect(data.busy[1]?.provider).toBe('microsoft');
  });

  it('respects the range limit', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const request = new NextRequest(
      'http://localhost/api/calendar/busy?from=2026-08-20&to=2026-10-22',
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});
