"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
  CheckSquare,
  Calendar,
  SlidersHorizontal,
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import { Event } from "../events/events-types";
import { CoupleStatusRecord, getStatusClasses } from "./couples-types";
import { useCoupleStatuses } from "./use-couple-statuses";

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

const ACCENT_BORDER_MAP: Record<string, string> = {
  amber: "border-l-amber-400",
  blue: "border-l-blue-400",
  purple: "border-l-purple-400",
  emerald: "border-l-emerald-400",
  gray: "border-l-gray-300",
  green: "border-l-green-400",
  red: "border-l-red-400",
  orange: "border-l-orange-400",
  pink: "border-l-pink-400",
  indigo: "border-l-indigo-400",
};

function ViewDropdown({
  view,
  onChange,
}: {
  view: CalendarView;
  onChange: (view: CalendarView) => void;
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
        className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer"
      >
        <span className="capitalize">{view}</span>
        <ChevronDown size={14} strokeWidth={1.5} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[110px]">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm capitalize transition ${
                view === v
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
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
        className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer"
      >
        <span>{label}</span>
        <ChevronDown size={14} strokeWidth={1.5} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[160px] p-1">
          {statuses.map((status) => {
            const checked =
              activeStatuses === null || activeStatuses.has(status.slug);
            return (
              <button
                key={status.slug}
                onClick={() => onToggle(status.slug)}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-gray-900 hover:bg-gray-50 transition cursor-pointer"
              >
                <div
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                    checked
                      ? "border-gray-900 bg-gray-900"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {checked && (
                    <Check size={10} strokeWidth={2.5} className="text-white" />
                  )}
                </div>
                <span className="text-sm">{status.name}</span>
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

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, user_id, date, couple_id, status, created_at, venue, timeline_notes, couples(id, name, status), event_contacts(count), tasks!tasks_related_event_id_fkey(count)"
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

  const formatDateKey = (date: Date): string => {
    return date.toISOString().split("T")[0];
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
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <div
        className={`
        flex-col gap-5 pb-6 overflow-y-auto
        ${
          sidebarOpen
            ? "fixed top-0 left-0 h-full w-[280px] z-20 bg-white shadow-xl p-5 flex"
            : "hidden md:flex md:w-56 md:flex-shrink-0 border-r border-gray-200 pr-5"
        }
      `}
      >
        {/* Mobile close button */}
        <div className="flex justify-end md:hidden mb-1">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer"
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
              className="p-1 text-gray-500 hover:bg-gray-100 rounded-md transition cursor-pointer"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <span className="text-sm font-medium text-gray-900">
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
              className="p-1 text-gray-500 hover:bg-gray-100 rounded-md transition cursor-pointer"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Mini weekday headers */}
          <div className="grid grid-cols-7 gap-2 pb-2">
            {WEEKDAYS_SHORT.map((day, i) => (
              <div key={i} className="text-center text-xs text-gray-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Mini calendar grid */}
          <div className="grid grid-cols-7 gap-2">
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
                  }}
                  className={`h-7 w-7 mx-auto flex flex-col items-center justify-center text-xs rounded-md transition cursor-pointer relative ${
                    isMiniMonth
                      ? "text-gray-900 hover:bg-gray-100"
                      : "text-gray-300"
                  } ${
                    isCurrentDay
                      ? "bg-gray-900 text-white hover:bg-gray-800"
                      : ""
                  } ${
                    isSelectedDay && !isCurrentDay
                      ? "bg-gray-200 text-gray-800"
                      : ""
                  }`}
                >
                  {date.getDate()}
                  {hasEvents && !isCurrentDay && (
                    <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500"></div>
                  )}
                  {hasEvents && isCurrentDay && (
                    <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day Events Timeline */}
        <div className="flex-1 min-h-0 flex flex-col border-t border-gray-200 pt-4">
          <h3 className="text-xs font-medium text-gray-500 mb-2">
            Events · {WEEKDAYS[currentDate.getDay()]} {currentDate.getDate()}{" "}
            {MONTHS_SHORT[currentDate.getMonth()]}
          </h3>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
            {(eventsByDate[formatDateKey(currentDate)] || []).length === 0 ? (
              <div className="text-xs text-gray-400 py-4">No events</div>
            ) : (
              (eventsByDate[formatDateKey(currentDate)] || []).map((event) => {
                const statusSlug = event.couple?.status || "new";
                const status = statuses.find((s) => s.slug === statusSlug);
                const accentBorder = status
                  ? ACCENT_BORDER_MAP[status.color] || "border-l-gray-300"
                  : "border-l-gray-300";
                return (
                  <button
                    key={event.id}
                    onClick={() =>
                      event.couple && onSelectCouple(event.couple.id)
                    }
                    className={`text-left w-full px-2.5 py-2 rounded-lg bg-white border border-l-2 transition hover:shadow-sm cursor-pointer border-gray-200 ${accentBorder}`}
                  >
                    <div className="text-xs font-semibold truncate text-gray-900">
                      {event.couple?.name || "Unnamed"}
                    </div>
                    {event.venue && (
                      <div className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
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
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden pl-8">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between mb-5 pb-4 border-b border-gray-200">
          {/* Left: Filter toggle (mobile) + Nav */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition cursor-pointer"
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => {
                setCurrentDate(new Date());
                setMiniNavDate(new Date());
              }}
              className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition cursor-pointer border border-gray-200"
            >
              Today
            </button>
            <button
              data-testid="calendar-prev-btn"
              onClick={handlePrev}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition cursor-pointer"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <h2
              data-testid="calendar-header"
              className="text-sm font-semibold text-gray-900 min-w-32 sm:min-w-44 text-center select-none"
            >
              {getHeaderLabel()}
            </h2>
            <button
              data-testid="calendar-next-btn"
              onClick={handleNext}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition cursor-pointer"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Right: Dropdowns */}
          <div className="flex items-center gap-2">
            <StatusDropdown
              statuses={statuses}
              activeStatuses={activeStatuses}
              onToggle={toggleStatus}
            />
            <ViewDropdown view={calendarView} onChange={setCalendarView} />
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
  return date.toISOString().split("T")[0];
}

function isTodayFn(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function EventPill({
  event,
  onSelectCouple,
  statuses,
}: {
  event: EventWithCouple;
  onSelectCouple: (id: string) => void;
  statuses: CoupleStatusRecord[];
}) {
  const statusSlug = event.couple?.status || "new";
  const status = statuses.find((s) => s.slug === statusSlug);
  const accentBorder = status
    ? ACCENT_BORDER_MAP[status.color] || "border-l-gray-300"
    : "border-l-gray-300";
  return (
    <button
      onClick={() => event.couple && onSelectCouple(event.couple.id)}
      className={`text-left w-full px-2.5 py-1.5 rounded-md text-xs font-medium truncate bg-white border border-l-2 transition hover:shadow-sm cursor-pointer border-gray-200 ${accentBorder}`}
    >
      {event.couple?.name || "Unnamed"}
    </button>
  );
}

/* ─── Calendar Skeleton ────────────────────────────────────── */

function CalendarSkeleton({ view }: { view: CalendarView }) {
  if (view === "month") {
    const monthDays = getMonthDays(new Date());
    return (
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-7 flex-shrink-0 border-b border-gray-200">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-gray-500 py-2"
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
                className={`border-b border-r border-gray-100 p-2 flex flex-col gap-0.5 min-h-[100px] ${
                  !isCurrent ? "bg-gray-50/50" : ""
                }`}
              >
                <div
                  className={`text-xs font-medium mb-0.5 ${
                    isCurrent ? "text-gray-900" : "text-gray-300"
                  }`}
                >
                  {date.getDate()}
                </div>
                <div className="h-6 bg-gray-100 rounded animate-pulse" />
                <div className="h-6 bg-gray-100 rounded animate-pulse" />
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
            className="flex flex-col border-r border-gray-100 last:border-r-0 min-h-0"
          >
            <div className="px-2 py-3 text-center border-b border-gray-200 flex-shrink-0">
              <div className="text-xs text-gray-500 font-medium">
                {WEEKDAYS[date.getDay()]}
              </div>
              <div className="text-sm font-semibold mt-0.5 text-gray-900">
                {date.getDate()}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="w-full h-12 bg-gray-100 rounded-lg animate-pulse"
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
          className="relative bg-gray-100 rounded-xl overflow-hidden mb-3 p-5 animate-pulse"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
            <div className="h-6 w-16 bg-gray-200 rounded-full flex-shrink-0" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-full mt-3" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mt-2" />
          <div className="flex items-center gap-5 mt-4 pt-4">
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-20" />
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
  statuses,
}: {
  currentDate: Date;
  eventsByDate: Record<string, EventWithCouple[]>;
  onSelectCouple: (coupleId: string) => void;
  statuses: CoupleStatusRecord[];
}) {
  const monthDays = getMonthDays(currentDate);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 flex-shrink-0 border-b border-gray-200">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            data-testid={`weekday-${day}`}
            className="text-center text-xs font-medium text-gray-500 py-3"
          >
            {day}
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
              className={`border-b border-r border-gray-100 p-2 flex flex-col gap-0.5 min-h-[100px] ${
                !isCurrent ? "bg-gray-50/50" : ""
              }`}
            >
              <div
                className={`text-xs font-medium mb-0.5 ${
                  isCurrent ? "text-gray-900" : "text-gray-300"
                }`}
              >
                <span
                  className={
                    isCurrentDay
                      ? "bg-gray-900 text-white rounded-full w-5 h-5 inline-flex items-center justify-center"
                      : ""
                  }
                >
                  {date.getDate()}
                </span>
              </div>
              {dayEvents.slice(0, 3).map((event) => (
                <EventPill
                  key={event.id}
                  event={event}
                  onSelectCouple={onSelectCouple}
                  statuses={statuses}
                />
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-gray-400 px-1">
                  +{dayEvents.length - 3} more
                </div>
              )}
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
            className="flex flex-col border-r border-gray-100 last:border-r-0 min-h-0"
          >
            {/* Day header */}
            <div className="px-3 h-14 flex flex-col items-center justify-center text-center border-b border-gray-200 flex-shrink-0">
              <div className="text-xs text-gray-500 font-medium">
                {WEEKDAYS[date.getDay()]}
              </div>
              <div className="text-sm font-semibold mt-0.5 text-gray-900">
                <span
                  className={
                    isCurrentDay
                      ? "bg-gray-900 text-white rounded-full w-6 h-6 inline-flex items-center justify-center text-xs"
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
                  <div className="w-4 h-px bg-gray-200" />
                </div>
              ) : (
                dayEvents.map((event) => {
                  const statusSlug = event.couple?.status || "new";
                  const status = statuses.find((s) => s.slug === statusSlug);
                  const accentBorder = status
                    ? ACCENT_BORDER_MAP[status.color] || "border-l-gray-300"
                    : "border-l-gray-300";
                  const vendorCount = event.event_contacts?.length || 0;
                  const taskCount = event.tasks?.length || 0;
                  const hasFooter = vendorCount > 0 || taskCount > 0;
                  return (
                    <button
                      key={event.id}
                      onClick={() =>
                        event.couple && onSelectCouple(event.couple.id)
                      }
                      className={`text-left w-full px-2.5 py-2 rounded-lg bg-white border border-l-2 transition hover:shadow-md cursor-pointer border-gray-200 ${accentBorder}`}
                    >
                      <div className="text-xs font-semibold truncate text-gray-900">
                        {event.couple?.name || "Unnamed"}
                      </div>
                      {event.venue && (
                        <div className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
                          <MapPin size={10} strokeWidth={1.5} />
                          {event.venue}
                        </div>
                      )}
                      {hasFooter && (
                        <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-1">
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

const ACCENT_BAR_COLOR_MAP: Record<string, string> = {
  amber: "bg-amber-400",
  blue: "bg-blue-400",
  purple: "bg-purple-400",
  emerald: "bg-emerald-400",
  gray: "bg-gray-400",
  green: "bg-green-400",
  red: "bg-red-400",
  orange: "bg-orange-400",
  pink: "bg-pink-400",
  indigo: "bg-indigo-400",
};

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
        <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
          <Calendar size={40} strokeWidth={1} />
          <p className="text-sm text-gray-400">No events on this day</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-6">
          {dayEvents.map((event) => {
            const coupleStatusSlug = event.couple?.status || "new";
            const coupleStatus = statuses.find(
              (s) => s.slug === coupleStatusSlug
            );
            const accentColor = coupleStatus
              ? ACCENT_BAR_COLOR_MAP[coupleStatus.color]
              : ACCENT_BAR_COLOR_MAP.gray;
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
                className="relative bg-white border border-gray-200 rounded-xl overflow-hidden transition hover:shadow-md cursor-pointer"
              >
                {/* Left accent bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`}
                />

                <div className="px-4 py-4">
                  {/* Top row: name + status badge */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900">
                        {event.couple?.name || "Unnamed"}
                      </h4>
                      {event.venue && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
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
                      className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 capitalize border border-gray-200 ${classes.pill}`}
                    >
                      {statusName}
                    </span>
                  </div>

                  {/* Timeline notes */}
                  {event.timeline_notes && (
                    <p className="text-sm text-gray-500 mt-3 whitespace-pre-line leading-relaxed">
                      {event.timeline_notes}
                    </p>
                  )}

                  {/* Footer: counts */}
                  <div className="flex items-center gap-5 mt-4 pt-4 border-t border-gray-100 text-xs">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Users size={14} strokeWidth={1.5} />
                      <span className="font-medium">{vendorCount}</span>
                      <span className="text-gray-400">
                        contact{vendorCount !== 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <CheckSquare size={14} strokeWidth={1.5} />
                      <span className="font-medium">{taskCount}</span>
                      <span className="text-gray-400">
                        task{taskCount !== 1 ? "s" : ""}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
