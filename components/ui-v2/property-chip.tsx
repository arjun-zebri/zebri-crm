'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Popover, PopoverContent, PopoverTrigger, type PopoverSize } from './popover';

/**
 * Design system v2 property chip (preview): one optional detail of a
 * thing being created, as a chip under its name, the way Linear's New
 * issue sets status and due date. Empty, it is a quiet chip naming what
 * it holds ("Event date"); filled, it shows the value in black with the
 * same icon. Clicking opens its picker in a popover (a calendar, a short
 * field), so a quick-create dialog asks for nothing beyond the name until
 * the MC wants to give it.
 *
 * The caller owns `open`, so a picker can close itself once a value is
 * chosen (a calendar day picked). Portals into an enclosing dialog, as
 * every v2 popover does.
 *
 * @example
 * ```tsx
 * <PropertyChip icon={CalendarDays} label="Event date" value={date ? formatDate(date) : undefined} open={open} onOpenChange={setOpen}>
 *   <RangeCalendar from={date} to={date} onPick={(d) => (setDate(d), setOpen(false))} />
 * </PropertyChip>
 * ```
 *
 * @module components/ui-v2/property-chip
 */

export interface PropertyChipProps {
  icon: LucideIcon;
  /** What it holds, shown while empty and read out always: "Event date". */
  label: string;
  /** The value as shown, or undefined while empty. */
  value?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The picker. */
  children: ReactNode;
  /** The popover's size; `card` (a calendar, a field) by default. */
  size?: PopoverSize | undefined;
}

/** v2 property chip. See {@link PropertyChipProps}. */
export function PropertyChip({ icon: Icon, label, value, open, onOpenChange, children, size = 'card' }: PropertyChipProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={value ? `${label}: ${value}. Change` : label}
          className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-button px-2.5 type-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
            value ? 'bg-zebra-950/5 text-zebra-950 hover:bg-zebra-950/10' : 'text-zebra-500 hover:bg-zebra-950/5 hover:text-zebra-950'
          }`}
        >
          <Icon aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-zebra-400" />
          <span className="truncate">{value ?? label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent size={size} align="start" aria-label={label}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
