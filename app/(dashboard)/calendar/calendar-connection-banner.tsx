/**
 * Route-level notice shown on `/calendar` when the MC has no usable calendar
 * connection.
 *
 * Sits above the tabs so it is visible from every tab, because the cost of not
 * connecting is spread across all four: the grid hides nothing it does not
 * know about, bookings never reach the real calendar, and video meeting types
 * produce no join link.
 *
 * Nothing here blocks the route. An MC who schedules on Zebri data alone is
 * supported; they just should not discover that by accident.
 *
 * @module app/(dashboard)/calendar/calendar-connection-banner
 */
'use client';

import { AlertTriangle } from 'lucide-react';

import { CalendarConnectButtons } from '@/components/calendar/calendar-connect-prompt';
import { useCalendarConnections } from '@/components/calendar/use-calendar-connections';

/**
 * Render the connect / reconnect banner, or nothing when a healthy connection
 * exists.
 *
 * Renders nothing while loading too, so a connected MC never sees it flash in
 * and out on every navigation to the page.
 */
export function CalendarConnectionBanner() {
  const { hasConnection, hasError, isLoading } = useCalendarConnections();

  if (isLoading || hasConnection) return null;

  // A failed token refresh is a different problem from never having connected:
  // the MC already made a choice and it broke, so say so rather than pitching
  // the feature to them again.
  const message = hasError
    ? "Your calendar connection stopped working. Until you reconnect, bookings won't check it for clashes."
    : "No calendar connected. Bookings won't check your real calendar for clashes.";

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-control border-l-2 border-warning bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-2 text-body text-text">
        <AlertTriangle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-warning" />
        {message}
      </span>
      <CalendarConnectButtons returnTo="calendar" />
    </div>
  );
}
