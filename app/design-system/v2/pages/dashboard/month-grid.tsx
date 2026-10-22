/**
 * A month of days, Monday first, for the calendar popover. Days outside
 * the month are faint; the picked day is the `selected` fill (white
 * figure on grass-800) and today is its figure in `selected` green at
 * the label weight, with no fill (picked wins when it is also today).
 * Recorded 2026-10-14: the spec's zebra-950 fill for today and a ring for
 * the picked day read as two kinds of "selected"; the user prefers what
 * reads clearly, so only the picked day is filled, in the one selected
 * token, and today is marked by its colour alone.
 * up to three dots under a day show what kinds of thing are on it (the
 * caller picks their colours).
 *
 * @module app/design-system/v2/pages/dashboard/month-grid
 */

export interface MonthGridProps {
  /** Any date in the month to show. */
  month: Date;
  today: Date;
  selected: Date;
  onSelect: (day: Date) => void;
  /** One background class per dot under a day, at most three; empty for none. */
  dots: (day: Date) => readonly string[];
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
export function MonthGrid({ month, today, selected, onSelect, dots }: MonthGridProps) {
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
        return (
          <button
            key={day.toISOString()}
            type="button"
            role="gridcell"
            aria-selected={isPicked}
            aria-current={isToday ? 'date' : undefined}
            aria-label={day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            onClick={() => onSelect(day)}
            className="group flex h-11 flex-col items-center gap-1 rounded-button pt-0.5 focus-mark"
          >
            <span
              className={`flex size-8 items-center justify-center rounded-pill transition-colors duration-150 motion-reduce:transition-none ${
                isPicked
                  ? 'bg-selected type-label text-field'
                  : isToday
                    ? 'type-label text-selected group-hover:bg-hover'
                    : `type-body group-hover:bg-hover ${inMonth ? 'text-zebra-950' : 'text-zebra-300'}`
              }`}
            >
              {day.getDate()}
            </span>
            <span aria-hidden="true" className="flex h-1 gap-0.5">
              {dots(day).slice(0, 3).map((bg) => (
                <span key={bg} className={`size-1 rounded-pill ${bg}`} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
