'use client';

import { useState, type ReactNode } from 'react';

import { Dropdown, INLINE_TRIGGER } from '@/components/ui-v2/dropdown';
import { ChevronDownIcon } from '@/components/ui-v2/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

/**
 * One of a step's settings, as the value side of its row: an inline
 * `Dropdown` (the same pick Email uses for its inbox), so it reads as a
 * choice and not as text. A setting whose picker is not a plain list
 * (the relative time picker, a template list with its own actions) passes
 * `children` and opens that in a popover, under a trigger drawn exactly
 * as `Dropdown inline` draws its own, except that a long value ("20
 * minutes after the email goes out") wraps rather than being cut off.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-choice
 */

export interface StepChoiceProps<T extends string | number> {
  /** Names it for screen readers: "When". */
  label: string;
  value: T;
  /** The choices, in order. */
  options?: readonly T[];
  labelOf: (value: T) => string;
  onChange?: (value: T) => void;
  /** A picker of its own instead of the list; given a way to close. */
  children?: (close: () => void) => ReactNode;
}

// A picker that is not a plain list wears Dropdown's own inline trigger.
const TRIGGER = INLINE_TRIGGER;

/** The setting's value. See {@link StepChoiceProps}. */
export function StepChoice<T extends string | number>({ label, value, options = [], labelOf, onChange, children }: StepChoiceProps<T>) {
  const [open, setOpen] = useState(false);
  if (!children) {
    return (
      <Dropdown
        inline
        label={label}
        options={options.map((o) => ({ value: String(o), label: labelOf(o) }))}
        value={String(value)}
        onChange={(v) => {
          const picked = options.find((o) => String(o) === v);
          if (picked !== undefined) onChange?.(picked);
        }}
      />
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${label}: ${labelOf(value)}. Change`} className={TRIGGER}>
          <span className="min-w-0 text-pretty">{labelOf(value)}</span>
          <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent size="menu" align="end" aria-label={label}>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}
