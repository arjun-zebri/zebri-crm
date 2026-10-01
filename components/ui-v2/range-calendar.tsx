'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';

/**
 * Design system v2 range calendar (preview): one month, Monday first,
 * for picking a run of days. The two ends are filled grass circles and
 * the days between sit on a soft grass band, so the range reads as one
 * shape; today is in label weight. Arrows step a month either way. The
 * calendar only reports clicks (`onPick`); which end a click sets is the
 * caller's call (see `DateRangePicker`). Dates are local "YYYY-MM-DD"
 * strings. Compact on purpose: 32px days, so it sits in a popover.
 *
 * @example
 * ```tsx
 * <RangeCalendar from="2026-07-01" to="2026-07-14" onPick={pick} />
 * ```
 *
 * @module components/ui-v2/range-calendar
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Whole weeks covering `month` (any date in it), Monday first. */
function cells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - lead + i));
}

export interface RangeCalendarProps {
  /** Start of the range, "YYYY-MM-DD" or "". */
  from: string;
  /** End of the range, "YYYY-MM-DD" or "". */
  to: string;
  onPick: (iso: string) => void;
  /** Today, "YYYY-MM-DD"; the real date when left out. */
  today?: string | undefined;
  /** The month to open on, "YYYY-MM"; the start's month when left out. */
  initialMonth?: string | undefined;
  /** The earliest day that can be picked, "YYYY-MM-DD"; days before it are greyed and inert (an event date cannot be in the past). */
  min?: string | undefined;
}

/** v2 range calendar. See {@link RangeCalendarProps}. */
export function RangeCalendar({ from, to, onPick, today = isoOf(new Date()), initialMonth, min }: RangeCalendarProps) {
  const [month, setMonth] = useState(() => new Date(`${initialMonth ?? (from || today).slice(0, 7)}-01T00:00`));
  const step = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const title = month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Button variant="ghost" square aria-label="Previous month" onClick={() => step(-1)}>
          <ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
        <p aria-live="polite" className="type-label text-zebra-950">
          {title}
        </p>
        <Button variant="ghost" square aria-label="Next month" onClick={() => step(1)}>
          <ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </div>
      <div role="grid" aria-label={title} className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAYS.map((d) => (
          <span key={d} role="columnheader" className="pb-0.5 text-center type-body text-zebra-400">
            {d}
          </span>
        ))}
        {cells(month).map((day) => {
          const iso = isoOf(day);
          const inMonth = day.getMonth() === month.getMonth();
          const end = iso === from || iso === to;
          const between = Boolean(from && to) && iso > from && iso < to;
          const early = Boolean(min) && iso < min!;
          // The band runs behind the days; the ends get half a band on their inner side.
          const band = between
            ? 'bg-grass-100'
            : end && from && to && from !== to
              ? iso === from
                ? 'bg-[linear-gradient(to_right,transparent_50%,var(--color-grass-100)_50%)]'
                : 'bg-[linear-gradient(to_left,transparent_50%,var(--color-grass-100)_50%)]'
              : '';
          return (
            <div key={iso} className={`flex justify-center ${band}`}>
              <button
                type="button"
                role="gridcell"
                aria-selected={end || between}
                aria-current={iso === today ? 'date' : undefined}
                aria-label={day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                disabled={early}
                onClick={() => onPick(iso)}
                className={`flex size-8 items-center justify-center rounded-pill type-body tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
                  end
                    ? 'bg-grass-800 text-zebra-50'
                    : early
                      ? 'text-zebra-300'
                      : `hover:bg-zebra-950/[0.06] ${inMonth ? 'text-zebra-950' : 'text-zebra-300'}`
                } ${iso === today ? 'font-semibold' : ''}`}
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
