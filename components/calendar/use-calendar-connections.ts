/**
 * Shared read model for the MC's external calendar connections.
 *
 * Both the Settings card and the `/calendar` route need to answer "is a
 * calendar connected?", and they must never disagree. One React Query key
 * (`CALENDAR_CONNECTIONS_KEY`) backs every caller, so connecting or
 * disconnecting invalidates a single cache entry.
 *
 * Wraps the existing server action, which returns provider/email/status only
 * and never exposes tokens to the client.
 *
 * @module components/calendar/use-calendar-connections
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import {
  listCalendarConnectionsAction,
  type CalendarConnectionSummary,
} from '@/app/(dashboard)/settings/calendar/actions';

/** Query key shared by every consumer of the connection list. */
export const CALENDAR_CONNECTIONS_KEY = ['calendar', 'connections'] as const;

/** Providers Zebri can connect, in the order they are offered. */
export const CALENDAR_PROVIDERS = ['google', 'microsoft'] as const;

/** A calendar provider Zebri supports. */
export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number];

/**
 * Load the signed-in MC's calendar connections.
 *
 * Callers get `hasConnection` / `hasError` pre-derived so no two call sites
 * can compute "connected" differently.
 */
export function useCalendarConnections() {
  const query = useQuery({
    queryKey: CALENDAR_CONNECTIONS_KEY,
    queryFn: async (): Promise<CalendarConnectionSummary[]> => {
      const result = await listCalendarConnectionsAction();
      if (!result.ok) throw new Error(result.error);
      return result.connections;
    },
  });

  const connections = query.data ?? [];

  return {
    ...query,
    connections,
    /** True when at least one provider is connected and healthy. */
    hasConnection: connections.some((c) => c.status === 'connected'),
    /**
     * True when a provider was connected but its token refresh failed.
     *
     * Deliberately distinct from `!hasConnection`: "never connected" and
     * "connected but broken" need different copy, and conflating them tells
     * a first-time MC their calendar "could not be reached".
     */
    hasError: connections.some((c) => c.status === 'error'),
  };
}
