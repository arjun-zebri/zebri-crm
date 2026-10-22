'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui-v2/icons';

import { DISABLED } from './control-styles';
import { Dropdown } from './dropdown';

/**
 * Design system v2 date panel (preview): the calendar inside a
 * `CalendarField`'s popover. One month, Monday first; its header is the
 * month and the year as two quiet menus between the arrows, the way
 * Google's and Airbnb's calendars do it (user, 2026-10-15: a grid of
 * years to drill through read as cheap), so a year forty back is one
 * pick from a list that opens on the year in view. `max` greys out days
 * after it (a birthday cannot be tomorrow) and caps the year list. Dates
 * are local "YYYY-MM-DD" strings.
 *
 * @module components/ui-v2/date-panel
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Whole weeks covering a month, Monday first. */
function cells(y: number, m: number) {
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => new Date(y, m, 1 - lead + i));
}

export interface DatePanelProps {
  value: string;
  onPick: (iso: string) => void;
  /** The year to open on when there is no value. */
  openYear?: number | undefined;
  /** The latest pickable day, "YYYY-MM-DD". */
  max?: string | undefined;
  /** The earliest year in the year menu. */
  minYear?: number | undefined;
}

/** v2 date panel. See {@link DatePanelProps}. */
export function DatePanel({ value, onPick, openYear, max, minYear = 1900 }: DatePanelProps) {
  const today = new Date();
  const base = value ? new Date(`${value}T00:00`) : new Date(openYear ?? today.getFullYear(), openYear ? 0 : today.getMonth(), 1);
  const [year, setYear] = useState(base.getFullYear());
  const [month, setMonth] = useState(base.getMonth());
  const lastYear = max ? Number(max.slice(0, 4)) : today.getFullYear() + 10;
  const years = Array.from({ length: lastYear - minYear + 1 }, (_, i) => String(lastYear - i));
  const step = (n: number) => {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const title = `${MONTHS[month]} ${year}`;
  const past = Boolean(max) && `${year}-${pad(month + 1)}` >= max!.slice(0, 7);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-1">
        <Button variant="ghost" square aria-label="Previous month" onClick={() => step(-1)}>
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
        </Button>
        <div className="flex items-center">
          <Dropdown inline label="Month" value={String(month)} onChange={(m) => setMonth(Number(m))} options={MONTHS.map((name, i) => ({ value: String(i), label: name }))} />
          <Dropdown inline label="Year" value={String(year)} onChange={(y) => setYear(Number(y))} options={years.map((y) => ({ value: y, label: y }))} />
        </div>
        <Button variant="ghost" square aria-label="Next month" disabled={past} onClick={() => step(1)}>
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <div role="grid" aria-label={title} className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAYS.map((d) => (
          <span key={d} role="columnheader" className="pb-1 text-center type-body text-zebra-400">
            {d}
          </span>
        ))}
        {cells(year, month).map((day) => {
          const iso = isoOf(day);
          const picked = iso === value;
          const isToday = iso === isoOf(today);
          return (
            <div key={iso} className="flex justify-center">
              <button
                type="button"
                role="gridcell"
                aria-selected={picked}
                aria-current={isToday ? 'date' : undefined}
                aria-label={day.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                disabled={Boolean(max) && iso > max!}
                onClick={() => onPick(iso)}
                // Today in label weight, as RangeCalendar marks it.
                className={`flex size-9 items-center justify-center rounded-pill ${isToday ? 'type-label' : 'type-body'} transition-colors duration-150 focus-mark ${DISABLED} motion-reduce:transition-none ${
                  picked ? 'bg-selected text-zebra-50' : `hover:bg-hover ${day.getMonth() === month ? 'text-zebra-950' : 'text-zebra-300'}`
                }`}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
