'use client';

import { useState } from 'react';

import { ClockIcon } from '@/components/ui-v2/icons';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { TimeField, parseTime } from '@/components/ui-v2/time-field';

import { spacedTime } from '../booking-data';

/**
 * A span of hours as a chip, "9:00 am – 5:00 pm", that opens a from and a
 * to time on one line, typed or picked as on a run sheet. An emptied
 * time keeps the last good one: a day needs both ends.
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/hours-chip
 */

export interface HoursChipProps {
  /** Names the chip: "Hours", "Monday's hours". */
  label: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** Plain text until hovered, for a chip repeated down the per-day list. */
  quiet?: boolean | undefined;
}

/** The hours chip. See {@link HoursChipProps}. */
export function HoursChip({ label, from, to, onChange, quiet = false }: HoursChipProps) {
  const [open, setOpen] = useState(false);
  return (
    <PropertyChip icon={quiet ? undefined : ClockIcon} label={label} value={`${spacedTime(from)} – ${spacedTime(to)}`} open={open} onOpenChange={setOpen} size="menu" quiet={quiet}>
      <div className="flex h-8 items-center gap-2 px-2">
        <ClockIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
        <TimeField aria-label="From" value={from} onChange={(v) => onChange(v || from, to)} className="w-20 type-body" />
        <span className="type-body text-zebra-400">to</span>
        <TimeField aria-label="To" value={to} after={parseTime(from) ?? undefined} onChange={(v) => onChange(from, v || to)} className="w-20 type-body" />
      </div>
    </PropertyChip>
  );
}
