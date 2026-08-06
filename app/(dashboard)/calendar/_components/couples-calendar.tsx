"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
  CheckSquare,
  SlidersHorizontal,
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";

import { useCoupleStatuses } from "@/app/(dashboard)/couples/use-couple-statuses";
import { createClient } from "@/lib/supabase/client";
import { CoupleStatusRecord, getStatusClasses } from '@/types/couple';
import { Event } from '@/types/event';

interface CouplesCalendarProps {
  onSelectCouple: (coupleId: string) => void;
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
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

type CalendarView = "month" | "week" | "day";


function ViewDropdown({
  view,
  onChange,
  options = ["day", "week", "month"] as CalendarView[],
}: {
  view: CalendarView;
  onChange: (view: CalendarView) => void;
  options?: CalendarView[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 border border-border rounded-control px-2 py-2 text-caption text-text-muted hover:bg-surface-muted hover:text-text transition whitespace-nowrap cursor-pointer"
      >
        <span className="capitalize">{view}</span>
        <ChevronDown size={11} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-control shadow-lg z-20 min-w-32 py-1">
          {options.map((v) => (
            <button
              key={v}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 text-caption capitalize transition cursor-pointer ${
                view === v
                  ? "bg-surface-muted text-text font-medium"
                  : "text-text hover:bg-surface-muted"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDropdown({
  statuses,
  activeStatuses,
  onToggle,
}: {
  statuses: CoupleStatusRecord[];
  activeStatuses: Set<string> | null;
  onToggle: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const label = "Statuses";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 border border-border rounded-control px-2 py-2 text-caption text-text-muted hover:bg-surface-muted hover:text-text transition whitespace-nowrap cursor-pointer"
      >
        <span>{label}</span>
        <ChevronDown size={11} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-control shadow-lg z-20 min-w-40 py-1">
          {statuses.map((status) => {
            const checked =
              activeStatuses === null || activeStatuses.has(status.slug);
            return (
              <button
                key={status.slug}
                onClick={() => onToggle(status.slug)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-caption text-text hover:bg-surface-muted transition cursor-pointer"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-control border flex-shrink-0 flex items-center justify-center ${
                    checked
                      ? "border-brand-fg bg-brand-fg"
                      : "border-border-strong bg-surface"
                  }`}
                >
                  {checked && (
                    <Check size={9} strokeWidth={2.5} className="text-text-inverse" />
                  )}
                </div>
                <span>{status.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CouplesCalendar({ onSelectCouple }: CouplesCalendarProps) {
  const supabase = createClient();
  const { data: statuses } = useCoupleStatuses();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [activeStatuses, setActiveStatuses] = useState<Set<string> | null>(
    null
  );
  const [miniNavDate, setMiniNavDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile) {
      if (calendarView === "week") setCalendarView("day");
    }
  }, [isMobile]);

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
      return ((data || []) as any[]).map((event) => ({
        ...event,
        couple: event.couples,
      })) as EventWithCouple[];
    },
  });

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((event) => {
      const status = event.couple?.status || "new";
      const hasStatus = activeStatuses === null || activeStatuses.has(status);
      return hasStatus;
    });
  }, [events, activeStatuses]);

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, EventWithCouple[]> = {};
    filteredEvents.forEach((event) => {
      const dateStr = event.date;
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(event);
    });
    return grouped;
  }, [filteredEvents]);

  // Use local date components, not toISOString (UTC), so events stored as
  // bare Postgres `date` (e.g. "2026-06-07") line up with the cell the MC
  // sees as June 7 in their own timezone.
  const formatDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const toggleStatus = (statusSlug: string) => {
    const base = activeStatuses ?? new Set(statuses.map((s) => s.slug));
    const newStatuses = new Set(base);
    if (newStatuses.has(statusSlug)) {
      newStatuses.delete(statusSlug);
    } else {
      newStatuses.add(statusSlug);
    }
    setActiveStatuses(newStatuses);
  };

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

  const getHeaderLabel = (): string => {
    if (calendarView === "month") {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (calendarView === "week") {
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${
          MONTHS[weekStart.getMonth()]
        } ${weekStart.getDate()}\u2013${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
      }
      return `${
        MONTHS_SHORT[weekStart.getMonth()]
      } ${weekStart.getDate()} \u2013 ${
        MONTHS_SHORT[weekEnd.getMonth()]
      } ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
    }
    return `${WEEKDAYS[currentDate.getDay()]}, ${
      MONTHS[currentDate.getMonth()]
    } ${currentDate.getDate()}`;
  };

  const miniMonthDays = getMonthDays(miniNavDate);
  const daysWithEvents = new Set(
    (events || [])
      .filter(
        (e) =>
          e.couple &&
          (activeStatuses === null ||
            activeStatuses.has(e.couple.status || "new"))
      )
      .map((e) => e.date)
  );

  return (
    <div className="flex h-full">
      {/* Mobile sidebar backdrop — fades with the slide-in */}
      <div
        aria-hidden
        className={`fixed inset-0 bg-black/40 z-10 md:hidden transition-opacity duration-200 ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Left Sidebar
          On mobile: always mounted off-screen, slides in via translate-x.
          On desktop: md:* overrides flip it into the in-flow column layout. */}
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
            onClick={() => setSidebarOpen(false)}
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
                setMiniNavDate(
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
                setMiniNavDate(
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
              <div key={i} className="text-center text-caption text-text-subtle py-1">
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
                    setCurrentDate(new Date(date));
                    setMiniNavDate(
                      new Date(date.getFullYear(), date.getMonth(), 1)
                    );
                    // Dismiss the mobile slide-in panel after picking a day.
                    // No-op on desktop where the sidebar is always mounted.
                    setSidebarOpen(false);
                  }}
                  className={`h-7 w-7 mx-auto flex flex-col items-center justify-center text-caption rounded-control transition cursor-pointer relative ${
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

        {/* Status filters - mobile only */}
        <div className="md:hidden border-t border-border pt-4">
          <h3 className="text-caption font-medium text-text-muted mb-2">Filter by status</h3>
          <div className="flex flex-col">
            {statuses.map((status) => {
              const checked = activeStatuses === null || activeStatuses.has(status.slug);
              return (
                <button
                  key={status.slug}
                  onClick={() => toggleStatus(status.slug)}
                  className="w-full flex items-center gap-2 py-1.5 rounded-control text-caption text-text hover:bg-surface-muted transition cursor-pointer text-left"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-control border flex-shrink-0 flex items-center justify-center ${
                      checked ? "border-brand-fg bg-brand-fg" : "border-border-strong bg-surface"
                    }`}
                  >
                    {checked && <Check size={9} strokeWidth={2.5} className="text-text-inverse" />}
                  </div>
                  <span>{status.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day Events Timeline */}
        <div className="flex-1 min-h-0 flex flex-col border-t border-border pt-4">
          <h3 className="text-caption font-medium text-text-muted mb-2">
            Events · {WEEKDAYS[currentDate.getDay()]} {currentDate.getDate()}{" "}
            {MONTHS_SHORT[currentDate.getMonth()]}
          </h3>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
            {(eventsByDate[formatDateKey(currentDate)] || []).length === 0 ? (
              <div className="text-caption text-text-subtle py-4">No events</div>
            ) : (
              (eventsByDate[formatDateKey(currentDate)] || []).map((event) => {
                return (
                  <button
                    key={event.id}
                    onClick={() =>
                      event.couple && onSelectCouple(event.couple.id)
                    }
                    className="text-left w-full px-2.5 py-2 rounded-control bg-surface border border-border transition hover:shadow-sm cursor-pointer"
                  >
                    <div className="text-caption font-semibold truncate text-text">
                      {formatEventLabel(event)}
                    </div>
                    {event.venue && (
                      <div className="text-caption text-text-muted truncate mt-0.5 flex items-center gap-1">
                        <MapPin size={10} strokeWidth={1.5} />
                        {event.venue}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden pl-0 md:pl-8">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between mb-5 pb-4 border-b border-border">
          {/* Left: Filter toggle (mobile) + Nav */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden inline-flex items-center justify-center p-1.5 text-text-muted hover:bg-surface-muted hover:text-text rounded-control transition cursor-pointer"
            >
              <SlidersHorizontal size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => {
                setCurrentDate(new Date());
                setMiniNavDate(new Date());
              }}
              className="inline-flex items-center border border-border rounded-control px-2 py-2 text-caption text-text-muted hover:bg-surface-muted hover:text-text transition whitespace-nowrap cursor-pointer"
            >
              Today
            </button>
            <button
              data-testid="calendar-prev-btn"
              onClick={handlePrev}
              className="inline-flex items-center justify-center p-1.5 text-text-muted hover:bg-surface-muted hover:text-text rounded-control transition cursor-pointer"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <h2
              data-testid="calendar-header"
              className="text-body font-semibold text-text min-w-0 sm:min-w-32 md:min-w-44 text-center select-none truncate max-w-[180px] sm:max-w-none"
            >
              {getHeaderLabel()}
            </h2>
            <button
              data-testid="calendar-next-btn"
              onClick={handleNext}
              className="inline-flex items-center justify-center p-1.5 text-text-muted hover:bg-surface-muted hover:text-text rounded-control transition cursor-pointer"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Right: Dropdowns */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <StatusDropdown
                statuses={statuses}
                activeStatuses={activeStatuses}
                onToggle={toggleStatus}
              />
            </div>
            <ViewDropdown
              view={calendarView}
              onChange={setCalendarView}
              options={isMobile ? ["day", "month"] : ["day", "week", "month"]}
            />
          </div>
        </div>

        {/* Calendar Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {eventsLoading ? (
            <CalendarSkeleton view={calendarView} />
          ) : (
            <>
              {calendarView === "month" && (
                <MonthView
                  currentDate={currentDate}
                  eventsByDate={eventsByDate}
                  onSelectCouple={onSelectCouple}
                  onDayClick={(date) => {
                    setCurrentDate(date);
                    if (isMobile) setCalendarView("day");
                  }}
                  statuses={statuses}
                />
              )}
              {calendarView === "week" && (
                <WeekView
                  currentDate={currentDate}
                  eventsByDate={eventsByDate}
                  onSelectCouple={onSelectCouple}
                  statuses={statuses}
                />
              )}
              {calendarView === "day" && (
                <DayView
                  currentDate={currentDate}
                  eventsByDate={eventsByDate}
                  onSelectCouple={onSelectCouple}
                  statuses={statuses}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────── */

function getMonthDays(date: Date): Date[] {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "Couple Name – Event Title", or just the couple name when no title is set. */
function formatEventLabel(event: EventWithCouple): string {
  const name = event.couple?.name || "Unnamed";
  return event.title ? `${name} – ${event.title}` : name;
}

function isTodayFn(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function EventPill({
  event,
  onSelectCouple,
}: {
  event: EventWithCouple;
  onSelectCouple: (id: string) => void;
  statuses: CoupleStatusRecord[];
}) {
  return (
    <button
      onClick={(e) => {
        // Don't let the click bubble to the day cell's switch-to-day-view
        // handler — tapping a pill opens the couple modal instead.
        e.stopPropagation();
        if (event.couple) onSelectCouple(event.couple.id);
      }}
      className="text-left w-full px-2.5 py-1.5 rounded-control text-caption font-medium truncate bg-surface border border-border transition hover:shadow-sm cursor-pointer"
    >
      {formatEventLabel(event)}
    </button>
  );
}

/* ─── Calendar Skeleton ────────────────────────────────────── */

function CalendarSkeleton({ view }: { view: CalendarView }) {
  if (view === "month") {
    const monthDays = getMonthDays(new Date());
    return (
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-7 flex-shrink-0 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-caption font-medium text-text-muted py-2"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-7 auto-rows-fr">
          {monthDays.map((date, idx) => {
            const isCurrent = date.getMonth() === new Date().getMonth();
            return (
              <div
                key={idx}
                className={`border-b border-r border-border p-2 flex flex-col gap-0.5 min-h-[100px] ${
                  !isCurrent ? "bg-surface-muted/70" : ""
                }`}
              >
                <div
                  className={`text-caption font-medium mb-0.5 ${
                    isCurrent ? "text-text" : "text-text-subtle"
                  }`}
                >
                  {date.getDate()}
                </div>
                <div className="h-6 bg-surface-emphasis rounded-control animate-pulse" />
                <div className="h-6 bg-surface-emphasis rounded-control animate-pulse" />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "week") {
    const weekDays = getWeekDays(new Date());
    return (
      <div className="grid grid-cols-7 h-full">
        {weekDays.map((date, idx) => (
          <div
            key={idx}
            className="flex flex-col border-r border-border last:border-r-0 min-h-0"
          >
            <div className="px-2 py-3 text-center border-b border-border flex-shrink-0">
              <div className="text-caption text-text-muted font-medium">
                {WEEKDAYS[date.getDay()]}
              </div>
              <div className="text-body font-semibold mt-0.5 text-text">
                {date.getDate()}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="w-full h-12 bg-surface-emphasis rounded-control animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Day view
  return (
    <div className="flex flex-col h-full p-6">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="relative bg-surface-emphasis rounded-control overflow-hidden mb-3 p-5 animate-pulse"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-border-strong" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="h-5 bg-border rounded-control w-3/4 mb-2" />
              <div className="h-4 bg-border rounded-control w-1/2" />
            </div>
            <div className="h-6 w-16 bg-border rounded-pill flex-shrink-0" />
          </div>
          <div className="h-4 bg-border rounded-control w-full mt-3" />
          <div className="h-4 bg-border rounded-control w-2/3 mt-2" />
          <div className="flex items-center gap-5 mt-4 pt-4">
            <div className="h-4 bg-border rounded-control w-20" />
            <div className="h-4 bg-border rounded-control w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Month View ───────────────────────────────────────── */

function MonthView({
  currentDate,
  eventsByDate,
  onSelectCouple,
  onDayClick,
  statuses,
}: {
  currentDate: Date;
  eventsByDate: Record<string, EventWithCouple[]>;
  onSelectCouple: (coupleId: string) => void;
  onDayClick: (date: Date) => void;
  statuses: CoupleStatusRecord[];
}) {
  const monthDays = getMonthDays(currentDate);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 flex-shrink-0 border-b border-border">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            data-testid={`weekday-${day}`}
            className="text-center text-caption font-medium text-text-muted py-3"
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
                className={`text-caption font-medium mb-0.5 ${
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
              {dayEvents.length > 0 && (
                <div className="flex md:hidden gap-0.5 flex-wrap mt-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="w-1.5 h-1.5 rounded-pill bg-text-subtle"
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="w-1.5 h-1.5 rounded-pill bg-border-strong" />
                  )}
                </div>
              )}

              {/* Desktop: event pills */}
              <div className="hidden md:flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventPill
                    key={event.id}
                    event={event}
                    onSelectCouple={onSelectCouple}
                    statuses={statuses}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-caption text-text-subtle px-1">
                    +{dayEvents.length - 3} more
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

/* ─── Week View ────────────────────────────────────────── */

function WeekView({
  currentDate,
  eventsByDate,
  onSelectCouple,
  statuses,
}: {
  currentDate: Date;
  eventsByDate: Record<string, EventWithCouple[]>;
  onSelectCouple: (coupleId: string) => void;
  statuses: CoupleStatusRecord[];
}) {
  const weekDays = getWeekDays(currentDate);

  return (
    <div className="grid grid-cols-7 h-full">
      {weekDays.map((date, idx) => {
        const dateKey = formatDateKey(date);
        const dayEvents = eventsByDate[dateKey] || [];
        const isCurrentDay = isTodayFn(date);

        return (
          <div
            key={idx}
            className="flex flex-col border-r border-border last:border-r-0 min-h-0"
          >
            {/* Day header */}
            <div className="px-3 h-14 flex flex-col items-center justify-center text-center border-b border-border flex-shrink-0">
              <div className="text-caption text-text-muted font-medium">
                {WEEKDAYS[date.getDay()]}
              </div>
              <div className="text-body font-semibold mt-0.5 text-text">
                <span
                  className={
                    isCurrentDay
                      ? "bg-brand-fg text-text-inverse rounded-control w-6 h-6 inline-flex items-center justify-center text-caption"
                      : ""
                  }
                >
                  {date.getDate()}
                </span>
              </div>
            </div>

            {/* Events */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-1.5">
              {dayEvents.length === 0 ? (
                <div className="flex-1 flex items-start justify-center pt-8">
                  <div className="w-4 h-px bg-border" />
                </div>
              ) : (
                dayEvents.map((event) => {
                  const vendorCount = event.event_contacts?.length || 0;
                  const taskCount = event.tasks?.length || 0;
                  const hasFooter = vendorCount > 0 || taskCount > 0;
                  return (
                    <button
                      key={event.id}
                      onClick={() =>
                        event.couple && onSelectCouple(event.couple.id)
                      }
                      className="text-left w-full px-2.5 py-2 rounded-control bg-surface border border-border transition hover:shadow-md cursor-pointer"
                    >
                      <div className="text-caption font-semibold text-text break-words">
                        {formatEventLabel(event)}
                      </div>
                      {event.venue && (
                        <div className="text-caption text-text-muted truncate mt-0.5 flex items-center gap-1">
                          <MapPin size={10} strokeWidth={1.5} />
                          {event.venue}
                        </div>
                      )}
                      {hasFooter && (
                        <div className="text-[10px] text-text-subtle flex items-center gap-2 mt-1">
                          {vendorCount > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Users size={8} strokeWidth={1.5} />
                              {vendorCount}
                            </span>
                          )}
                          {taskCount > 0 && (
                            <span className="flex items-center gap-0.5">
                              <CheckSquare size={8} strokeWidth={1.5} />
                              {taskCount}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Day View ─────────────────────────────────────────── */


function DayView({
  currentDate,
  eventsByDate,
  onSelectCouple,
  statuses,
}: {
  currentDate: Date;
  eventsByDate: Record<string, EventWithCouple[]>;
  onSelectCouple: (coupleId: string) => void;
  statuses: CoupleStatusRecord[];
}) {
  const dateKey = formatDateKey(currentDate);
  const dayEvents = eventsByDate[dateKey] || [];

  return (
    <div className="flex flex-col h-full">
      {dayEvents.length === 0 ? (
        <p className="text-body text-text-subtle py-8">No events on this day.</p>
      ) : (
        <div className="flex flex-col gap-3 py-4">
          {dayEvents.map((event) => {
            const coupleStatusSlug = event.couple?.status || "new";
            const coupleStatus = statuses.find(
              (s) => s.slug === coupleStatusSlug
            );
            const classes = coupleStatus
              ? getStatusClasses(coupleStatus.color)
              : getStatusClasses("gray");
            const statusName =
              coupleStatus?.name ||
              coupleStatusSlug.charAt(0).toUpperCase() +
                coupleStatusSlug.slice(1);
            const vendorCount = event.event_contacts?.[0]?.count || 0;
            const taskCount = event.tasks?.[0]?.count || 0;

            return (
              <div
                key={event.id}
                onClick={() => event.couple && onSelectCouple(event.couple.id)}
                className="bg-surface border border-border rounded-control transition hover:shadow-md cursor-pointer"
              >
                <div className="px-4 py-4">
                  {/* Top row: name + status badge */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-base font-semibold text-text">
                        {formatEventLabel(event)}
                      </h4>
                      {event.venue && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-body text-text-muted">
                          <MapPin
                            size={14}
                            strokeWidth={1.5}
                            className="flex-shrink-0"
                          />
                          {event.venue}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-caption font-medium px-2.5 py-1 rounded-pill flex-shrink-0 capitalize border border-border ${classes.pill}`}
                    >
                      {statusName}
                    </span>
                  </div>

                  {/* Timeline notes */}
                  {event.timeline_notes && (
                    <p className="text-body text-text-muted mt-3 whitespace-pre-line leading-relaxed">
                      {event.timeline_notes}
                    </p>
                  )}

                  {/* Footer: counts - only shown when non-zero */}
                  {(vendorCount > 0 || taskCount > 0) && (
                    <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border text-caption">
                      {vendorCount > 0 && (
                        <span className="flex items-center gap-1.5 text-text-muted">
                          <Users size={14} strokeWidth={1.5} />
                          <span className="font-medium">{vendorCount}</span>
                          <span className="text-text-subtle">
                            contact{vendorCount !== 1 ? "s" : ""}
                          </span>
                        </span>
                      )}
                      {taskCount > 0 && (
                        <span className="flex items-center gap-1.5 text-text-muted">
                          <CheckSquare size={14} strokeWidth={1.5} />
                          <span className="font-medium">{taskCount}</span>
                          <span className="text-text-subtle">
                            task{taskCount !== 1 ? "s" : ""}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
