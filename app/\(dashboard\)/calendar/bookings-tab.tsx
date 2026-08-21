'use client';

import { ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import type { Booking } from './use-bookings';
import { useBookings } from './use-bookings';
import { useAvailability } from './use-availability';
import { BookingRow } from './booking-row';

interface BookingsTabProps {
  onSelectBooking: (booking: Booking) => void;
}

/**
 * Bookings tab showing upcoming and past bookings, split by now.
 * Each row displays the booking time in the MC's timezone, booker name,
 * meeting type, status, and linked couple. Clicking a row opens the
 * detail panel via onSelectBooking.
 *
 * @module app/(dashboard)/calendar/bookings-tab
 */
export function BookingsTab({ onSelectBooking }: BookingsTabProps) {
  const { data: bookings, isLoading, error } = useBookings();
  const { data: availabilityData } = useAvailability();
  const [showPast, setShowPast] = useState(false);

  const timeZone = availabilityData?.timezone ?? 'Australia/Sydney';

  const { upcoming, past } = useMemo(() => {
    if (!bookings) return { upcoming: [], past: [] };

    const now = new Date();
    const upcomingList: typeof bookings = [];
    const pastList: typeof bookings = [];

    for (const booking of bookings) {
      const bookingStart = new Date(booking.starts_at);
      if (bookingStart >= now && booking.status !== 'cancelled') {
        upcomingList.push(booking);
      } else {
        pastList.push(booking);
      }
    }

    // Past in descending order (most recent first)
    pastList.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

    return { upcoming: upcomingList, past: pastList };
  }, [bookings]);

  const formatDateTime = (isoString: string): { date: string; time: string } => {
    const date = new Date(isoString);
    const dateFormatter = new Intl.DateTimeFormat('en-AU', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-AU', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return {
      date: dateFormatter.format(date),
      time: timeFormatter.format(date),
    };
  };

  if (isLoading) {
    return <Loading label="Loading bookings" />;
  }

  if (error) {
    return <ErrorState title="Error loading bookings" description={error.message} />;
  }

  if (!bookings || (upcoming.length === 0 && past.length === 0)) {
    return (
      <Empty
        title="No bookings yet"
        description="Share a meeting type link and they will appear here."
        size="sm"
      />
    );
  }

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-section font-semibold text-text">Upcoming</h3>
          <div className="space-y-2">
            {upcoming.map((booking) => {
              const { date, time } = formatDateTime(booking.starts_at);
              return (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  formattedDate={date}
                  formattedTime={time}
                  onClick={() => onSelectBooking(booking)}
                />
              );
            })}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-body font-medium text-text-muted hover:text-text transition cursor-pointer"
          >
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              className={`transition-transform ${showPast ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            Past ({past.length})
          </button>

          {showPast && (
            <div className="space-y-2">
              {past.map((booking) => {
                const { date, time } = formatDateTime(booking.starts_at);
                return (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    formattedDate={date}
                    formattedTime={time}
                    onClick={() => onSelectBooking(booking)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
