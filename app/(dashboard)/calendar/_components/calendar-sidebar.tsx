/**
 * CalendarSidebar: Left navigation panel.
 * Includes mini month navigator, mobile status filters, and events timeline for current day.
 */

import { ChevronLeft, ChevronRight, X, MapPin, Clock } from "lucide-react";


import type { BusyEvent } from "@/lib/calendar/free-busy";
import { excludeBookingMirrors } from "@/lib/calendar/intervals";
import { formatTimeInZone } from "@/lib/calendar/timezone";
import { zonedDateParts } from "@/lib/scheduling/timezone";
import { Event } from "@/types/event";

import type { Booking } from "../use-bookings";

import { formatDateKey, formatEventLabel, getMonthDays } from "./calendar-utils";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
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

interface CalendarSidebarProps {
  currentDate: Date;
  miniNavDate: Date;
  onMiniNavDateChange: (date: Date) => void;
  onCurrentDateChange: (date: Date) => void;
  sidebarOpen: boolean;
  onSidebarClose: () => void;
  events: EventWithCouple[] | undefined;
  eventsByDate: Record<string, EventWithCouple[]>;
  onSelectCouple: (coupleId: string) => void;
  timezone?: string;
  selectedDayBookings?: Booking[];
  /** External calendar events for the selected day, titles included. */
  selectedDayBusy?: BusyEvent[];
  /** True when a connected calendar could not be reached for that day. */
  busyUnavailable?: boolean;
  onSelectBooking?: ((booking: Booking) => void) | undefined;
}

/**
 * Left sidebar with mini month, mobile status filters, and day events.
 * On mobile: slides in from left over main content.
 * On desktop: always visible in column layout.
 */
export function CalendarSidebar({
  currentDate,
  miniNavDate,
  onMiniNavDateChange,
  onCurrentDateChange,
  sidebarOpen,
  onSidebarClose,
  events,
  eventsByDate,
  onSelectCouple,
  timezone = 'UTC',
  selectedDayBookings,
  selectedDayBusy,
  busyUnavailable,
  onSelectBooking,
}: CalendarSidebarProps) {
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const miniMonthDays = getMonthDays(miniNavDate);
  const daysWithEvents = new Set(
    (events || [])
      .map((e) => e.date)
  );

  return (
    <>
      {/* Mobile sidebar backdrop */}
      <div
        aria-hidden
        className={`fixed inset-0 bg-black/40 z-10 md:hidden transition-opacity duration-200 ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onSidebarClose}
      />

      {/* Left Sidebar */}
      <div
        className={`
        flex flex-col gap-5 pb-6 overflow-y-auto
        fixed top-0 left-0 h-full w-[280px] z-20 bg-surface shadow-xl p-5
        transition-transform duration-200 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:static md:h-auto md:w-56 md:flex-shrink-0 md:z-auto md:bg-transparent md:shadow-none md:p-0 md:pr-5 md:border-r md:border-border md:translate-x-0 md:transition-none
      `}
      >
        {/* Mobile close button */}
        <div className="flex justify-end md:hidden mb-1">
          <button
            onClick={onSidebarClose}
            className="p-1.5 text-text-subtle hover:text-text transition cursor-pointer"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Mini Month */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() =>
                onMiniNavDateChange(
                  new Date(
                    miniNavDate.getFullYear(),
                    miniNavDate.getMonth() - 1,
                    1
                  )
                )
              }
              className="p-1 text-text-muted hover:bg-surface-emphasis rounded-control transition cursor-pointer"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <span className="text-body font-medium text-text">
              {MONTHS_SHORT[miniNavDate.getMonth()]} {miniNavDate.getFullYear()}
            </span>
            <button
              onClick={() =>
                onMiniNavDateChange(
                  new Date(
                    miniNavDate.getFullYear(),
                    miniNavDate.getMonth() + 1,
                    1
                  )
                )
              }
              className="p-1 text-text-muted hover:bg-surface-emphasis rounded-control transition cursor-pointer"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Mini weekday headers */}
          <div className="grid grid-cols-7 gap-x-[9px] pb-2">
            {WEEKDAYS_SHORT.map((day, i) => (
              <div key={i} className="text-center text-body text-text-subtle py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Mini calendar grid */}
          <div className="grid grid-cols-7 gap-x-[9px] gap-y-2">
            {miniMonthDays.map((date, idx) => {
              const dateKey = formatDateKey(date);
              const hasEvents = daysWithEvents.has(dateKey);
              const isMiniMonth = date.getMonth() === miniNavDate.getMonth();
              const isCurrentDay = isToday(date);
              const isSelectedDay =
                formatDateKey(date) === formatDateKey(currentDate);

              return (
                <button
                  key={idx}
                  onClick={() => {
                    // When clicking a mini calendar day, switch to that date
                    // and close sidebar on mobile
                    const newDate = new Date(date);
                    onCurrentDateChange(newDate);
                    onMiniNavDateChange(
                      new Date(newDate.getFullYear(), newDate.getMonth(), 1)
                    );
                    onSidebarClose();
                  }}
                  className={`h-7 w-7 mx-auto flex flex-col items-center justify-center text-body rounded-control transition cursor-pointer relative ${
                    isSelectedDay
                      ? "bg-brand-fg text-text-inverse hover:opacity-90"
                      : isMiniMonth
                        ? `text-text hover:bg-surface-muted${isCurrentDay ? " font-semibold" : ""}`
                        : "text-text-subtle"
                  }`}
                >
                  {date.getDate()}
                  {hasEvents && !isSelectedDay && (
                    <div className="absolute bottom-0.5 w-1 h-1 rounded-pill bg-success"></div>
                  )}
                  {hasEvents && isSelectedDay && (
                    <div className="absolute bottom-0.5 w-1 h-1 rounded-pill bg-surface"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day Schedule: Bookings + external busy + Weddings */}
        <div className="flex-1 min-h-0 flex flex-col border-t border-border pt-4">
          {(() => {
            const { date: localDate, weekday: dayOfWeek } = zonedDateParts(currentDate, timezone);
            const [, monthStr, dayStr] = localDate.split('-');
            const WEEKDAYS_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const hasBookings = (selectedDayBookings ?? []).length > 0;
            const hasWeddings = (eventsByDate[formatDateKey(currentDate)] || []).length > 0;
            const label = hasBookings || hasWeddings ? "Schedule" : "Schedule";
            return (
              <h3 className="text-body font-medium text-text-muted mb-2">
                {label} · {WEEKDAYS_FULL[dayOfWeek]} {dayStr} {MONTHS_SHORT[Number(monthStr) - 1]}
              </h3>
            );
          })()}
          <div
            className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2"
            data-testid="sidebar-agenda"
          >
            {(() => {
              const events = eventsByDate[formatDateKey(currentDate)] || [];
              const bookings = (selectedDayBookings ?? []).filter(
                (b) => b.status === 'confirmed' || b.status === 'completed'
              );
              // Drop the external copy of a Zebri booking, which the calendar
              // hands back after the booking was pushed to it. Listing both
              // would show the same appointment twice in one agenda.
              const busy = excludeBookingMirrors(
                selectedDayBusy ?? [],
                bookings.map((b) => ({
                start: b.starts_at,
                end: b.ends_at,
                externalEventIds: b.external_event_ids,
              })),
              );

              if (events.length === 0 && bookings.length === 0 && busy.length === 0) {
                // An unreachable calendar must never read as a free day: the MC
                // would double-book themselves on the strength of it.
                return (
                  <div className="text-body text-text-subtle py-4">
                    {busyUnavailable
                      ? 'Nothing booked. Your connected calendar could not be reached, so anything on it is missing here.'
                      : 'Nothing scheduled'}
                  </div>
                );
              }

              // Combine and sort by time
              const combined = [
                ...bookings.map((b) => ({
                  type: 'booking' as const,
                  item: b,
                  sortTime: new Date(b.starts_at).getTime(),
                })),
                ...busy.map((b) => ({
                  type: 'busy' as const,
                  item: b,
                  sortTime: new Date(b.start).getTime(),
                })),
                ...events.map((e) => ({
                  type: 'event' as const,
                  item: e,
                  // Weddings are all-day, so they have no time to sort on and
                  // sit after everything with one. Infinity rather than 0,
                  // which would have sorted them before every timed item.
                  sortTime: Number.POSITIVE_INFINITY,
                })),
              ].sort((a, b) => a.sortTime - b.sortTime);

              return (
                <>
                  {/* A partial list is dangerous in a way an empty one is not:
                      the MC reads the gap as free time. Say so explicitly. */}
                  {busyUnavailable && (
                    <div
                      className="text-body text-text-subtle border-l-2 border-warning bg-warning/10 rounded-r-control px-2.5 py-2"
                      role="status"
                    >
                      Your connected calendar could not be reached, so this list
                      may be incomplete.
                    </div>
                  )}
                  {combined.map((entry) => {
                if (entry.type === 'busy') {
                  const event = entry.item as BusyEvent;
                  return (
                    <div
                      key={`busy-${event.start}-${event.end}`}
                      className="w-full px-2.5 py-2 rounded-r-control border-l-2 border-warning bg-warning/10"
                      data-testid="sidebar-busy-item"
                    >
                      <div className="text-body font-semibold truncate text-text flex items-center gap-2">
                        <Clock size={12} strokeWidth={1.5} />
                        {formatTimeInZone(event.start, timezone)}
                      </div>
                      <div className="text-body text-text-muted truncate mt-0.5">
                        {event.title ?? 'Busy'}
                      </div>
                      <div className="text-body text-text-subtle truncate mt-0.5">
                        Busy elsewhere
                      </div>
                    </div>
                  );
                }

                if (entry.type === 'booking') {
                  const booking = entry.item as Booking;
                  return (
                    <button
                      key={`booking-${booking.id}`}
                      onClick={() => onSelectBooking?.(booking)}
                      // Same tint and left rule as the booking chips on the
                      // grid. The agenda and the grid describe the same day, so
                      // a booking must not read as one kind of thing in one and
                      // something else in the other.
                      className="text-left w-full px-2.5 py-2 rounded-r-control border-l-2 border-info bg-info/10 transition hover:shadow-sm cursor-pointer"
                      data-testid={`sidebar-booking-${booking.id}`}
                    >
                      <div className="text-body font-semibold truncate text-text flex items-center gap-2">
                        <Clock size={12} strokeWidth={1.5} />
                        {formatTimeInZone(booking.starts_at, timezone)}
                      </div>
                      <div className="text-body text-text-muted truncate mt-0.5">
                        {booking.couple?.name || booking.name}
                      </div>
                      {booking.meeting_type && (
                        <div className="text-body text-text-subtle truncate mt-0.5">
                          {booking.meeting_type.name}
                        </div>
                      )}
                    </button>
                  );
                } else {
                  const event = entry.item as EventWithCouple;
                  return (
                    <button
                      key={`event-${event.id}`}
                      onClick={() =>
                        event.couple && onSelectCouple(event.couple.id)
                      }
                      className="text-left w-full px-2.5 py-2 rounded-control bg-surface border border-border transition hover:shadow-sm cursor-pointer"
                      data-testid={`sidebar-event-${event.id}`}
                    >
                      <div className="text-body font-semibold truncate text-text">
                        {formatEventLabel(event)}
                      </div>
                      {event.venue && (
                        <div className="text-body text-text-muted truncate mt-0.5 flex items-center gap-1">
                          <MapPin size={10} strokeWidth={1.5} />
                          {event.venue}
                        </div>
                      )}
                    </button>
                  );
                }
                  })}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
