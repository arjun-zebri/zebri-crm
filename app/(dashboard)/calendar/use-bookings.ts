/**
 * React Query hooks for the Calendar page booking data sources.
 *
 * The dashboard grid queries bookings to show owner-scoped visibility of scheduled MCs.
 * Bookings are queried with couple info and meeting-type details (name + location_type).
 *
 * Hooks live in a single module so the parent page can call both
 * independently, and list components stay purely presentational. The supabase
 * client is created lazily inside each `queryFn` so the hooks don't run any
 * Supabase code at import-time.
 *
 * @module app/(dashboard)/calendar/use-bookings
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';

/**
 * Represents a single booking with couple and meeting-type metadata.
 * Reflects the columns selected in the queries.
 */
export interface Booking {
  id: string;
  name: string;
  email: string;
  partner_name: string | null;
  phone: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  /**
   * Meet or Teams link generated when the booking was pushed to the MC's
   * calendar. Null for phone and in-person meetings, and for bookings whose
   * calendar push failed. Safe to expose: this endpoint is owner-scoped.
   */
  video_join_url: string | null;
  /**
   * Provider event ids for the calendar copies Zebri created, keyed by
   * provider. Used to recognise those copies coming back through free/busy so
   * one appointment is not drawn twice.
   */
  external_event_ids: Record<string, string> | null;
  /** When the booking came in. Drives the "Booked 18 Aug" line in the modal. */
  created_at: string;
  /** The booker's timezone, captured at submit time. Shown when it differs
   *  from the MC's own, so an MC never dials in an hour late for someone
   *  interstate. */
  timezone: string;
  couple: { id: string; name: string } | null;
  meeting_type: {
    id: string;
    name: string;
    location_type: string;
    duration_minutes: number;
  } | null;
}

/**
 * All bookings owned by the current user, ordered by starts_at.
 *
 * RLS scopes to the current user even though `.eq('user_id', ...)` is
 * defensive and redundant; matching the house idiom.
 */
export function useBookings() {
  const supabase = createClient();
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async (): Promise<Booking[]> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, name, email, partner_name, phone, starts_at, ends_at, status, notes, video_join_url, external_event_ids, created_at, timezone, couple:couple_id(id, name), meeting_type:meeting_type_id(id, name, location_type, duration_minutes)',
        )
        .eq('user_id', user.user.id)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      return (data as unknown as Booking[]) || [];
    },
  });
}

/**
 * Bookings owned by the current user that overlap the given date range.
 *
 * Uses overlap detection (not containment): returns any booking that touches
 * the window at all, including those that straddle edges (e.g., a 23:45-00:15
 * booking in a day view, or one crossing a week boundary). Containment logic
 * would hide these edge cases with no UI indication, breaking the grid.
 *
 * Date arguments are used directly as ISO strings to avoid timezone traps
 * from string concatenation.
 *
 * RLS scopes to the current user even though `.eq('user_id', ...)` is
 * defensive and redundant; matching the house idiom.
 */
export function useBookingsInRange(from: Date, to: Date) {
  const supabase = createClient();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const fromDate = from.toISOString().split('T')[0];
  const toDate = to.toISOString().split('T')[0];

  return useQuery({
    queryKey: ['bookings', fromDate, toDate],
    queryFn: async (): Promise<Booking[]> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      // Overlap detection: booking must end AFTER window start AND start BEFORE window end.
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, name, email, partner_name, phone, starts_at, ends_at, status, notes, video_join_url, external_event_ids, created_at, timezone, couple:couple_id(id, name), meeting_type:meeting_type_id(id, name, location_type, duration_minutes)',
        )
        .eq('user_id', user.user.id)
        .gt('ends_at', fromIso)
        .lt('starts_at', toIso)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      return (data as unknown as Booking[]) || [];
    },
  });
}
