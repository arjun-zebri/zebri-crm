'use client';

import { useId, type CSSProperties } from 'react';

import { DISABLED } from './control-styles';

/**
 * v2 slider: a label and its current value on one line, a thin track
 * underneath. For a value that is felt rather than typed (a picture's
 * opacity, a corner's roundness, the space between letters). The browser's
 * own range input, so arrow keys, Page Up/Down and screen readers work
 * as they do everywhere; only its look is the house's: a grass fill up
 * to the thumb, a white thumb with the button shadow.
 *
 * @example
 * <Slider label="Opacity" min={0} max={100} value={80} onChange={setOpacity} format={(v) => `${v}%`} />
 *
 * @module components/ui-v2/slider
 */

export interface SliderProps {
  label: string;
  min: number;
  max: number;
  /** Defaults to 1. */
  step?: number | undefined;
  value: number;
  onChange: (value: number) => void;
  /** Called once when the thumb is let go (one undo step per drag). */
  onCommit?: (() => void) | undefined;
  /** How the value reads beside the label. Defaults to the number. */
  format?: ((value: number) => string) | undefined;
  /** Greys the slider out; it cannot be moved. */
  disabled?: boolean | undefined;
}

/** v2 slider. See {@link SliderProps}. */
export function Slider({ label, min, max, step = 1, value, onChange, onCommit, format = String, disabled = false }: SliderProps) {
  const id = useId();
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="type-label text-zebra-950">
          {label}
        </label>
        <span className="type-numeric text-zebra-500">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        // How far the fill runs is the value, known only at runtime.
        style={{ '--fill': `${pct}%` } as CSSProperties}
        className={`h-4 w-full cursor-pointer appearance-none rounded-pill bg-transparent focus-mark ${DISABLED} [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-pill [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-field [&::-moz-range-thumb]:shadow-btn-soft [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-pill [&::-moz-range-track]:bg-[linear-gradient(to_right,var(--color-grass-700)_var(--fill),var(--color-zebra-200)_var(--fill))] [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-pill [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-grass-700)_var(--fill),var(--color-zebra-200)_var(--fill))] [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-pill [&::-webkit-slider-thumb]:bg-field [&::-webkit-slider-thumb]:shadow-btn-soft [&::-webkit-slider-thumb]:ring-1 [&::-webkit-slider-thumb]:ring-hairline`}
      />
    </div>
  );
}
