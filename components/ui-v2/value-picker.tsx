'use client';

import { useState } from 'react';

import { ChevronDownIcon } from './icons';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { ValueMenu, type ValueMenuProps } from './value-menu';

/**
 * Design system v2 value picker: a setting's value on a small white
 * button ("7 days ⌄") that opens a `ValueMenu`, the common choices under a
 * line to type any other (user ruling, 2026-10-15). The default for every
 * setting that has usual values and takes a custom one: a deposit
 * percent, a due date's lead time, a reminder's timing.
 *
 * The button is always visible, so the value reads as changeable at rest;
 * a tinted number with a tiny unit menu beside it did not (user,
 * 2026-10-14: "highlighting a tiny day like that").
 *
 * @example
 * ```tsx
 * <ValuePicker label="Deposit" value={{ n: 25, unit: '%' }} presets={DEPOSITS}
 *   show={amountLabel} read={(t) => readAmount(t, ['%'], { '%': 100 })} onPick={setDeposit} />
 * ```
 *
 * @module components/ui-v2/value-picker
 */

/** The button: white, hairline-bordered, the soft button shadow, a chevron after the value. */
export const VALUE_TRIGGER =
  'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-button border border-zebra-200 bg-field px-2.5 type-body text-zebra-950 shadow-btn-soft ' +
  'transition-colors duration-150 hover:border-zebra-300 data-[state=open]:border-zebra-300 focus-mark motion-reduce:transition-none';

/** The picker. See the module docs and {@link ValueMenuProps}. */
export function ValuePicker<T>(props: ValueMenuProps<T>) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={`${props.label}: ${props.show(props.value)}. Change`} className={VALUE_TRIGGER}>
        {props.show(props.value)}
        <ChevronDownIcon aria-hidden="true" className="size-3.5 text-zebra-400" />
      </PopoverTrigger>
      {/* Closed, the content unmounts, so each opening starts on an empty typing line. */}
      <PopoverContent size="menu" align="start" aria-label={props.label} className="w-56">
        <ValueMenu
          {...props}
          onPick={(v) => {
            props.onPick(v);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
