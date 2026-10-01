/**
 * A month of days, Monday first, for the calendar popover. Days outside
 * the month are faint; today is a filled circle, the picked day a ring;
 * up to two dots under a day show what is on it (grey for the MC's own
 * events, grass for bookings and events).
 *
 * @module app/design-system/v2/pages/dashboard/month-grid
 */

/** Grey and/or green dots for one day. */
export interface DayMarks {
  own: boolean;
  booked: boolean;
}

export interface MonthGridProps {
  /** Any date in the month to show. */
  month: Date;
  today: Date;
  selected: Date;
  onSelect: (day: Date) => void;
  /** Dots for a day, or null for none. */
  marks: (day: Date) => DayMarks | null;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Same calendar day, ignoring time. */
export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Every cell for `month`: whole weeks, Monday first, padded with neighbours. */
export function monthCells(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const count = Math.ceil((lead + days) / 7) * 7;
  return Array.from({ length: count }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - lead + i));
}

/** The month grid. See {@link MonthGridProps}. */
export function MonthGrid({ month, today, selected, onSelect, marks }: MonthGridProps) {
  return (
    <div role="grid" aria-label={month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })} className="grid grid-cols-7 gap-y-1">
      {WEEKDAYS.map((d) => (
        <span key={d} role="columnheader" className="pb-1 text-center type-body text-zebra-400">
          {d}
        </span>
      ))}
      {monthCells(month).map((day) => {
        const inMonth = day.getMonth() === month.getMonth();
        const isToday = sameDay(day, today);
        const isPicked = sameDay(day, selected);
        const m = marks(day);
        return (
          <button
            key={day.toISOString()}
            type="button"
            role="gridcell"
            aria-selected={isPicked}
            aria-current={isToday ? 'date' : undefined}
            aria-label={day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            onClick={() => onSelect(day)}
            className="group flex h-11 flex-col items-center gap-1 rounded-button pt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500"
          >
            <span
              className={`flex size-8 items-center justify-center rounded-pill type-body tabular-nums transition-colors duration-150 motion-reduce:transition-none ${
                isToday
                  ? 'bg-zebra-950 font-medium text-zebra-50'
                  : isPicked
                    ? 'ring-1 ring-zebra-950 text-zebra-950'
                    : `group-hover:bg-zebra-100 ${inMonth ? 'text-zebra-950' : 'text-zebra-300'}`
              }`}
            >
              {day.getDate()}
            </span>
            <span aria-hidden="true" className="flex h-1 gap-0.5">
              {m?.own ? <span className="size-1 rounded-pill bg-zebra-300" /> : null}
              {m?.booked ? <span className="size-1 rounded-pill bg-grass-500" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
