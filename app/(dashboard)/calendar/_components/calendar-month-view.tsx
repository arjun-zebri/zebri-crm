/**
 * MonthView: Calendar month grid display.
 * Shows a 6-week grid with event pills and mobile dot indicators.
 */

import type { BusyEvent } from "@/lib/calendar/free-busy";
import { Event } from "@/types/event";


import type { Booking } from "../use-bookings";

import { formatDateKey, formatEventLabel, getMonthDays, isTodayFn } from "./calendar-utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

interface EventWithCouple extends Event {
  couple?: {
    id: string;
    name: string;
    status?: string;
  };
  event_contacts?: { count: number }[];
  tasks?: { count: number }[];
}

/** Pills shown per day cell before collapsing the rest into a "+N more". */
const MAX_PILLS = 3;

interface MonthViewProps {
  currentDate: Date;
  eventsByDate: Record<string, EventWithCouple[]>;
  /** Confirmed bookings keyed by `YYYY-MM-DD` in the MC's timezone. */
  bookingsByDate: Record<string, Booking[]>;
  /**
   * External busy events keyed the same way.
   *
   * Shown so a day that is full on Google or Outlook does not read as free
   * here. They are not clickable: they belong to another calendar and there is
   * nothing for Zebri to open.
   */
  busyByDate: Record<string, BusyEvent[]>;
  onSelectCouple: (coupleId: string) => void;
  onSelectBooking: (booking: Booking) => void;
  onDayClick: (date: Date) => void;
}

/**
 * Booking pill for display within calendar cells.
 *
 * Tinted to match the booking chips in the week and day grids, so a booking
 * reads the same way whichever view the MC is in. Stops click propagation so opening a
 * booking does not also trigger the day cell's drill-down.
 */
function BookingPill({
  booking,
  onSelectBooking,
}: {
  booking: Booking;
  onSelectBooking: (booking: Booking) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelectBooking(booking);
      }}
      className="w-full text-left truncate rounded-r-control border-l-2 border-info bg-info/10 text-text px-1.5 py-0.5 text-body hover:opacity-90 transition"
      data-testid={`month-booking-pill-${booking.id}`}
    >
      {booking.couple?.name || booking.name}
    </button>
  );
}

/**
 * Event pill for display within calendar cells.
 * Stops click propagation to prevent triggering day-cell handlers.
 */
function EventPill({
  event,
  onSelectCouple,
}: {
  event: EventWithCouple;
  onSelectCouple: (id: string) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (event.couple) onSelectCouple(event.couple.id);
      }}
      className="text-left w-full px-2.5 py-1.5 rounded-control text-body font-medium truncate bg-surface border border-border transition hover:shadow-sm cursor-pointer"
    >
      {formatEventLabel(event)}
    </button>
  );
}

/**
 * Month view showing all days in a calendar grid (6 weeks × 7 days).
 * Desktop: event pills with "+N more" indicator.
 * Mobile: dot indicators for event presence.
 * Clicking a day cell switches to day view on mobile.
 */
export function MonthView({
  currentDate,
  eventsByDate,
  bookingsByDate,
  busyByDate,
  onSelectCouple,
  onSelectBooking,
  onDayClick,
}: MonthViewProps) {
  const monthDays = getMonthDays(currentDate);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 flex-shrink-0 border-b border-border">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            data-testid={`weekday-${day}`}
            className="text-center text-body font-medium text-text-muted py-3"
          >
            <span className="hidden md:inline">{day}</span>
            <span className="md:hidden">{WEEKDAYS_SHORT[i]}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-7 auto-rows-fr">
        {monthDays.map((date, idx) => {
          const dateKey = formatDateKey(date);
          const dayEvents = eventsByDate[dateKey] || [];
          const dayBookings = bookingsByDate[dateKey] || [];
          const dayBusy = busyByDate[dateKey] || [];
          const isCurrent =
            date.getMonth() === currentDate.getMonth() &&
            date.getFullYear() === currentDate.getFullYear();
          const isCurrentDay = isTodayFn(date);

          return (
            <div
              key={idx}
              onClick={() => onDayClick(date)}
              className={`border-b border-r border-border p-1.5 md:p-2 flex flex-col gap-0.5 min-h-[60px] md:min-h-[100px] md:cursor-default cursor-pointer ${
                !isCurrent ? "bg-surface-muted/70" : ""
              }`}
            >
              <div
                className={`text-body font-medium mb-0.5 ${
                  isCurrent ? "text-text" : "text-text-subtle"
                }`}
              >
                <span
                  className={
                    isCurrentDay
                      ? "bg-brand-fg text-text-inverse rounded-control w-5 h-5 inline-flex items-center justify-center"
                      : ""
                  }
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Mobile: dot indicators */}
              {(dayEvents.length > 0 || dayBookings.length > 0 || dayBusy.length > 0) && (
                <div className="flex md:hidden gap-0.5 flex-wrap mt-0.5">
                  {dayBookings.slice(0, 3).map((booking) => (
                    <div
                      key={booking.id}
                      className="w-1.5 h-1.5 rounded-pill bg-info"
                    />
                  ))}
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="w-1.5 h-1.5 rounded-pill bg-text-subtle"
                    />
                  ))}
                  {dayBusy.slice(0, 3).map((busy) => (
                    <div
                      key={`${busy.start}-${busy.end}`}
                      className="w-1.5 h-1.5 rounded-pill bg-warning"
                    />
                  ))}
                  {dayEvents.length + dayBookings.length + dayBusy.length > 3 && (
                    <div className="w-1.5 h-1.5 rounded-pill bg-border-strong" />
                  )}
                </div>
              )}

              {/* Desktop: booking and event pills. Bookings lead because they
                  are the appointments the MC has to turn up to; weddings are
                  all-day and already anchor the cell. The overflow count spans
                  both lists so nothing is silently dropped. */}
              <div className="hidden md:flex flex-col gap-0.5">
                {dayBookings.slice(0, MAX_PILLS).map((booking) => (
                  <BookingPill
                    key={booking.id}
                    booking={booking}
                    onSelectBooking={onSelectBooking}
                  />
                ))}
                {dayEvents
                  .slice(0, Math.max(0, MAX_PILLS - dayBookings.length))
                  .map((event) => (
                    <EventPill
                      key={event.id}
                      event={event}
                      onSelectCouple={onSelectCouple}
                    />
                  ))}
                {dayBusy
                  .slice(0, Math.max(0, MAX_PILLS - dayBookings.length - dayEvents.length))
                  .map((busy) => (
                    <div
                      key={`${busy.start}-${busy.end}`}
                      className="w-full truncate rounded-r-control border-l-2 border-warning bg-warning/10 text-text-muted px-1.5 py-0.5 text-body"
                      title={busy.title ?? 'Busy'}
                      data-testid="month-busy-pill"
                    >
                      {busy.title ?? 'Busy'}
                    </div>
                  ))}
                {dayEvents.length + dayBookings.length + dayBusy.length > MAX_PILLS && (
                  <div className="text-body text-text-subtle px-1">
                    +{dayEvents.length + dayBookings.length + dayBusy.length - MAX_PILLS} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
