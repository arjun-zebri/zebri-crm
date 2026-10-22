'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { PlusIcon } from '@/components/ui-v2/icons';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { RangeCalendar } from '@/components/ui-v2/range-calendar';
import { TagList } from '@/components/ui-v2/tag-list';

import { daysBetween, dayMonth, isoOf } from '../../payments/dates';
import type { DayOff } from '../booking-data';
import { addDayOff, removeDayOff } from '../use-booking-links';

/**
 * Days off as a `TagList` ("24 – 26 Dec", "12 Jan"), each with its ×,
 * then a "Day off" chip that opens the range calendar New client uses,
 * with past days greyed. Click a day and Add it, or click a second day
 * first to make it a run (a holiday is usually several days). Days
 * already past drop off the list on their own.
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/days-off
 */

/** Days in a run, both ends counted. */
const daysIn = ({ from, to }: DayOff) => daysBetween(from, to) + 1;

/** "12 Jan", "24 – 26 Dec", "30 Dec – 2 Jan". */
export function offLabel({ from, to }: DayOff): string {
  if (from === to) return dayMonth(from);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return `${sameMonth ? Number(from.slice(8)) : dayMonth(from)} – ${dayMonth(to)}`;
}

/** The days off row. */
export function DaysOff({ daysOff }: { daysOff: readonly DayOff[] }) {
  const today = isoOf(new Date());
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DayOff | null>(null);
  const upcoming = daysOff.filter((d) => d.to >= today);
  // First click starts a day; a second makes it a run, in either order.
  const pick = (iso: string) =>
    setPending((p) => (!p || p.from !== p.to ? { from: iso, to: iso } : iso < p.from ? { from: iso, to: p.from } : { from: p.from, to: iso }));
  const onOpenChange = (o: boolean) => (setOpen(o), setPending(null));
  return (
    <TagList
      label="Days off"
      items={upcoming.map(offLabel)}
      onRemove={(label) => {
        const d = upcoming.find((x) => offLabel(x) === label);
        if (d) removeDayOff(d.from);
      }}
      after={
        <PropertyChip icon={PlusIcon} label="Day off" open={open} onOpenChange={onOpenChange}>
          <div className="space-y-3">
            <RangeCalendar from={pending?.from ?? ''} to={pending?.to ?? ''} today={today} min={today} onPick={pick} />
            <div className="flex items-center justify-between gap-3">
              <span className="type-body text-zebra-500">{pending ? (pending.from === pending.to ? 'Or pick an end day' : `${daysIn(pending)} days`) : 'Pick a day'}</span>
              <Button disabled={!pending} onClick={() => pending && (addDayOff(pending), onOpenChange(false))}>
                {pending ? `Add ${offLabel(pending)}` : 'Add'}
              </Button>
            </div>
          </div>
        </PropertyChip>
      }
    />
  );
}
