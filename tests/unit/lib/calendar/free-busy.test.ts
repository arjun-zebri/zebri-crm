import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/calendar/connections', () => ({
  listActiveConnections: vi.fn(),
  getFreshAccessToken: vi.fn().mockResolvedValue('token-1'),
}));

import { listActiveConnections } from '@/lib/calendar/connections';
import {
  FreeBusyUnavailableError,
  getBusyIntervals,
  getBusyEvents,
} from '@/lib/calendar/free-busy';

const range = {
  start: new Date('2026-09-01T00:00:00Z'),
  end: new Date('2026-09-02T00:00:00Z'),
};
const supabase = {} as never;

const googleConn = { id: 'g1', provider: 'google', account_email: 'a@g.com', calendar_id: null };
const msConn = { id: 'm1', provider: 'microsoft', account_email: 'a@o.com', calendar_id: null };

function mockFetchOnce(json: unknown, ok = true) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(json),
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getBusyIntervals', () => {
  it('returns [] when no calendars are connected', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([]);
    expect(await getBusyIntervals(supabase, 'u1', range)).toEqual([]);
  });

  it('maps Google freeBusy responses', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({
      calendars: {
        primary: {
          busy: [{ start: '2026-09-01T02:00:00Z', end: '2026-09-01T03:00:00Z' }],
        },
      },
    });
    expect(await getBusyIntervals(supabase, 'u1', range)).toEqual([
      { start: '2026-09-01T02:00:00Z', end: '2026-09-01T03:00:00Z' },
    ]);
  });

  it('maps Microsoft getSchedule responses and skips free slots', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as never]);
    mockFetchOnce({
      value: [
        {
          scheduleItems: [
            {
              status: 'busy',
              start: { dateTime: '2026-09-01T04:00:00.0000000', timeZone: 'UTC' },
              end: { dateTime: '2026-09-01T05:00:00.0000000', timeZone: 'UTC' },
            },
            {
              status: 'free',
              start: { dateTime: '2026-09-01T06:00:00.0000000', timeZone: 'UTC' },
              end: { dateTime: '2026-09-01T07:00:00.0000000', timeZone: 'UTC' },
            },
          ],
        },
      ],
    });
    const result = await getBusyIntervals(supabase, 'u1', range);
    const body = JSON.parse(
      (vi.mocked(global.fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.startTime).toEqual({ dateTime: '2026-09-01T00:00:00', timeZone: 'UTC' });
    expect(body.schedules).toEqual(['a@o.com']);
    expect(result).toHaveLength(1);
    expect(Date.parse(result[0]!.start)).toBe(Date.parse('2026-09-01T04:00:00Z'));
  });

  it('merges busy blocks across providers', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([
      googleConn as never,
      msConn as never,
    ]);
    mockFetchOnce({
      calendars: {
        primary: { busy: [{ start: '2026-09-01T02:00:00Z', end: '2026-09-01T04:00:00Z' }] },
      },
    });
    mockFetchOnce({
      value: [
        {
          scheduleItems: [
            {
              status: 'busy',
              start: { dateTime: '2026-09-01T03:00:00.0000000', timeZone: 'UTC' },
              end: { dateTime: '2026-09-01T05:00:00.0000000', timeZone: 'UTC' },
            },
          ],
        },
      ],
    });
    const result = await getBusyIntervals(supabase, 'u1', range);
    expect(result).toHaveLength(1);
    expect(Date.parse(result[0]!.end)).toBe(Date.parse('2026-09-01T05:00:00Z'));
  });

  it('fails closed when a provider call errors', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({}, false);
    await expect(getBusyIntervals(supabase, 'u1', range)).rejects.toBeInstanceOf(
      FreeBusyUnavailableError,
    );
  });
});

describe('getBusyEvents', () => {
  it('returns [] when no calendars are connected', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([]);
    expect(await getBusyEvents(supabase, 'u1', range)).toEqual([]);
  });

  it('maps Google events API responses with titles', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({
      items: [
        {
          summary: 'Team Meeting',
          start: { dateTime: '2026-09-01T02:00:00Z' },
          end: { dateTime: '2026-09-01T03:00:00Z' },
          transparency: 'opaque',
          status: 'confirmed',
        },
      ],
    });
    const result = await getBusyEvents(supabase, 'u1', range);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: '2026-09-01T02:00:00Z',
      end: '2026-09-01T03:00:00Z',
      title: 'Team Meeting',
      provider: 'google',
    });
  });

  it('skips Google transparent events', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({
      items: [
        {
          summary: 'Blocked Time',
          start: { dateTime: '2026-09-01T02:00:00Z' },
          end: { dateTime: '2026-09-01T03:00:00Z' },
          transparency: 'transparent',
          status: 'confirmed',
        },
      ],
    });
    const result = await getBusyEvents(supabase, 'u1', range);
    expect(result).toEqual([]);
  });

  it('skips Google cancelled events', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({
      items: [
        {
          summary: 'Cancelled Meeting',
          start: { dateTime: '2026-09-01T02:00:00Z' },
          end: { dateTime: '2026-09-01T03:00:00Z' },
          transparency: 'opaque',
          status: 'cancelled',
        },
      ],
    });
    const result = await getBusyEvents(supabase, 'u1', range);
    expect(result).toEqual([]);
  });

  it('skips Google all-day events', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({
      items: [
        {
          summary: 'All Day Conference',
          start: { date: '2026-09-01' },
          end: { date: '2026-09-02' },
          transparency: 'opaque',
          status: 'confirmed',
        },
      ],
    });
    const result = await getBusyEvents(supabase, 'u1', range);
    expect(result).toEqual([]);
  });

  it('handles Google events with null titles', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({
      items: [
        {
          start: { dateTime: '2026-09-01T02:00:00Z' },
          end: { dateTime: '2026-09-01T03:00:00Z' },
          transparency: 'opaque',
          status: 'confirmed',
        },
      ],
    });
    const result = await getBusyEvents(supabase, 'u1', range);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe(null);
  });

  it('maps Microsoft events API responses with titles', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as never]);
    // Note: Microsoft Graph calendarView uses query params, not body
    mockFetchOnce({
      value: [
        {
          subject: 'Client Call',
          start: { dateTime: '2026-09-01T04:00:00.0000000' },
          end: { dateTime: '2026-09-01T05:00:00.0000000' },
          showAs: 'busy',
        },
      ],
    });
    const result = await getBusyEvents(supabase, 'u1', range);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Client Call',
      provider: 'microsoft',
    });
    // Check that the datetime was normalized with Z
    expect(result[0]?.start).toMatch(/Z$/);
    expect(result[0]?.end).toMatch(/Z$/);
  });

  it('skips Microsoft free events', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as never]);
    mockFetchOnce({
      value: [
        {
          subject: 'Free Slot',
          start: { dateTime: '2026-09-01T04:00:00.0000000' },
          end: { dateTime: '2026-09-01T05:00:00.0000000' },
          showAs: 'free',
        },
      ],
    });
    const result = await getBusyEvents(supabase, 'u1', range);
    expect(result).toEqual([]);
  });

  it('skips Microsoft events without explicit dateTime', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as never]);
    mockFetchOnce({
      value: [
        {
          subject: 'All Day Event',
          start: { date: '2026-09-01' },
          end: { date: '2026-09-02' },
          showAs: 'busy',
        },
      ],
    });
    const result = await getBusyEvents(supabase, 'u1', range);
    expect(result).toEqual([]);
  });

  it('handles Microsoft events with null titles', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as never]);
    mockFetchOnce({
      value: [
        {
          start: { dateTime: '2026-09-01T04:00:00.0000000' },
          end: { dateTime: '2026-09-01T05:00:00.0000000' },
          showAs: 'busy',
        },
      ],
    });
    const result = await getBusyEvents(supabase, 'u1', range);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe(null);
  });

  it('keeps overlapping events from different calendars distinct', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([
      googleConn as never,
      msConn as never,
    ]);
    // Google event
    mockFetchOnce({
      items: [
        {
          summary: 'Google Meeting',
          start: { dateTime: '2026-09-01T02:00:00Z' },
          end: { dateTime: '2026-09-01T04:00:00Z' },
          transparency: 'opaque',
          status: 'confirmed',
        },
      ],
    });
    // Microsoft event overlapping
    mockFetchOnce({
      value: [
        {
          subject: 'Microsoft Meeting',
          start: { dateTime: '2026-09-01T03:00:00.0000000' },
          end: { dateTime: '2026-09-01T05:00:00.0000000' },
          showAs: 'busy',
        },
      ],
    });
    const result = await getBusyEvents(supabase, 'u1', range);

    // Both survive, sorted by start. These previously merged into a single
    // 02:00-05:00 block wearing only the Google title, which meant an MC with
    // two calendars connected could not see one of their own meetings.
    expect(result).toHaveLength(2);
    expect(result[0]?.title).toBe('Google Meeting');
    expect(result[0]?.start).toContain('02:00:00');
    expect(result[1]?.title).toBe('Microsoft Meeting');
    expect(result[1]?.start).toContain('03:00:00');
  });

  it('keeps back-to-back meetings on one calendar distinct', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({
      items: [
        {
          summary: 'BDM integration',
          start: { dateTime: '2026-09-01T09:00:00Z' },
          end: { dateTime: '2026-09-01T09:30:00Z' },
          transparency: 'opaque',
          status: 'confirmed',
        },
        {
          summary: 'Zebri Intro',
          start: { dateTime: '2026-09-01T09:30:00Z' },
          end: { dateTime: '2026-09-01T10:00:00Z' },
          transparency: 'opaque',
          status: 'confirmed',
        },
      ],
    });

    const result = await getBusyEvents(supabase, 'u1', range);

    // Touching intervals are merged for slot computation, never for display:
    // an MC looking at 09:00-10:00 has two appointments there, not one.
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.title)).toEqual(['BDM integration', 'Zebri Intro']);
  });

  it('fails closed when a provider call errors', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as never]);
    mockFetchOnce({}, false);
    await expect(getBusyEvents(supabase, 'u1', range)).rejects.toBeInstanceOf(
      FreeBusyUnavailableError,
    );
  });
});
