'use client';

import { useMemo, useState } from 'react';

import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';

import { BookingsSkeleton } from './_components/tab-skeletons';
import { groupByDay } from './booking-display';
import { BookingsList } from './bookings-list';
import { BookingsToolbar, type BookingFilter } from './bookings-toolbar';
import { useAvailability } from './use-availability';
import { useBookings, type Booking } from './use-bookings';

/** Copy for the empty state of each filter. */
const EMPTY_COPY: Record<BookingFilter, { title: string; description: string }> = {
  upcoming: {
    title: 'Nothing booked yet',
    description: 'Share a booking link and the meetings your couples book land here.',
  },
  past: {
    title: 'No past bookings',
    description: 'Meetings move here once they have finished.',
  },
  cancelled: {
    title: 'No cancelled bookings',
    description: 'Bookings you or the booker call off show up here.',
  },
};

export interface BookingsTabProps {
  onSelectBooking: (booking: Booking) => void;
}

/**
 * Bookings tab: the MC's diary of booked meetings, grouped by day.
 *
 * Three slices sit behind one switcher (Upcoming, Past, Cancelled) because
 * they answer different questions and only the first is asked daily.
 * Rows are grouped under a day heading so a run of meetings reads as a day
 * rather than as a list of dates repeated on every line.
 *
 * @module app/(dashboard)/calendar/bookings-tab
 */
export function BookingsTab({ onSelectBooking }: BookingsTabProps) {
  const { data: bookings, isLoading, error } = useBookings();
  const { data: availabilityData } = useAvailability();

  const [filter, setFilter] = useState<BookingFilter>('upcoming');
  const [search, setSearch] = useState('');

  const timeZone = availabilityData?.timezone ?? 'Australia/Sydney';

  const { slices, counts } = useMemo(() => {
    const now = new Date().getTime();
    const upcoming: Booking[] = [];
    const past: Booking[] = [];
    const cancelled: Booking[] = [];

    for (const booking of bookings ?? []) {
      if (booking.status === 'cancelled') {
        cancelled.push(booking);
        // A booking that has already ended is history even if it is still
        // marked confirmed: the status only ever moves on cancellation.
      } else if (new Date(booking.ends_at).getTime() < now) {
        past.push(booking);
      } else {
        upcoming.push(booking);
      }
    }

    const newestFirst = (a: Booking, b: Booking) =>
      new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
    past.sort(newestFirst);
    cancelled.sort(newestFirst);

    return {
      slices: { upcoming, past, cancelled },
      counts: {
        upcoming: upcoming.length,
        past: past.length,
        cancelled: cancelled.length,
      },
    };
  }, [bookings]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = slices[filter].filter((booking) =>
      term
        ? booking.name.toLowerCase().includes(term) ||
          (booking.couple?.name.toLowerCase().includes(term) ?? false)
        : true,
    );
    return groupByDay(matches, timeZone, new Date());
  }, [slices, filter, search, timeZone]);

  if (isLoading) return <BookingsSkeleton />;

  if (error) {
    return <ErrorState title="Error loading bookings" description={error.message} />;
  }

  const empty = EMPTY_COPY[filter];

  return (
    // Full height, not content height: the list is the page on this tab, so
    // its card runs to the bottom edge and scrolls inside itself rather than
    // floating above a band of empty surface.
    <div className="flex h-full flex-col gap-4">
      <BookingsToolbar
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        search={search}
        onSearchChange={setSearch}
      />

      {groups.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-control border border-border">
          {search.trim() ? (
            <Empty
              title="No bookings match that search"
              description="Try a different name, or clear the search."
              size="sm"
            />
          ) : (
            <Empty title={empty.title} description={empty.description} size="sm" />
          )}
        </div>
      ) : (
        <BookingsList
          groups={groups}
          timeZone={timeZone}
          highlightToday={filter === 'upcoming'}
          isPast={filter === 'past'}
          {...(filter === 'upcoming' && !search.trim() && { footer: 'Nothing else booked yet.' })}
          onSelectBooking={onSelectBooking}
        />
      )}
    </div>
  );
}
