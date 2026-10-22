'use client';

import type { KeyboardEvent } from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui-v2/icons';

import { DISABLED } from './control-styles';

/**
 * Design system v2 stepper (preview): a whole number with a step down on
 * its left and a step up on its right, in the same 36px track as
 * `Segmented`. For a small measure the MC nudges and watches land (the
 * brand kit's page and button rounding, in pixels), where a slider would
 * be too loose and a typed box too fiddly. The value sits in a fixed
 * width, so the arrows never move as it changes; each end greys out at
 * its limit. Arrow keys on either button step too. A toolbar control:
 * 36px with the panel's corners; the arrows keep the smaller button
 * corner, nested inside it.
 *
 * @example
 * ```tsx
 * <Stepper label="Page rounding" value={radius} min={0} max={24} unit="px" onChange={setRadius} />
 * ```
 *
 * @module components/ui-v2/stepper
 */

export interface StepperProps {
  /** Names the control for assistive tech; not shown. */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number | undefined;
  max?: number | undefined;
  /** How far one press moves it. Default 1. */
  step?: number | undefined;
  /** Shown after the number ("px"). */
  unit?: string | undefined;
  /** Greys the whole control out. */
  disabled?: boolean | undefined;
}

const ARROW =
  `flex size-8 items-center justify-center rounded-button text-zebra-500 transition-colors duration-150 hover:bg-field hover:text-zebra-950 focus-mark ${DISABLED} motion-reduce:transition-none`;

/** v2 stepper. See {@link StepperProps}. */
export function Stepper({ label, value, onChange, min = 0, max = 99, step = 1, unit, disabled = false }: StepperProps) {
  const go = (by: number) => onChange(Math.min(max, Math.max(min, value + by)));
  const keys = (e: KeyboardEvent) => {
    const by = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
    if (by === undefined) return;
    e.preventDefault();
    go(by);
  };
  return (
    <div role="group" aria-label={label} className={`inline-flex h-9 items-center rounded-panel bg-hover p-0.5${disabled ? ' opacity-50' : ''}`}>
      <button type="button" aria-label={`Less ${label.toLowerCase()}`} disabled={disabled || value <= min} onClick={() => go(-step)} onKeyDown={keys} className={ARROW}>
        <ChevronLeftIcon aria-hidden="true" className="size-4" />
      </button>
      <output aria-live="polite" className="w-14 text-center type-numeric text-zebra-950">
        {value}
        {unit ? <span className="text-zebra-500">{unit}</span> : null}
      </output>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={disabled || value >= max} onClick={() => go(step)} onKeyDown={keys} className={ARROW}>
        <ChevronRightIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
