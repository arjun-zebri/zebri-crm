/**
 * CalendarSkeleton: Loading placeholder for calendar views.
 *
 * Renders a placeholder shaped like the month, week or day view that is
 * coming, so the layout does not jump when the data lands. Built from the
 * `Skeleton` primitive rather than hand-rolled pulse divs, which is what it
 * used to be.
 *
 * @module app/(dashboard)/calendar/_components/calendar-skeleton
 */

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

import { getMonthDays, getWeekDays } from "./calendar-utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarSkeletonProps {
  view: "month" | "week" | "day";
}

/**
 * Loading skeleton UI that matches the shape of the selected calendar view.
 * Animates pulse effect while data loads.
 */
export function CalendarSkeleton({ view }: CalendarSkeletonProps) {
  if (view === "month") {
    const monthDays = getMonthDays(new Date());
    return (
      <SkeletonRegion label="Loading calendar" className="flex flex-col h-full">
        <div className="grid grid-cols-7 flex-shrink-0 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-body font-medium text-text-muted py-2"
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
                  className={`text-body font-medium mb-0.5 ${
                    isCurrent ? "text-text" : "text-text-subtle"
                  }`}
                >
                  {date.getDate()}
                </div>
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
              </div>
            );
          })}
        </div>
      </SkeletonRegion>
    );
  }

  if (view === "week") {
    const weekDays = getWeekDays(new Date());
    return (
      <SkeletonRegion label="Loading calendar" className="grid grid-cols-7 h-full">
        {weekDays.map((date, idx) => (
          <div
            key={idx}
            className="flex flex-col border-r border-border last:border-r-0 min-h-0"
          >
            <div className="px-2 py-3 text-center border-b border-border flex-shrink-0">
              <div className="text-body text-text-muted font-medium">
                {WEEKDAYS[date.getDay()]}
              </div>
              <div className="text-body font-semibold mt-0.5 text-text">
                {date.getDate()}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="w-full h-12" />
              ))}
            </div>
          </div>
        ))}
      </SkeletonRegion>
    );
  }

  // Day view
  return (
    <SkeletonRegion label="Loading calendar" className="flex flex-col h-full p-6">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-control border border-border overflow-hidden mb-3 p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton shape="pill" className="h-6 w-16 shrink-0" />
          </div>
          <div className="space-y-2 mt-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex items-center gap-5 mt-4 pt-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
