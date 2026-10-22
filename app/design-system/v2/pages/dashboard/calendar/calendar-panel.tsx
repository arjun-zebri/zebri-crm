'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui-v2/icons';

import { BookingTypes } from '../booking-types';
import { MonthGrid, sameDay } from '../month-grid';

import { EVENTS, KIND_DOT, SYNCED, onDay, type CalendarEvent, type CalendarKind } from './calendar-data';
import { DayEvents } from './day-events';
import { useCalendarSync } from './use-calendar-sync';

/**
 * What the Calendar button opens (it is there once the Calendar block
 * is added): the month with a dot for each kind of thing on a day
 * (event days, calls, due dates), and the picked day's items (a click
 * opens the client). Busy times from a Google or Outlook calendar
 * connected in Settings join the month in grey. Booking types sit at
 * the foot once Booking links is added. One surface, no cards, so it reads
 * as a pocket calendar.
 *
 * @module app/design-system/v2/pages/dashboard/calendar/calendar-panel
 */

/** The order a day's dots are drawn in, most important first. */
const DOT_ORDER: CalendarKind[] = ['event', 'meeting', 'due', 'synced'];

/** "Today · Friday 25 September", "Tomorrow · …", or just the date. */
function dayHeading(day: Date, today: Date): string {
  const date = day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (sameDay(day, today)) return `Today · ${date}`;
  if (sameDay(day, tomorrow)) return `Tomorrow · ${date}`;
  return date;
}

export interface CalendarPanelProps {
  /** The demo business's calendar unless given another (a new account passes its own). */
  events?: readonly CalendarEvent[] | undefined;
  /** The Booking links block is added: booking types at the foot. */
  bookingTypes?: boolean | undefined;
  /** Opens a client's profile from one of their items. */
  onOpenClient?: ((id: string) => void) | undefined;
  /** Closes the popover, before the booking types open Settings over the page. */
  onLeave?: (() => void) | undefined;
}

/** The calendar popover's content. See {@link CalendarPanelProps}. */
export function CalendarPanel({ events = EVENTS, bookingTypes = false, onOpenClient, onLeave }: CalendarPanelProps) {
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const sync = useCalendarSync();
  const shift = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  const goToday = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };

  const shown = [...events, ...SYNCED.filter((e) => e.source && sync.connected.has(e.source))];
  const offset = (d: Date) =>
    Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  const picked = onDay(shown, offset(selected));

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
              <ArrowLeftIcon aria-hidden="true" className="size-4" />
            </Button>
            <Button variant="ghost" square aria-label="Next month" onClick={() => shift(1)}>
              <ArrowRightIcon aria-hidden="true" className="size-4" />
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
          dots={(d) => {
            const kinds = new Set(onDay(shown, offset(d)).map((e) => e.kind));
            return DOT_ORDER.filter((k) => kinds.has(k)).map((k) => KIND_DOT[k]);
          }}
        />
      </section>

      <DayEvents heading={dayHeading(selected, today)} items={picked} onOpenClient={onOpenClient} />

      {bookingTypes ? <BookingTypes onLeave={onLeave} /> : null}
    </div>
  );
}
