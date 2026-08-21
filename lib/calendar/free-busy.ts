/**
 * Merged free/busy reads across an MC's connected external calendars
 * (Scheduler Phase A). Google Calendar freeBusy + Microsoft Graph
 * getSchedule, raw fetch, no SDKs (matches lib/oauth/tokens.ts).
 *
 * Failure posture is FAIL CLOSED: if any provider cannot answer, we
 * throw rather than offer slots we cannot verify, because a
 * double-booked MC is the worst outcome this feature can produce.
 * Callers surface an "availability temporarily unavailable" state.
 *
 * Server-only. @module lib/calendar/free-busy
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getFreshAccessToken,
  listActiveConnections,
  type CalendarConnection,
} from '@/lib/calendar/connections';
import { mergeIntervals, type BusyInterval } from '@/lib/calendar/intervals';
import type { Database } from '@/types/database';

/** A provider could not answer; slot listing must fail closed. */
export class FreeBusyUnavailableError extends Error {
  constructor(
    /** Which provider failed, for the alert/log line. */
    public readonly provider: string,
    cause?: unknown,
  ) {
    super(`free/busy unavailable for ${provider}`);
    this.name = 'FreeBusyUnavailableError';
    this.cause = cause;
  }
}

/**
 * Busy event with title, for authenticated dashboard display.
 * Titles are NEVER persisted or logged; they remain in-memory only.
 *
 * @see getBusyEvents
 */
export interface BusyEvent {
  /**
   * The provider's event id, when it supplies one.
   *
   * Used to recognise the calendar's copy of a Zebri booking, which Zebri
   * itself pushed there. Matching on times alone is fragile: a reschedule, a
   * provider rounding a timestamp, or a genuinely coincidental meeting all
   * break it in one direction or the other.
   */
  id?: string;
  /** ISO 8601 timestamp. */
  start: string;
  /** ISO 8601 timestamp. */
  end: string;
  /** Calendar event title or null if unavailable (e.g. all-day events). */
  title: string | null;
  /** Which provider supplied this event. */
  provider: 'google' | 'microsoft';
}

/**
 * Busy blocks across ALL active connections for `userId` in `range`,
 * merged and sorted. Empty array when no calendars are connected (the
 * MC schedules on Zebri data alone).
 */
export async function getBusyIntervals(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: { start: Date; end: Date },
): Promise<BusyInterval[]> {
  const connections = await listActiveConnections(supabase, userId);
  const results = await Promise.all(
    connections.map(async (conn) => {
      try {
        const token = await getFreshAccessToken(supabase, conn);
        return conn.provider === 'google'
          ? await fetchGoogleBusy(token, conn, range)
          : await fetchMicrosoftBusy(token, conn, range);
      } catch (err) {
        throw err instanceof FreeBusyUnavailableError
          ? err
          : new FreeBusyUnavailableError(conn.provider, err);
      }
    }),
  );
  return mergeIntervals(results.flat());
}

/**
 * Busy events with titles across ALL active connections for `userId` in `range`.
 * Titles are for authenticated dashboard display ONLY and must never be persisted
 * or logged. Empty array when no calendars are connected.
 *
 * Returns events sorted by start time, each one distinct. Unlike
 * getBusyIntervals, adjacent and overlapping events are deliberately NOT
 * merged: merging exists so the slot engine sees one continuous unavailable
 * span, but this feeds the MC's own calendar view, where two back-to-back
 * meetings must stay two meetings. Merging them collapsed the pair into a
 * single block wearing only the first meeting's title, silently hiding the
 * second appointment from the person who needed to see it.
 */
export async function getBusyEvents(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: { start: Date; end: Date },
): Promise<BusyEvent[]> {
  const connections = await listActiveConnections(supabase, userId);
  const results = await Promise.all(
    connections.map(async (conn) => {
      try {
        const token = await getFreshAccessToken(supabase, conn);
        return conn.provider === 'google'
          ? await fetchGoogleBusyEvents(token, conn, range)
          : await fetchMicrosoftBusyEvents(token, conn, range);
      } catch (err) {
        throw err instanceof FreeBusyUnavailableError
          ? err
          : new FreeBusyUnavailableError(conn.provider, err);
      }
    }),
  );
  return results
    .flat()
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

async function fetchGoogleBusy(
  accessToken: string,
  conn: CalendarConnection,
  range: { start: Date; end: Date },
): Promise<BusyInterval[]> {
  const calendarId = conn.calendar_id ?? 'primary';
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: range.start.toISOString(),
      timeMax: range.end.toISOString(),
      items: [{ id: calendarId }],
    }),
  });
  if (!res.ok) throw new FreeBusyUnavailableError('google', `status ${res.status}`);
  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
  };
  return (data.calendars?.[calendarId]?.busy ?? []).map((b) => ({
    start: b.start,
    end: b.end,
  }));
}

/** Graph dateTimeTimeZone wants a naive datetime; the zone rides separately. */
function toNaiveUtc(d: Date): string {
  return d.toISOString().slice(0, 19);
}

async function fetchMicrosoftBusy(
  accessToken: string,
  conn: CalendarConnection,
  range: { start: Date; end: Date },
): Promise<BusyInterval[]> {
  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me/calendar/getSchedule',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schedules: [conn.account_email],
        startTime: { dateTime: toNaiveUtc(range.start), timeZone: 'UTC' },
        endTime: { dateTime: toNaiveUtc(range.end), timeZone: 'UTC' },
        availabilityViewInterval: 30,
      }),
    },
  );
  if (!res.ok) throw new FreeBusyUnavailableError('microsoft', `status ${res.status}`);
  const data = (await res.json()) as {
    value?: {
      scheduleItems?: {
        status?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
      }[];
    }[];
  };
  const items = data.value?.[0]?.scheduleItems ?? [];
  return items
    // tentative and oof still mean "not free to meet"
    .filter((i) => i.status === 'busy' || i.status === 'oof' || i.status === 'tentative')
    .filter((i) => i.start?.dateTime && i.end?.dateTime)
    .map((i) => ({
      // Graph returns naive datetimes in the requested zone (UTC here);
      // normalise to explicit UTC ISO so downstream Date.parse is exact.
      start: new Date(`${i.start!.dateTime}Z`).toISOString(),
      end: new Date(`${i.end!.dateTime}Z`).toISOString(),
    }));
}

/**
 * Fetch calendar events with titles from Google Calendar API.
 * Why: The freeBusy endpoint returns only busy/free intervals with no titles.
 * The events endpoint requires the calendar.events scope (already granted in Phase A).
 * Titles must never be persisted or logged.
 *
 * Skips transparent events (they do not block time) and cancelled events.
 * All-day events are skipped (they have start.date instead of start.dateTime
 * and represent full-day blocks; dashboard grid operates on time slots only).
 */
async function fetchGoogleBusyEvents(
  accessToken: string,
  conn: CalendarConnection,
  range: { start: Date; end: Date },
): Promise<BusyEvent[]> {
  const calendarId = conn.calendar_id ?? 'primary';
  const params = new URLSearchParams({
    timeMin: range.start.toISOString(),
    timeMax: range.end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!res.ok) throw new FreeBusyUnavailableError('google', `status ${res.status}`);
  const data = (await res.json()) as {
    items?: Array<{
      id?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      transparency?: string;
      status?: string;
    }>;
  };
  return (data.items ?? [])
    // Skip transparent events (do not block time)
    .filter((event) => event.transparency !== 'transparent')
    // Skip cancelled events
    .filter((event) => event.status !== 'cancelled')
    // Skip all-day events (start.date instead of start.dateTime)
    .filter((event) => event.start?.dateTime !== undefined && event.end?.dateTime !== undefined)
    .map((event) => ({
      ...(event.id ? { id: event.id } : {}),
      start: event.start!.dateTime!,
      end: event.end!.dateTime!,
      title: event.summary ?? null,
      provider: 'google' as const,
    }));
}

/**
 * Fetch calendar events with titles from Microsoft Graph calendarView endpoint.
 * Why: The getSchedule endpoint returns only busy/free status with no titles.
 * The calendarView endpoint requires the Calendars.Read scope (already granted in Phase A).
 * Titles must never be persisted or logged.
 *
 * Skips events marked as 'free' (showAs: 'free' means they do not block time).
 * All-day events are skipped (Graph represents them without explicit dateTime,
 * and dashboard grid operates on time slots only).
 */
async function fetchMicrosoftBusyEvents(
  accessToken: string,
  conn: CalendarConnection,
  range: { start: Date; end: Date },
): Promise<BusyEvent[]> {
  const params = new URLSearchParams({
    startDateTime: toNaiveUtc(range.start),
    endDateTime: toNaiveUtc(range.end),
  });
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
  if (!res.ok) throw new FreeBusyUnavailableError('microsoft', `status ${res.status}`);
  const data = (await res.json()) as {
    value?: Array<{
      id?: string;
      subject?: string;
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      showAs?: string;
    }>;
  };
  return (data.value ?? [])
    // Skip events marked as 'free' (do not block time)
    .filter((event) => event.showAs !== 'free')
    // Skip events without explicit dateTime (all-day events)
    .filter((event) => event.start?.dateTime && event.end?.dateTime)
    .map((event) => ({
      ...(event.id ? { id: event.id } : {}),
      start: new Date(`${event.start!.dateTime}Z`).toISOString(),
      end: new Date(`${event.end!.dateTime}Z`).toISOString(),
      title: event.subject ?? null,
      provider: 'microsoft' as const,
    }));
}

