"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";

import { useCoupleStatuses } from "@/app/(dashboard)/couples/use-couple-statuses";
import { CalendarConnectNote } from "@/components/calendar/calendar-connect-prompt";
import { useCalendarConnections } from "@/components/calendar/use-calendar-connections";
import type { BusyEvent } from "@/lib/calendar/free-busy";
import { excludeBookingMirrors } from "@/lib/calendar/intervals";
import { getLocalDayStart } from "@/lib/calendar/timezone";
import { zonedDateParts } from "@/lib/scheduling/timezone";
import { createClient } from "@/lib/supabase/client";
import { Event } from "@/types/event";

import type { Booking } from "../use-bookings";
import { useBookingsInRange } from "../use-bookings";
import { useBusyRange } from "../use-busy";
import { useMcTimezone } from "../use-mc-timezone";

import { DayView } from "./calendar-day-view";
import { CalendarHeader } from "./calendar-header";
import { MonthView } from "./calendar-month-view";
import { CalendarSidebar } from "./calendar-sidebar";
import { CalendarSkeleton } from "./calendar-skeleton";
import { WeekView } from "./calendar-week-view";
import type { AllDayEvent } from "./grid-all-day-band";

interface CouplesCalendarProps {
  onSelectCouple: (coupleId: string) => void;
  onSelectBooking?: (booking: Booking) => void;
}

interface EventWithCouple extends Event {
  couple?: {
    id: string;
    name: string;
    status?: string;
  };
  event_contacts?: { count: number }[];
  tasks?: { count: number }[];
}

type CalendarView = "month" | "week" | "day";

/**
 * Main CouplesCalendar component: data fetching and composition layer.
 * Manages calendar state, filters, and renders the appropriate view.
 * Delegates rendering to specialized view components.
 */
export function CouplesCalendar({ onSelectCouple, onSelectBooking }: CouplesCalendarProps) {
  const supabase = createClient();
  const { data: statuses } = useCoupleStatuses();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  // `null` = no filter applied, so a fresh MC sees every wedding. An empty
  // Set is a real state (everything unticked) and must not collapse to null.
  const [activeStatuses, setActiveStatuses] = useState<Set<string> | null>(null);
  const [miniNavDate, setMiniNavDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Never-connected is a different state from connected-but-unreachable: the
  // sidebar already warns about the latter via `busyUnavailable`. Keying off an
  // empty connection list keeps the two notices mutually exclusive, so the MC
  // is never told their calendar "could not be reached" before they have one.
  const { connections } = useCalendarConnections();
  const noCalendarConnected = connections.length === 0;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Downgrade week view to day on mobile since week isn't available.
  useEffect(() => {
    if (isMobile && calendarView === "week") {
      setCalendarView("day");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const timezone = useMcTimezone();

  // Get bookings for the selected day
  const selectedDayStart = getLocalDayStart(currentDate, timezone);
  const selectedDayEnd = new Date(selectedDayStart.getTime() + 24 * 60 * 60 * 1000);
  const { data: selectedDayBookings = [] } = useBookingsInRange(
    selectedDayStart,
    selectedDayEnd,
  );

  // External busy for the selected day, feeding the sidebar agenda. Shares the
  // query cache with whichever grid is on screen, so the agenda and the grid
  // can never show different pictures of the same day.
  const { date: selectedDateStr } = zonedDateParts(currentDate, timezone);
  const { data: selectedDayBusy } = useBusyRange(selectedDateStr, selectedDateStr);

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, user_id, date, couple_id, status, created_at, venue, timeline_notes, title, couples(id, name, status), event_contacts(count), tasks!tasks_related_event_id_fkey(count)"
        )
        .eq("user_id", user.user.id)
        .not("date", "is", null);

      if (error) throw error;
      return ((data || []) as Array<Event & { couples?: { id: string; name: string; status?: string } }>).map(
        (event) => ({
          ...event,
          couple: event.couples,
        })
      ) as EventWithCouple[];
    },
  });

  // Weddings only. Bookings and external busy time are commitments already
  // made, so the filter never hides them: it narrows the pipeline layer, not
  // the diary.
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (activeStatuses === null) return events;
    return events.filter((event) =>
      activeStatuses.has(event.couple?.status || "new"),
    );
  }, [events, activeStatuses]);

  /**
   * Flip one status slug. The first toggle seeds the set from every known
   * status, so unticking one leaves the other four on rather than leaving a
   * single-status filter behind.
   */
  const toggleStatus = (slug: string) => {
    setActiveStatuses((current) => {
      const next = new Set(current ?? statuses.map((s) => s.slug));
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  // Bookings across the visible month, padded a week either side so the grid's
  // leading and trailing days from the neighbouring months are covered too.
  const monthRangeStart = useMemo(
    () => new Date(currentDate.getFullYear(), currentDate.getMonth(), -6),
    [currentDate],
  );
  const monthRangeEnd = useMemo(
    () => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 8),
    [currentDate],
  );
  const { data: monthBookings = [] } = useBookingsInRange(monthRangeStart, monthRangeEnd);

  // External busy across the same window, so the month grid can show the days
  // that are already spoken for on Google or Outlook. Without it the month view
  // showed a clear diary on days the MC was fully booked elsewhere.
  const { date: monthRangeStartStr } = zonedDateParts(monthRangeStart, timezone);
  const { date: monthRangeEndStr } = zonedDateParts(monthRangeEnd, timezone);
  const { data: monthBusy } = useBusyRange(monthRangeStartStr, monthRangeEndStr);

  const busyByDate = useMemo(() => {
    const bookingSpans = monthBookings
      .filter((b) => b.status !== 'cancelled')
      .map((b) => ({
                start: b.starts_at,
                end: b.ends_at,
                externalEventIds: b.external_event_ids,
              }));
    // Drop the external copies of Zebri bookings, which are already drawn as
    // booking pills; listing both shows one commitment twice.
    const events = excludeBookingMirrors(monthBusy?.busy ?? [], bookingSpans);

    const grouped: Record<string, BusyEvent[]> = {};
    for (const event of events) {
      const { date } = zonedDateParts(new Date(event.start), timezone);
      (grouped[date] ??= []).push(event);
    }
    return grouped;
  }, [monthBusy, monthBookings, timezone]);

  const bookingsByDate = useMemo(() => {
    const grouped: Record<string, Booking[]> = {};
    for (const booking of monthBookings) {
      if (booking.status === 'cancelled') continue;
      // Keyed by the booking's date in the MC's timezone, which is the same
      // clock the month cells are labelled with. Using the browser's timezone
      // here would file a late-evening booking under the wrong day for any MC
      // travelling or working across a timezone boundary.
      const { date } = zonedDateParts(new Date(booking.starts_at), timezone);
      (grouped[date] ??= []).push(booking);
    }
    return grouped;
  }, [monthBookings, timezone]);

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, EventWithCouple[]> = {};
    filteredEvents.forEach((event) => {
      const dateStr = event.date;
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(event);
    });
    return grouped;
  }, [filteredEvents]);

  /**
   * The same wedding map, narrowed to what the all-day band needs.
   *
   * The grids take only id/title/venue/couple, so this drops the rest rather
   * than widening their contract to the full event row.
   */
  const allDayEventsByDate = useMemo(() => {
    const narrowed: Record<string, AllDayEvent[]> = {};
    for (const [date, dayEvents] of Object.entries(eventsByDate)) {
      narrowed[date] = dayEvents.map((event) => ({
        id: event.id,
        ...(event.title ? { title: event.title } : {}),
        ...(event.venue ? { venue: event.venue } : {}),
        ...(event.couple ? { couple: { id: event.couple.id, name: event.couple.name } } : {}),
      }));
    }
    return narrowed;
  }, [eventsByDate]);

  const handlePrev = () => {
    if (calendarView === "month") {
      const d = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      );
      setCurrentDate(d);
      setMiniNavDate(new Date(d.getFullYear(), d.getMonth(), 1));
    } else if (calendarView === "week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
      setMiniNavDate(new Date(d.getFullYear(), d.getMonth(), 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
      setMiniNavDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const handleNext = () => {
    if (calendarView === "month") {
      const d = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1
      );
      setCurrentDate(d);
      setMiniNavDate(new Date(d.getFullYear(), d.getMonth(), 1));
    } else if (calendarView === "week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
      setMiniNavDate(new Date(d.getFullYear(), d.getMonth(), 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
      setMiniNavDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      <CalendarSidebar
        currentDate={currentDate}
        miniNavDate={miniNavDate}
        onMiniNavDateChange={setMiniNavDate}
        onCurrentDateChange={setCurrentDate}
        sidebarOpen={sidebarOpen}
        onSidebarClose={() => setSidebarOpen(false)}
        events={events}
        eventsByDate={eventsByDate}
        onSelectCouple={onSelectCouple}
        timezone={timezone}
        selectedDayBookings={selectedDayBookings}
        selectedDayBusy={selectedDayBusy?.busy ?? []}
        busyUnavailable={selectedDayBusy?.unavailable ?? false}
        onSelectBooking={onSelectBooking}
      />

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden pl-0 md:pl-8">
        {/* Header */}
        <CalendarHeader
          currentDate={currentDate}
          calendarView={calendarView}
          onViewChange={setCalendarView}
          onToday={() => {
            setCurrentDate(new Date());
            setMiniNavDate(new Date());
          }}
          onPrev={handlePrev}
          onNext={handleNext}
          isMobile={isMobile}
          onSidebarOpen={() => setSidebarOpen(true)}
          timezone={timezone}
          statuses={statuses}
          activeStatuses={activeStatuses}
          onToggleStatus={toggleStatus}
        />

        {noCalendarConnected && (
          <div className="pb-3">
            <CalendarConnectNote message="Only Zebri bookings are shown here. Connect a calendar to see what else is on your day." />
          </div>
        )}

        {/* Calendar Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {eventsLoading ? (
            <CalendarSkeleton view={calendarView} />
          ) : (
            <>
              {calendarView === "month" && (
                <MonthView
                  bookingsByDate={bookingsByDate}
                  busyByDate={busyByDate}
                  onSelectBooking={onSelectBooking || (() => {})}
                  currentDate={currentDate}
                  eventsByDate={eventsByDate}
                  onSelectCouple={onSelectCouple}
                  onDayClick={(date) => {
                    setCurrentDate(date);
                    if (isMobile) setCalendarView("day");
                  }}
                />
              )}
              {calendarView === "week" && (
                <WeekView
                  currentDate={currentDate}
                  eventsByDate={allDayEventsByDate}
                  onSelectCouple={onSelectCouple}
                  onSelectBooking={onSelectBooking || (() => {})}
                />
              )}
              {calendarView === "day" && (
                <DayView
                  currentDate={currentDate}
                  eventsByDate={allDayEventsByDate}
                  onSelectCouple={onSelectCouple}
                  onSelectBooking={onSelectBooking || (() => {})}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
