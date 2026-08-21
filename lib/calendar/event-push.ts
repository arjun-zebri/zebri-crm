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

  const data = (await res.json()) as {
    id: string;
    hangoutLink?: string;
    conferenceData?: {
      entryPoints?: { entryPointType: string; uri: string }[];
    };
  };

  let joinUrl: string | null = null;
  if (details.withConference) {
    joinUrl =
      data.hangoutLink ??
      data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
      null;
  }

  return {
    provider: 'google',
    eventId: data.id,
    joinUrl,
  };
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

  const data = (await res.json()) as {
    id: string;
    onlineMeeting?: {
      joinUrl?: string;
    };
  };

  const joinUrl = details.withConference ? data.onlineMeeting?.joinUrl ?? null : null;

  return {
    provider: 'microsoft',
    eventId: data.id,
    joinUrl,
  };
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
