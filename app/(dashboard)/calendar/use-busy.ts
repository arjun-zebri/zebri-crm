/**
 * External calendar busy events for the signed-in MC.
 *
 * Wraps the owner-scoped `/api/calendar/busy` route, which is the ONLY place
 * event titles are exposed. The public booking surfaces deliberately use
 * anonymous free/busy instead, so a couple choosing a slot can never learn
 * what the MC is doing at the times they cannot book.
 *
 * @module app/(dashboard)/calendar/use-busy
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import type { BusyEvent } from '@/lib/calendar/free-busy';

/** Shape returned by the busy route. */
export interface BusyResponse {
  busy: BusyEvent[];
  /**
   * True when a connected calendar could not be reached. The route fails soft
   * so the grid still renders bookings; callers surface a notice rather than
   * letting the MC believe the day is free.
   */
  unavailable: boolean;
}

/**
 * Busy events for an inclusive `YYYY-MM-DD` date range.
 *
 * Shared by the day grid, the week grid and the sidebar agenda so all three
 * hit the same cache entry and cannot disagree about what is on the calendar.
 *
 * @param fromDate - first day, `YYYY-MM-DD`
 * @param toDate - last day, `YYYY-MM-DD`
 */
export function useBusyRange(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['calendar', 'busy', fromDate, toDate],
    queryFn: async (): Promise<BusyResponse> => {
      const res = await fetch(`/api/calendar/busy?from=${fromDate}&to=${toDate}`);
      if (!res.ok) throw new Error('Failed to fetch busy intervals');
      return res.json() as Promise<BusyResponse>;
    },
  });
}
