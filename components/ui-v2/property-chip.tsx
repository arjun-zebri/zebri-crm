'use client';

import type { ReactNode } from 'react';

import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

import { DISABLED } from './control-styles';
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
 * A chip inside content: 32px, `rounded-button`, `type-body`, as
 * ChipGroup and TagList are. A set value rests on the `hover` tint and
 * steps to `pressed` on hover or while its picker is open.
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
  /** Leading icon; left out for a chip whose words say enough ("DJ"). */
  icon?: ZebriIcon | undefined;
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
  /**
   * A set value reads as plain text, tinted only on hover: for chips
   * repeated down a list (who runs each moment of a run sheet), where a
   * tint on every row would stack into a column of grey boxes.
   */
  quiet?: boolean | undefined;
  /**
   * Colours a set value that needs attention: `danger` (missing, red) or
   * `warning` (waiting, amber), as a client's details do on their Overview.
   */
  tone?: 'danger' | 'warning' | undefined;
  /** Greys the chip out; it cannot be opened. */
  disabled?: boolean | undefined;
}

// Amber text needs the darker ink to read on white.
const TONES = { danger: 'text-danger', warning: 'text-warning-ink' } as const;

/** v2 property chip. See {@link PropertyChipProps}. */
export function PropertyChip({ icon: Icon, label, value, open, onOpenChange, children, size = 'card', quiet = false, tone, disabled = false }: PropertyChipProps) {
  // One text colour only: two on one element resolve by CSS order, not class order.
  const ink = tone ? TONES[tone] : 'text-zebra-950';
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={value ? `${label}: ${value}. Change` : label}
          className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-button px-2.5 type-body transition-colors duration-150 focus-mark ${DISABLED} motion-reduce:transition-none ${
            !value
              ? 'text-zebra-500 hover:bg-hover hover:text-zebra-950 data-[state=open]:bg-pressed'
              : quiet
                ? `${ink} hover:bg-hover data-[state=open]:bg-pressed`
                : `bg-hover ${ink} hover:bg-pressed data-[state=open]:bg-pressed`
          }`}
        >
          {Icon ? <Icon aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-zebra-400" /> : null}
          <span className="truncate">{value ?? label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent size={size} align="start" aria-label={label}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
