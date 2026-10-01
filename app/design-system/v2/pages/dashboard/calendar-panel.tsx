'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';

import { BookingTypes } from './booking-types';
import { EVENTS, type CalendarEvent } from './demo-activity';
import { MonthGrid, sameDay } from './month-grid';

/**
 * What the Calendar button opens: the month with dots on busy days, the
 * picked day's events, and the MC's booking types. Three bands, one
 * surface, so it reads as a pocket calendar rather than three cards.
 *
 * @module app/design-system/v2/pages/dashboard/calendar-panel
 */

/** Events on `day`, earliest first. Demo events are stored as offsets from today. */
function eventsOn(events: readonly CalendarEvent[], day: Date, today: Date): CalendarEvent[] {
  return events.filter((e) => sameDay(day, new Date(today.getFullYear(), today.getMonth(), today.getDate() + e.day)));
}

/** "Today · Friday 25 September", "Tomorrow · …", or just the date. */
function dayHeading(day: Date, today: Date): string {
  const date = day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (sameDay(day, today)) return `Today · ${date}`;
  if (sameDay(day, tomorrow)) return `Tomorrow · ${date}`;
  return date;
}

/** The calendar popover's content: the demo's events unless given others. */
export function CalendarPanel({ events = EVENTS }: { events?: readonly CalendarEvent[] | undefined }) {
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const shift = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  const goToday = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };
  const picked = eventsOn(events, selected, today);

  return (
    <div>
      <section className="p-5">
        <div className="flex items-center justify-between gap-2 pb-3">
          <h2 className="type-subheading text-zebra-950">{month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</h2>
          <div className="flex items-center">
            <Button variant="ghost" onClick={goToday}>
              Today
            </Button>
            <Button variant="ghost" square aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Button>
            <Button variant="ghost" square aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Button>
          </div>
        </div>
        <MonthGrid
          month={month}
          today={today}
          selected={selected}
          onSelect={(d) => {
            setSelected(d);
            // Picking a faint neighbour day turns the page to its month.
            if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
          }}
          marks={(d) => {
            const on = eventsOn(events, d, today);
            return on.length ? { own: on.some((e) => !e.booked), booked: on.some((e) => e.booked) } : null;
          }}
        />
      </section>

      {/* Tall enough for two events, so picking a quieter day does not
          shrink the popover and make the booking types jump. */}
      <section aria-live="polite" className="min-h-38 border-t border-zebra-950/5 px-5 py-4">
        <div className="flex items-baseline justify-between gap-3 pb-2">
          <h3 className="type-label text-zebra-950">{dayHeading(selected, today)}</h3>
          <span className="type-body text-zebra-400">
            {picked.length === 0 ? 'Nothing on' : `${picked.length} ${picked.length === 1 ? 'event' : 'events'}`}
          </span>
        </div>
        <ul className="space-y-1">
          {picked.map((e) => (
            <li key={e.title} className="flex items-center gap-3 py-1.5">
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-pill ${e.booked ? 'bg-grass-500' : 'bg-zebra-300'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate type-label text-zebra-950">{e.title}</span>
                <span className="block truncate type-body text-zebra-500">{e.detail}</span>
              </span>
              <span className="shrink-0 type-body tabular-nums text-zebra-500">{e.time}</span>
            </li>
          ))}
        </ul>
      </section>

      <BookingTypes />
    </div>
  );
}
