/**
 * CalendarHeader: Main navigation and controls.
 * Includes today button, prev/next buttons, date label, view switcher, and status filter.
 */

import {
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { MenuItem, MenuPanel } from "@/components/ui/menu";
import { isChromePress } from '@/components/ui/use-overlay';
import { zonedDateParts } from "@/lib/scheduling/timezone";
import type { CoupleStatusRecord } from "@/types/couple";

import { CalendarStatusFilter } from "./calendar-status-filter";

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

interface ViewDropdownProps {
  view: CalendarView;
  onChange: (view: CalendarView) => void;
  options?: CalendarView[];
}

/**
 * Dropdown to select calendar view (day, week, month).
 * On mobile, excludes week view option.
 */
function ViewDropdown({
  view,
  onChange,
  options = ["day", "week", "month"] as CalendarView[],
}: ViewDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) && !isChromePress(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={() => setOpen(!open)} className="whitespace-nowrap">
        <span className="capitalize">{view}</span>
        <ChevronDown size={11} strokeWidth={1.5} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1">
          <MenuPanel>
            {options.map((v) => (
              <MenuItem
                key={v}
                size="sm"
                selected={view === v}
                className="capitalize"
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
              >
                {v}
              </MenuItem>
            ))}
          </MenuPanel>
        </div>
      )}
    </div>
  );
}

interface CalendarHeaderProps {
  currentDate: Date;
  calendarView: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  isMobile: boolean;
  onSidebarOpen: () => void;
  timezone?: string;
  /** The MC's couple statuses, for the Statuses filter. */
  statuses: CoupleStatusRecord[];
  /** Ticked status slugs, or `null` when no filter is applied. */
  activeStatuses: Set<string> | null;
  /** Toggle one status slug in the filter. */
  onToggleStatus: (slug: string) => void;
}

/**
 * Header with navigation and view controls.
 * Desktop: today, prev/next, the date label, the Statuses filter and the view
 * switcher. Mobile: adds a hamburger button for the sidebar.
 *
 * There are no per-layer visibility toggles. Bookings, weddings and external
 * busy time are all things the MC has committed to, so hiding one is a way to
 * miss it; the three switches only offered new ways to be surprised. The
 * Statuses filter is a different thing: it narrows the wedding pipeline layer
 * to the stages the MC is working, and never hides a booking or a busy block.
 */
export function CalendarHeader({
  currentDate,
  calendarView,
  onViewChange,
  onToday,
  onPrev,
  onNext,
  isMobile,
  onSidebarOpen,
  timezone = 'UTC',
  statuses,
  activeStatuses,
  onToggleStatus,
}: CalendarHeaderProps) {
  const getHeaderLabel = (): string => {
    const tz = timezone || 'UTC';

    if (calendarView === "month") {
      const { date: localDate } = zonedDateParts(currentDate, tz);
      const [yearStr, monthStr] = localDate.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr) - 1;
      return `${MONTHS[month]} ${year}`;
    }

    if (calendarView === "week") {
      // Compute week start in local timezone using zonedDateParts
      const { date: localDate, weekday: localWeekday } = zonedDateParts(currentDate, tz);
      const [yearStr, monthStr, dayStr] = localDate.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);

      // Compute Sunday by subtracting weekday days
      const daysToSunday = localWeekday;
      let sundayDay = day - daysToSunday;
      let sundayMonth = month;
      let sundayYear = year;

      if (sundayDay < 1) {
        sundayMonth--;
        if (sundayMonth < 1) {
          sundayMonth = 12;
          sundayYear--;
        }
        const daysInPrevMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (sundayMonth === 2 && ((sundayYear % 4 === 0 && sundayYear % 100 !== 0) || sundayYear % 400 === 0)) {
          sundayDay += 29;
        } else {
          sundayDay += daysInPrevMonth[sundayMonth - 1]!;
        }
      }

      // Saturday is 6 days after Sunday
      let saturdayDay = sundayDay + 6;
      let saturdayMonth = sundayMonth;
      let saturdayYear = sundayYear;
      const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (saturdayMonth === 2 && ((saturdayYear % 4 === 0 && saturdayYear % 100 !== 0) || saturdayYear % 400 === 0)) {
        if (saturdayDay > 29) {
          saturdayDay -= 29;
          saturdayMonth++;
          if (saturdayMonth > 12) {
            saturdayMonth = 1;
            saturdayYear++;
          }
        }
      } else {
        if (saturdayDay > daysInMonth[saturdayMonth - 1]!) {
          saturdayDay -= daysInMonth[saturdayMonth - 1]!;
          saturdayMonth++;
          if (saturdayMonth > 12) {
            saturdayMonth = 1;
            saturdayYear++;
          }
        }
      }

      if (sundayMonth === saturdayMonth) {
        return `${MONTHS[sundayMonth - 1]} ${sundayDay}–${saturdayDay}, ${sundayYear}`;
      }
      return `${MONTHS_SHORT[sundayMonth - 1]} ${sundayDay} – ${MONTHS_SHORT[saturdayMonth - 1]} ${saturdayDay}, ${sundayYear}`;
    }

    const { date: localDate, weekday: weekdayNum } = zonedDateParts(currentDate, tz);
    const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const [, monthStr, dayStr] = localDate.split('-');
    const month = Number(monthStr) - 1;
    const day = Number(dayStr);
    return `${WEEKDAYS[weekdayNum]}, ${MONTHS[month]} ${day}`;
  };

  return (
    <div className="flex-shrink-0 flex items-center justify-between mb-5 pb-4 border-b border-border">
      {/* Left: Filter toggle (mobile) + Nav */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          iconOnly
          onClick={onSidebarOpen}
          className="md:hidden"
          aria-label="Filters"
        >
          <SlidersHorizontal size={14} strokeWidth={1.5} />
        </Button>
        <Button variant="outline" onClick={onToday} className="whitespace-nowrap">
          Today
        </Button>
        <Button
          variant="ghost"
          iconOnly
          data-testid="calendar-prev-btn"
          onClick={onPrev}
          aria-label="Previous"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
        </Button>
        <h2
          data-testid="calendar-header"
          className="text-body font-semibold text-text min-w-0 sm:min-w-32 md:min-w-44 text-center select-none truncate max-w-[180px] sm:max-w-none"
        >
          {getHeaderLabel()}
        </h2>
        <Button
          variant="ghost"
          iconOnly
          data-testid="calendar-next-btn"
          onClick={onNext}
          aria-label="Next"
        >
          <ChevronRight size={14} strokeWidth={1.5} />
        </Button>
      </div>

      {/* Right: Status filter + View dropdown */}
      <div className="flex items-center gap-2">
        <CalendarStatusFilter
          statuses={statuses}
          activeStatuses={activeStatuses}
          onToggle={onToggleStatus}
        />
        <ViewDropdown
          view={calendarView}
          onChange={onViewChange}
          options={isMobile ? ["day", "month"] : ["day", "week", "month"]}
        />
      </div>
    </div>
  );
}
