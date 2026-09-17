/**
 * Create an MC's calendar event with auto-generated Meet/Teams link
 * (Scheduler Phase C). Google Calendar + Microsoft Graph, raw fetch,
 * no SDKs (matches lib/calendar/free-busy.ts).
 *
 * Failure posture is NON-BLOCKING: if a provider fails, the booking
 * is not placed on the MC's calendar, but the booking proceeds; the
 * caller logs the failure. Callers surface a "link may not be
 * available" state if desired.
 *
 * Server-only. @module lib/calendar/event-push
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getFreshAccessToken,
  listActiveConnections,
  type CalendarConnection,
} from '@/lib/calendar/connections';
import type { Database } from '@/types/database';

/** Result of a successful event push to a provider's calendar. */
export interface PushedEvent {
  /** Which provider (google|microsoft) the event was pushed to. */
  provider: 'google' | 'microsoft';
  /** ID returned by the provider for this calendar event. */
  eventId: string;
  /** Join URL for the conference call, or null if unavailable/requested to omit. */
  joinUrl: string | null;
  /**
   * Why a requested conference link is missing, as the provider
   * reported it. Only set when `withConference` was asked for and
   * `joinUrl` is still null after a re-read; it exists so the Slack
   * alert can say what Graph or Google actually answered rather than
   * "no link" (the event itself succeeds in these cases, so nothing
   * else surfaces the reason).
   */
  joinUrlDiagnostic?: string;
}

/** A provider could not create the event; non-blocking failure. */
export class EventPushError extends Error {
  constructor(
    /** Which provider failed. */
    public readonly provider: 'google' | 'microsoft',
    /** HTTP status code. */
    public readonly status: number,
  ) {
    super(`event push failed for ${provider} (status ${status})`);
    this.name = 'EventPushError';
  }
}

/** Input details for pushing a booking event to the MC's calendar. */
interface PushEventDetails {
  /** Calendar event title. */
  summary: string;
  /** Calendar event description/notes. */
  description: string;
  /** Event start time (UTC). */
  start: Date;
  /** Event end time (UTC). */
  end: Date;
  /** Email of the booker (attendee to invite). */
  attendeeEmail: string;
  /** Display name of the booker (attendee to invite). */
  attendeeName: string;
  /** Whether to request a conference link (Meet or Teams). */
  withConference: boolean;
}

/** Input details for updating a booking event on the MC's calendar. */
interface UpdateEventDetails {
  /** Calendar event title. */
  summary: string;
  /** Calendar event description/notes. */
  description: string;
  /** Event start time (UTC). */
  start: Date;
  /** Event end time (UTC). */
  end: Date;
}

/**
 * Create a booking event on the MC's connected external calendar,
 * preferring Google if both providers are active. Returns null when
 * no calendars are connected. Throws EventPushError on provider
 * failures (non-blocking; callers log and proceed).
 */
export async function pushBookingEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  details: PushEventDetails,
): Promise<PushedEvent | null> {
  const connections = await listActiveConnections(supabase, userId);
  if (connections.length === 0) return null;

  // Prefer Google if available, otherwise use Microsoft
  const googleConn = connections.find((c) => c.provider === 'google');
  const msConn = connections.find((c) => c.provider === 'microsoft');
  const targetConn = googleConn ?? msConn;

  if (!targetConn) return null;

  const token = await getFreshAccessToken(supabase, targetConn);

  return targetConn.provider === 'google'
    ? pushGoogleEvent(token, targetConn, details)
    : pushMicrosoftEvent(token, targetConn, details);
}

async function pushGoogleEvent(
  accessToken: string,
  conn: CalendarConnection,
  details: PushEventDetails,
): Promise<PushedEvent> {
  const calendarId = conn.calendar_id ?? 'primary';
  const requestId = crypto.randomUUID();

  const body: Record<string, unknown> = {
    summary: details.summary,
    description: details.description,
    start: {
      dateTime: details.start.toISOString(),
    },
    end: {
      dateTime: details.end.toISOString(),
    },
    attendees: [
      {
        email: details.attendeeEmail,
        displayName: details.attendeeName,
      },
    ],
  };

  if (details.withConference) {
    body.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    };
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) throw new EventPushError('google', res.status);

  const data = (await res.json()) as GoogleEvent;

  if (!details.withConference) return { provider: 'google', eventId: data.id, joinUrl: null };

  let joinUrl = googleJoinUrl(data);
  if (joinUrl) return { provider: 'google', eventId: data.id, joinUrl };

  // Meet creation is asynchronous: the create response can carry the
  // conference request as `pending` with no link yet. One re-read picks
  // up the common case where it has settled by the time we ask.
  const again = await readJson<GoogleEvent>(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${data.id}?conferenceDataVersion=1`,
    accessToken,
  );
  joinUrl = again ? googleJoinUrl(again) : null;
  if (joinUrl) return { provider: 'google', eventId: data.id, joinUrl };

  const status = (again ?? data).conferenceData?.createRequest?.status?.statusCode ?? 'absent';
  return {
    provider: 'google',
    eventId: data.id,
    joinUrl: null,
    joinUrlDiagnostic: `conference request status=${status}`,
  };
}

/** The slice of a Google event that carries its Meet link. */
interface GoogleEvent {
  id: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
    createRequest?: { status?: { statusCode?: string } };
  };
}

function googleJoinUrl(event: GoogleEvent): string | null {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
    null
  );
}

/**
 * Best-effort GET of a provider resource. Returns null on any failure:
 * these reads only enrich a push that already succeeded, so they must
 * never turn it into a failure.
 */
async function readJson<T>(url: string, accessToken: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Graph dateTimeTimeZone wants a naive datetime; the zone rides separately. */
function toNaiveUtc(d: Date): string {
  return d.toISOString().slice(0, 19);
}

async function pushMicrosoftEvent(
  accessToken: string,
  conn: CalendarConnection,
  details: PushEventDetails,
): Promise<PushedEvent> {
  const body: Record<string, unknown> = {
    subject: details.summary,
    body: {
      contentType: 'Text',
      content: details.description,
    },
    start: {
      dateTime: toNaiveUtc(details.start),
      timeZone: 'UTC',
    },
    end: {
      dateTime: toNaiveUtc(details.end),
      timeZone: 'UTC',
    },
    attendees: [
      {
        emailAddress: {
          address: details.attendeeEmail,
          name: details.attendeeName,
        },
        type: 'required',
      },
    ],
  };

  if (details.withConference) {
    body.isOnlineMeeting = true;
    body.onlineMeetingProvider = 'teamsForBusiness';
  }

  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new EventPushError('microsoft', res.status);

  const data = (await res.json()) as GraphEvent;
  if (!details.withConference) return { provider: 'microsoft', eventId: data.id, joinUrl: null };

  let joinUrl = data.onlineMeeting?.joinUrl ?? null;
  if (joinUrl) return { provider: 'microsoft', eventId: data.id, joinUrl };

  // Graph provisions the Teams meeting after the event; re-read once in
  // case the create response simply ran ahead of it.
  const again = await readJson<GraphEvent>(
    `https://graph.microsoft.com/v1.0/me/events/${data.id}?$select=isOnlineMeeting,onlineMeetingProvider,onlineMeeting`,
    accessToken,
  );
  joinUrl = again?.onlineMeeting?.joinUrl ?? null;
  if (joinUrl) return { provider: 'microsoft', eventId: data.id, joinUrl };

  // Still nothing. Graph answers a Teams request the calendar cannot
  // honour by creating the event with `isOnlineMeeting: false` and
  // provider `unknown`, not with an error: personal Microsoft accounts
  // and tenants without Teams enabled both land here. The calendar's
  // own allowed-provider list says which, so read it for the alert.
  const calendar = await readJson<{
    allowedOnlineMeetingProviders?: string[];
    defaultOnlineMeetingProvider?: string;
  }>(
    'https://graph.microsoft.com/v1.0/me/calendar?$select=allowedOnlineMeetingProviders,defaultOnlineMeetingProvider',
    accessToken,
  );
  const settled = again ?? data;
  return {
    provider: 'microsoft',
    eventId: data.id,
    joinUrl: null,
    joinUrlDiagnostic:
      `event isOnlineMeeting=${settled.isOnlineMeeting ?? 'absent'} provider=${settled.onlineMeetingProvider ?? 'absent'}` +
      ` · calendar allows=[${(calendar?.allowedOnlineMeetingProviders ?? []).join(', ')}]` +
      ` default=${calendar?.defaultOnlineMeetingProvider ?? 'unknown'}`,
  };
}

/** The slice of a Graph event that says whether it got a Teams meeting. */
interface GraphEvent {
  id: string;
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: string;
  onlineMeeting?: { joinUrl?: string } | null;
}

/**
 * Update an existing booking event on the MC's connected external
 * calendar. Leaves conference data and attendees untouched to preserve
 * existing join links. No-op when no matching connection exists.
 * Throws EventPushError on provider failures.
 */
export async function updateBookingEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  externalEventIds: Record<string, string>,
  details: UpdateEventDetails,
): Promise<void> {
  if (Object.keys(externalEventIds).length === 0) return;

  const connections = await listActiveConnections(supabase, userId);
  if (connections.length === 0) return;

  let targetProvider: 'google' | 'microsoft' | null = null;
  let targetEventId: string | null = null;

  if (externalEventIds.google) {
    const googleConn = connections.find((c) => c.provider === 'google');
    if (googleConn) {
      targetProvider = 'google';
      targetEventId = externalEventIds.google;
    }
  }

  if (!targetProvider && externalEventIds.microsoft) {
    const msConn = connections.find((c) => c.provider === 'microsoft');
    if (msConn) {
      targetProvider = 'microsoft';
      targetEventId = externalEventIds.microsoft;
    }
  }

  if (!targetProvider || !targetEventId) return;

  const targetConn = connections.find((c) => c.provider === targetProvider);
  if (!targetConn) return;

  const token = await getFreshAccessToken(supabase, targetConn);

  return targetProvider === 'google'
    ? updateGoogleEvent(token, targetConn, targetEventId, details)
    : updateMicrosoftEvent(token, targetEventId, details);
}

async function updateGoogleEvent(
  accessToken: string,
  conn: CalendarConnection,
  eventId: string,
  details: UpdateEventDetails,
): Promise<void> {
  const calendarId = conn.calendar_id ?? 'primary';

  const body: Record<string, unknown> = {
    summary: details.summary,
    description: details.description,
    start: {
      dateTime: details.start.toISOString(),
    },
    end: {
      dateTime: details.end.toISOString(),
    },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?sendUpdates=all`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) throw new EventPushError('google', res.status);
}

async function updateMicrosoftEvent(
  accessToken: string,
  eventId: string,
  details: UpdateEventDetails,
): Promise<void> {
  const body: Record<string, unknown> = {
    subject: details.summary,
    body: {
      contentType: 'Text',
      content: details.description,
    },
    start: {
      dateTime: toNaiveUtc(details.start),
      timeZone: 'UTC',
    },
    end: {
      dateTime: toNaiveUtc(details.end),
      timeZone: 'UTC',
    },
  };

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new EventPushError('microsoft', res.status);
}

/**
 * Delete an existing booking event from the MC's connected external
 * calendar. Treats 404/410 as success (event already gone). No-op when
 * no matching connection exists. Throws EventPushError on other
 * provider failures.
 */
export async function deleteBookingEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  externalEventIds: Record<string, string>,
): Promise<void> {
  if (Object.keys(externalEventIds).length === 0) return;

  const connections = await listActiveConnections(supabase, userId);
  if (connections.length === 0) return;

  let targetProvider: 'google' | 'microsoft' | null = null;
  let targetEventId: string | null = null;

  if (externalEventIds.google) {
    const googleConn = connections.find((c) => c.provider === 'google');
    if (googleConn) {
      targetProvider = 'google';
      targetEventId = externalEventIds.google;
    }
  }

  if (!targetProvider && externalEventIds.microsoft) {
    const msConn = connections.find((c) => c.provider === 'microsoft');
    if (msConn) {
      targetProvider = 'microsoft';
      targetEventId = externalEventIds.microsoft;
    }
  }

  if (!targetProvider || !targetEventId) return;

  const targetConn = connections.find((c) => c.provider === targetProvider);
  if (!targetConn) return;

  const token = await getFreshAccessToken(supabase, targetConn);

  return targetProvider === 'google'
    ? deleteGoogleEvent(token, targetConn, targetEventId)
    : deleteMicrosoftEvent(token, targetEventId);
}

async function deleteGoogleEvent(
  accessToken: string,
  conn: CalendarConnection,
  eventId: string,
): Promise<void> {
  const calendarId = conn.calendar_id ?? 'primary';

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new EventPushError('google', res.status);
  }
}

async function deleteMicrosoftEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new EventPushError('microsoft', res.status);
  }
}
