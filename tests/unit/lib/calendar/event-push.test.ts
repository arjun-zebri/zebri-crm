import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/calendar/connections', () => ({
  listActiveConnections: vi.fn(),
  getFreshAccessToken: vi.fn().mockResolvedValue('token-1'),
}));

import { listActiveConnections } from '@/lib/calendar/connections';
import {
  EventPushError,
  pushBookingEvent,
  updateBookingEvent,
  deleteBookingEvent,
  type PushedEvent,
} from '@/lib/calendar/event-push';

const supabase = {} as any;

const googleConn = {
  id: 'g1',
  provider: 'google' as const,
  account_email: 'a@g.com',
  calendar_id: null,
  status: 'connected' as const,
  user_id: 'u1',
  access_token_encrypted: 'enc-token',
  refresh_token_encrypted: 'enc-refresh',
  token_expires_at: new Date().toISOString(),
  last_error: null,
  connected_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const msConn = {
  id: 'm1',
  provider: 'microsoft' as const,
  account_email: 'a@o.com',
  calendar_id: null,
  status: 'connected' as const,
  user_id: 'u1',
  access_token_encrypted: 'enc-token',
  refresh_token_encrypted: 'enc-refresh',
  token_expires_at: new Date().toISOString(),
  last_error: null,
  connected_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const details = {
  summary: 'Test Event',
  description: 'Test Description',
  start: new Date('2026-09-01T10:00:00Z'),
  end: new Date('2026-09-01T11:00:00Z'),
  attendeeEmail: 'test@example.com',
  attendeeName: 'Test User',
  withConference: true,
};

function mockFetchOnce(json: unknown, ok = true, status = 200) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(json),
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('pushBookingEvent', () => {
  it('returns null when no active connections', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([]);
    const result = await pushBookingEvent(supabase, 'u1', details);
    expect(result).toBeNull();
  });

  it('pushes event to Google Calendar and returns eventId + joinUrl', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn] as any);
    mockFetchOnce({
      id: 'google-event-123',
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
    });

    const result = await pushBookingEvent(supabase, 'u1', details);

    expect(result).toEqual({
      provider: 'google',
      eventId: 'google-event-123',
      joinUrl: 'https://meet.google.com/abc-defg-hij',
    } as PushedEvent);

    // Verify request URL and method
    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    expect(url).toContain('www.googleapis.com/calendar/v3/calendars');
    expect(url).toContain('conferenceDataVersion=1');
    expect(url).toContain('sendUpdates=all');
    expect(init?.method).toBe('POST');

    // Verify request body has conferenceData
    const body = JSON.parse(init?.body as string);
    expect(body.summary).toBe('Test Event');
    expect(body.description).toBe('Test Description');
    expect(body.attendees).toEqual([
      { email: 'test@example.com', displayName: 'Test User' },
    ]);
    expect(body.conferenceData).toBeDefined();
    expect(body.conferenceData.createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet');
    expect(body.conferenceData.createRequest.requestId).toBeDefined();
  });

  it('prefers Google over Microsoft when both connections are active', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn, msConn] as any);
    mockFetchOnce({
      id: 'google-event-123',
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
    });

    const result = await pushBookingEvent(supabase, 'u1', details);

    expect(result?.provider).toBe('google');

    // Verify only one fetch call was made (Google, not Microsoft)
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
  });

  it('uses Microsoft when Google connection is not available', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as any]);
    mockFetchOnce({
      id: 'ms-event-123',
      onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/xyz' },
    });

    const result = await pushBookingEvent(supabase, 'u1', details);

    expect(result).toEqual({
      provider: 'microsoft',
      eventId: 'ms-event-123',
      joinUrl: 'https://teams.microsoft.com/l/meetup-join/xyz',
    } as PushedEvent);

    // Verify request uses naive UTC datetimes
    const calls = vi.mocked(global.fetch).mock.calls;
    const [url, init] = calls[0]!;
    expect(url).toContain('graph.microsoft.com/v1.0/me/events');

    const body = JSON.parse(init?.body as string);
    expect(body.start.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(body.start.timeZone).toBe('UTC');
    expect(body.isOnlineMeeting).toBe(true);
    expect(body.onlineMeetingProvider).toBe('teamsForBusiness');
    expect(body.subject).toBe('Test Event');
    expect(body.body.contentType).toBe('Text');
    expect(body.attendees).toEqual([
      { emailAddress: { address: 'test@example.com', name: 'Test User' }, type: 'required' },
    ]);
  });

  it('throws EventPushError on non-2xx Google response', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as any]);
    mockFetchOnce({ error: 'Invalid event' }, false, 400);

    await expect(pushBookingEvent(supabase, 'u1', details)).rejects.toThrow(
      EventPushError,
    );
    try {
      await pushBookingEvent(supabase, 'u1', details);
    } catch (err) {
      if (err instanceof EventPushError) {
        expect(err.provider).toBe('google');
        expect(err.status).toBe(400);
      }
    }
  });

  it('throws EventPushError on non-2xx Microsoft response', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as any]);
    mockFetchOnce({ error: 'Invalid event' }, false, 401);

    await expect(pushBookingEvent(supabase, 'u1', details)).rejects.toThrow(
      EventPushError,
    );
    try {
      await pushBookingEvent(supabase, 'u1', details);
    } catch (err) {
      if (err instanceof EventPushError) {
        expect(err.provider).toBe('microsoft');
        expect(err.status).toBe(401);
      }
    }
  });

  it('omits conferenceData when withConference is false', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as any]);
    mockFetchOnce({
      id: 'google-event-456',
    });

    const detailsNoConf = { ...details, withConference: false };
    const result = await pushBookingEvent(supabase, 'u1', detailsNoConf);

    expect(result).toEqual({
      provider: 'google',
      eventId: 'google-event-456',
      joinUrl: null,
    } as PushedEvent);

    const body = JSON.parse(
      (vi.mocked(global.fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.conferenceData).toBeUndefined();
  });

  it('omits isOnlineMeeting and onlineMeetingProvider for Microsoft when withConference is false', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as any]);
    mockFetchOnce({
      id: 'ms-event-456',
    });

    const detailsNoConf = { ...details, withConference: false };
    await pushBookingEvent(supabase, 'u1', detailsNoConf);

    const body = JSON.parse(
      (vi.mocked(global.fetch).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.isOnlineMeeting).toBeUndefined();
    expect(body.onlineMeetingProvider).toBeUndefined();
  });

  it('extracts joinUrl from conferenceData.entryPoints when hangoutLink is missing', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as any]);
    mockFetchOnce({
      id: 'google-event-789',
      conferenceData: {
        entryPoints: [
          { entryPointType: 'phone', uri: 'tel:+1-555-0000' },
          { entryPointType: 'video', uri: 'https://meet.google.com/xyz-uvwx' },
        ],
      },
    });

    const result = await pushBookingEvent(supabase, 'u1', details);

    expect(result?.joinUrl).toBe('https://meet.google.com/xyz-uvwx');
  });

  it('returns null joinUrl when no conference data is available', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as any]);
    mockFetchOnce({
      id: 'ms-event-999',
    });

    const result = await pushBookingEvent(supabase, 'u1', details);

    expect(result).toEqual({
      provider: 'microsoft',
      eventId: 'ms-event-999',
      joinUrl: null,
    } as PushedEvent);
  });
});

describe('updateBookingEvent', () => {
  it('no-ops when externalEventIds is empty', async () => {
    await updateBookingEvent(supabase, 'u1', {}, {
      summary: 'Updated Event',
      description: 'Updated Description',
      start: new Date('2026-09-01T10:00:00Z'),
      end: new Date('2026-09-01T11:00:00Z'),
    });

    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it('no-ops when provider key has no matching active connection', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([]);
    await updateBookingEvent(supabase, 'u1', { google: 'event-123' }, {
      summary: 'Updated Event',
      description: 'Updated Description',
      start: new Date('2026-09-01T10:00:00Z'),
      end: new Date('2026-09-01T11:00:00Z'),
    });

    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it('PATCHes Google Calendar event with summary, description, start, end', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as any]);
    mockFetchOnce({ id: 'google-event-123' });

    await updateBookingEvent(supabase, 'u1', { google: 'google-event-123' }, {
      summary: 'Updated Event',
      description: 'Updated Description',
      start: new Date('2026-09-01T10:00:00Z'),
      end: new Date('2026-09-01T11:00:00Z'),
    });

    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;

    expect(url).toContain('www.googleapis.com/calendar/v3/calendars');
    expect(url).toContain('google-event-123');
    expect(url).toContain('sendUpdates=all');
    expect(init?.method).toBe('PATCH');

    const body = JSON.parse(init?.body as string);
    expect(body.summary).toBe('Updated Event');
    expect(body.description).toBe('Updated Description');
    expect(body.start).toEqual({ dateTime: '2026-09-01T10:00:00.000Z' });
    expect(body.end).toEqual({ dateTime: '2026-09-01T11:00:00.000Z' });
    expect(body.conferenceData).toBeUndefined();
    expect(body.attendees).toBeUndefined();
  });

  it('PATCHes Microsoft event with naive UTC start/end', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as any]);
    mockFetchOnce({ id: 'ms-event-123' });

    await updateBookingEvent(supabase, 'u1', { microsoft: 'ms-event-123' }, {
      summary: 'Updated Event',
      description: 'Updated Description',
      start: new Date('2026-09-01T10:00:00Z'),
      end: new Date('2026-09-01T11:00:00Z'),
    });

    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;

    expect(url).toContain('graph.microsoft.com/v1.0/me/events');
    expect(url).toContain('ms-event-123');
    expect(init?.method).toBe('PATCH');

    const body = JSON.parse(init?.body as string);
    expect(body.subject).toBe('Updated Event');
    expect(body.body.content).toBe('Updated Description');
    expect(body.body.contentType).toBe('Text');
    expect(body.start).toEqual({
      dateTime: '2026-09-01T10:00:00',
      timeZone: 'UTC',
    });
    expect(body.end).toEqual({
      dateTime: '2026-09-01T11:00:00',
      timeZone: 'UTC',
    });
    expect(body.start.dateTime).not.toMatch(/Z$/);
    expect(body.conferenceData).toBeUndefined();
    expect(body.attendees).toBeUndefined();
  });

  it('throws EventPushError on non-2xx Google response', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as any]);
    mockFetchOnce({ error: 'Not found' }, false, 500);

    await expect(
      updateBookingEvent(supabase, 'u1', { google: 'google-event-123' }, {
        summary: 'Updated Event',
        description: 'Updated Description',
        start: new Date('2026-09-01T10:00:00Z'),
        end: new Date('2026-09-01T11:00:00Z'),
      })
    ).rejects.toThrow(EventPushError);

    try {
      await updateBookingEvent(supabase, 'u1', { google: 'google-event-123' }, {
        summary: 'Updated Event',
        description: 'Updated Description',
        start: new Date('2026-09-01T10:00:00Z'),
        end: new Date('2026-09-01T11:00:00Z'),
      });
    } catch (err) {
      if (err instanceof EventPushError) {
        expect(err.provider).toBe('google');
        expect(err.status).toBe(500);
      }
    }
  });

  it('throws EventPushError on non-2xx Microsoft response', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as any]);
    mockFetchOnce({ error: 'Not found' }, false, 500);

    await expect(
      updateBookingEvent(supabase, 'u1', { microsoft: 'ms-event-123' }, {
        summary: 'Updated Event',
        description: 'Updated Description',
        start: new Date('2026-09-01T10:00:00Z'),
        end: new Date('2026-09-01T11:00:00Z'),
      })
    ).rejects.toThrow(EventPushError);

    try {
      await updateBookingEvent(supabase, 'u1', { microsoft: 'ms-event-123' }, {
        summary: 'Updated Event',
        description: 'Updated Description',
        start: new Date('2026-09-01T10:00:00Z'),
        end: new Date('2026-09-01T11:00:00Z'),
      });
    } catch (err) {
      if (err instanceof EventPushError) {
        expect(err.provider).toBe('microsoft');
        expect(err.status).toBe(500);
      }
    }
  });
});

describe('deleteBookingEvent', () => {
  it('no-ops when externalEventIds is empty', async () => {
    await deleteBookingEvent(supabase, 'u1', {});

    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it('no-ops when provider key has no matching active connection', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([]);
    await deleteBookingEvent(supabase, 'u1', { google: 'event-123' });

    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it('DELETEs Google Calendar event with sendUpdates=all', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as any]);
    mockFetchOnce({});

    await deleteBookingEvent(supabase, 'u1', { google: 'google-event-123' });

    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;

    expect(url).toContain('www.googleapis.com/calendar/v3/calendars');
    expect(url).toContain('google-event-123');
    expect(url).toContain('sendUpdates=all');
    expect(init?.method).toBe('DELETE');
  });

  it('DELETEs Microsoft event', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as any]);
    mockFetchOnce({});

    await deleteBookingEvent(supabase, 'u1', { microsoft: 'ms-event-123' });

    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;

    expect(url).toContain('graph.microsoft.com/v1.0/me/events');
    expect(url).toContain('ms-event-123');
    expect(init?.method).toBe('DELETE');
  });

  it('treats 404 as success on Google DELETE', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as any]);
    mockFetchOnce({}, false, 404);

    await expect(
      deleteBookingEvent(supabase, 'u1', { google: 'google-event-123' })
    ).resolves.toBeUndefined();
  });

  it('treats 410 as success on Google DELETE', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as any]);
    mockFetchOnce({}, false, 410);

    await expect(
      deleteBookingEvent(supabase, 'u1', { google: 'google-event-123' })
    ).resolves.toBeUndefined();
  });

  it('treats 404 as success on Microsoft DELETE', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as any]);
    mockFetchOnce({}, false, 404);

    await expect(
      deleteBookingEvent(supabase, 'u1', { microsoft: 'ms-event-123' })
    ).resolves.toBeUndefined();
  });

  it('treats 410 as success on Microsoft DELETE', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as any]);
    mockFetchOnce({}, false, 410);

    await expect(
      deleteBookingEvent(supabase, 'u1', { microsoft: 'ms-event-123' })
    ).resolves.toBeUndefined();
  });

  it('throws EventPushError on non-2xx, non-404/410 Google response', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([googleConn as any]);
    mockFetchOnce({ error: 'Server error' }, false, 500);

    await expect(
      deleteBookingEvent(supabase, 'u1', { google: 'google-event-123' })
    ).rejects.toThrow(EventPushError);

    try {
      await deleteBookingEvent(supabase, 'u1', { google: 'google-event-123' });
    } catch (err) {
      if (err instanceof EventPushError) {
        expect(err.provider).toBe('google');
        expect(err.status).toBe(500);
      }
    }
  });

  it('throws EventPushError on non-2xx, non-404/410 Microsoft response', async () => {
    vi.mocked(listActiveConnections).mockResolvedValue([msConn as any]);
    mockFetchOnce({ error: 'Server error' }, false, 500);

    await expect(
      deleteBookingEvent(supabase, 'u1', { microsoft: 'ms-event-123' })
    ).rejects.toThrow(EventPushError);

    try {
      await deleteBookingEvent(supabase, 'u1', { microsoft: 'ms-event-123' });
    } catch (err) {
      if (err instanceof EventPushError) {
        expect(err.provider).toBe('microsoft');
        expect(err.status).toBe(500);
      }
    }
  });
});
