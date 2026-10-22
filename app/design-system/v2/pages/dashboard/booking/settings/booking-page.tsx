'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ArrowLeftIcon, ArrowRightIcon, CallIcon, ClockIcon, GlobeIcon, VenueIcon, VideoIcon } from '@/components/ui-v2/icons';

import { useAccount } from '../../account';
import { monthCells, sameDay } from '../../month-grid';
import { WHERE_LABEL, spacedTime, spanLabel, type BookingLink } from '../booking-data';
import { firstOpenDay, slotsOn, type Availability } from '../booking-slots';
import { useBookingLinks } from '../use-booking-links';

/**
 * The two halves of the booking page a couple sees, in the shape they
 * know from Calendly: {@link BookingHeader} (who, what, how long,
 * where, the description) and {@link BookingPicker} (a month with the
 * bookable days in a soft circle of the MC's brand colour, the picked
 * day's times beside it). Both read the brand from `--b-*` custom
 * properties set by the caller (`brandVars`). Split out so Settings'
 * live preview and the Booking links block image show the same page.
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/booking-page
 */

const WHERE_ICON = { video: VideoIcon, phone: CallIcon, 'in-person': VenueIcon } as const;
const WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');

/** Who the booking is with and what it is. */
export function BookingHeader({ link }: { link: BookingLink }) {
  const { business, mc } = useAccount();
  const Where = WHERE_ICON[link.where];
  const name = link.name.trim();
  return (
    <header className="space-y-3 border-b border-hairline px-7 py-6">
      <div className="space-y-0.5">
        <p className="type-body text-zebra-500">{mc?.name ?? business}</p>
        <p className={`type-subheading ${name ? 'text-zebra-950' : 'type-body text-zebra-300'}`}>{name || 'Booking type'}</p>
      </div>
      <div className="space-y-1.5 type-body text-zebra-600">
        <p className="flex items-center gap-2">
          <ClockIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
          {spanLabel(link.length)}
        </p>
        <p className="flex min-w-0 items-center gap-2">
          <Where aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
          <span className="truncate">
            {link.where === 'in-person' && link.address.trim() ? link.address.trim() : link.where === 'video' ? 'Video call link sent when you book' : WHERE_LABEL[link.where]}
          </span>
        </p>
      </div>
      {link.description.trim() ? <p className="text-pretty type-body text-zebra-600">{link.description.trim()}</p> : null}
    </header>
  );
}

export interface BookingPickerProps {
  link: BookingLink;
  /** The moment the page is seen at; now when left out. A fixed one keeps a still image still. */
  now?: Date | undefined;
}

/**
 * The month and the picked day's times. Picking a time splits it into
 * the time and Next, as the real page does. Days and times come from
 * the MC's real hours and days off (`booking-slots.ts`).
 */
export function BookingPicker({ link, now: at }: BookingPickerProps) {
  const { hours, daysOff } = useBookingLinks();
  const a: Availability = { hours, daysOff };
  const [now] = useState(() => at ?? new Date());
  const [chosen, setChosen] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const first = firstOpenDay(link, a, now);
  // A change that closes the chosen day falls back to the first one open.
  const picked = chosen && slotsOn(link, a, chosen, now).length ? chosen : first;
  const [month, setMonth] = useState(() => new Date((first ?? now).getFullYear(), (first ?? now).getMonth(), 1));
  const times = picked ? slotsOn(link, a, picked, now) : [];
  const shift = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));

  return (
    <div className="px-7 py-6">
      <p className="pb-5 type-label text-zebra-950">Select a date and time</p>
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-7">
        <div>
          <div className="flex items-center justify-between pb-2">
            <p className="type-body text-zebra-950">{month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</p>
            <span className="flex">
              <Button variant="ghost" square aria-label="Previous month" onClick={() => shift(-1)}>
                <ArrowLeftIcon aria-hidden="true" className="size-4" />
              </Button>
              <Button variant="ghost" square aria-label="Next month" onClick={() => shift(1)}>
                <ArrowRightIcon aria-hidden="true" className="size-4" />
              </Button>
            </span>
          </div>
          <div className="grid grid-cols-7 gap-y-2 text-center">
            {WEEK.map((d) => (
              <span key={d} className="pb-1 type-body text-zebra-400">
                {d[0]}
              </span>
            ))}
            {monthCells(month).map((d) => {
              const inMonth = d.getMonth() === month.getMonth();
              const open = inMonth && slotsOn(link, a, d, now).length > 0;
              const on = !!picked && open && sameDay(d, picked);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={!open}
                  onClick={() => (setChosen(d), setTime(null))}
                  aria-label={d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                  className={`relative mx-auto flex size-7 items-center justify-center rounded-pill tabular-nums transition-colors duration-150 focus-mark motion-reduce:transition-none ${
                    !inMonth
                      ? 'invisible type-body'
                      : on
                        ? 'bg-[var(--b-primary)] type-label text-[var(--b-on-primary)]'
                        : open
                          ? 'bg-[var(--b-soft)] type-label text-[var(--b-primary)] hover:bg-[var(--b-primary)]/20'
                          : 'type-body text-zebra-300'
                  }`}
                >
                  {d.getDate()}
                  {/* Today, marked as Calendly does: a dot under the date. */}
                  {sameDay(d, now) ? <span aria-hidden="true" className="absolute bottom-0.5 size-1 rounded-pill bg-current" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          {picked ? (
            <>
              <p className="truncate pb-2 pt-1.5 type-body text-zebra-950">{picked.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
              {/* Padded inside the scroll, so the first and last times keep their whole outline. */}
              <div className="-m-1 max-h-[17rem] space-y-2 overflow-y-auto p-1">
                {times.map((t) =>
                  time === t ? (
                    // The picked time splits into itself and Next, as the real page does.
                    <div key={t} className="grid h-10 grid-cols-2 gap-1.5">
                      <span className="flex items-center justify-center rounded-button bg-zebra-700 type-body tabular-nums text-zebra-50">{spacedTime(t)}</span>
                      <span className="flex items-center justify-center rounded-button bg-[var(--b-primary)] type-label text-[var(--b-on-primary)]">Next</span>
                    </div>
                  ) : (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTime(t)}
                      className="flex h-10 w-full items-center justify-center rounded-button ring-1 ring-[var(--b-primary)]/40 type-label tabular-nums text-[var(--b-primary)] transition-shadow duration-150 hover:ring-2 hover:ring-[var(--b-primary)] focus-mark motion-reduce:transition-none"
                    >
                      {spacedTime(t)}
                    </button>
                  ),
                )}
              </div>
            </>
          ) : (
            <p className="pt-1.5 type-body text-zebra-500">No times free yet. Widen your hours or how far ahead couples can book.</p>
          )}
        </div>
      </div>
      <p className="flex items-center gap-2 pt-5 type-body text-zebra-500">
        <GlobeIcon aria-hidden="true" className="size-4 text-zebra-400" />
        {ZONE} time
      </p>
    </div>
  );
}
