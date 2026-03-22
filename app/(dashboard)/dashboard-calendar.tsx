"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCalendarEvents } from "./use-dashboard";

interface DashboardCalendarProps {
  onEventClick: (couple: { id: string; name: string }) => void;
}

function getStatusDotColor(status?: string): string {
  switch (status) {
    case "new":
      return "bg-amber-400";
    case "contacted":
      return "bg-blue-400";
    case "confirmed":
      return "bg-purple-400";
    case "paid":
      return "bg-emerald-400";
    case "complete":
      return "bg-gray-400";
    default:
      return "bg-gray-300";
  }
}

export function DashboardCalendar({ onEventClick }: DashboardCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const { data: events, isLoading } = useCalendarEvents(year, month);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  // Build event map: day number -> events
  const eventsByDay = new Map<number, typeof events>();
  for (const event of events || []) {
    const day = new Date(event.date).getDate();
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day)!.push(event);
  }

  const isToday = (day: number) =>
    year === today.getFullYear() &&
    month === today.getMonth() &&
    day === today.getDate();

  // Build cells: no extra empty rows, just what we need
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Calendar</h2>
        {/* Month nav */}
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={prevMonth}
            className="p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
          </button>
          <span className="text-sm font-medium text-gray-900 w-20 text-center">
            {monthLabel}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2
            className="w-5 h-5 text-gray-400 animate-spin"
            strokeWidth={1.5}
          />
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 w-full justify-between">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="h-7 flex items-center justify-between text-xs text-gray-400 font-medium"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 w-full">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={i} className="h-7" />;
              }
              const hasEvents = eventsByDay.has(day);
              const todayHighlight = isToday(day);

              return (
                <div key={i} className="h-7 flex items-center justify-between">
                  <div
                    className={`h-6 w-6 flex items-center justify-center rounded-full text-xs relative ${
                      todayHighlight ? "bg-black text-white" : "text-gray-700"
                    }`}
                  >
                    {day}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All month events */}
          <div className="mt-4 h-58 min-h-0 overflow-y-auto scrollbar-thin pr-1">
            {events && events.length > 0 ? (
              <div className="space-y-2">
                {events.map((event) => {
                  const d = new Date(event.date);
                  const dayNum = d.getDate();
                  const monthShort = d.toLocaleDateString("en-US", {
                    month: "short",
                  });

                  return (
                    <div
                      key={event.id}
                      onClick={() => {
                        if (event.couple) onEventClick(event.couple);
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition cursor-pointer text-sm"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(
                          event.couple?.status
                        )}`}
                      />
                      <span className="text-xs font-medium text-gray-500 shrink-0">
                        {dayNum} {monthShort}
                      </span>
                      <span className="text-gray-900 truncate flex-1">
                        {event.couple?.name || "Unknown"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-xs text-center py-4">
                No events this month
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
