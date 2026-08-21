/**
 * React Query hook for one meeting type's own weekly hours.
 *
 * Kept out of `use-meeting-types.ts` on purpose: the list hook's cache
 * holds `meeting_types` rows, and a type's windows live in a child table
 * that only the edit modal ever needs.
 *
 * @module app/(dashboard)/calendar/use-meeting-type-availability
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import { getMeetingTypeAvailabilityAction } from './meeting-type-actions';

/** One stored window, times as Postgres `HH:MM:SS`. */
export interface MeetingTypeRule {
  weekday: number;
  start_time: string;
  end_time: string;
}

/**
 * Fetch the weekly windows stored against a meeting type.
 *
 * Disabled when `meetingTypeId` is null (the create modal has no row
 * yet), so opening the create form costs no request.
 *
 * @param meetingTypeId - the meeting type being edited, or null
 */
export function useMeetingTypeAvailability(meetingTypeId: string | null) {
  return useQuery({
    queryKey: ['meeting-type-availability', meetingTypeId],
    enabled: meetingTypeId !== null,
    queryFn: async (): Promise<MeetingTypeRule[]> => {
      // `enabled` guarantees an id by the time this runs.
      const result = await getMeetingTypeAvailabilityAction(meetingTypeId!);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
