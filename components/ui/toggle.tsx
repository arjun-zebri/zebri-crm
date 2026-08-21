'use client';

import { useId, type ReactNode } from 'react';

/**
 * Canonical on/off switch primitive.
 *
 * Use a `Toggle` when the control IS the setting: flipping it turns
 * something on or off there and then (an automation, a portal section,
 * a bookable weekday). Use {@link Checkbox} when the control collects a
 * value inside a form the user will submit, and a `Select` when there
 * are more than two states.
 *
 * Built as a `<button role="switch">` rather than a native
 * `<input type="checkbox">`: native controls render platform chrome
 * that ignores our tokens, the same reason `Checkbox` is custom. The
 * track is `bg-success` when on and `bg-border-strong` when off, so a
 * switch reads as "this is live" at a glance and pairs with the emerald
 * fill of a checked `Checkbox`. The four hand-rolled switches this
 * replaced all reached for `bg-black` and `bg-gray-200`, which do not
 * follow the theme.
 *
 * @example
 * ```tsx
 * <Toggle
 *   checked={active}
 *   onChange={setActive}
 *   label={active ? 'Active' : 'Paused'}
 *   description={active ? 'Couples can book this.' : 'The link stops taking bookings.'}
 * />
 *
 * <Toggle checked={enabled} onChange={setEnabled} ariaLabel="Enable Monday" />
 * ```
 *
 * @module components/ui/toggle
 */

export interface ToggleProps {
  /** Controlled on/off state. */
  checked: boolean;
  /** Change callback with the next state. */
  onChange: (checked: boolean) => void;
  /** Visible label rendered to the right; clicking it toggles too. */
  label?: ReactNode;
  /**
   * Second line under the label, for when "off" has a consequence the
   * label alone does not convey.
   */
  description?: ReactNode;
  /** Disables the control. */
  disabled?: boolean;
  /** Extra classes on the outermost element. */
  className?: string;
  /** Accessible name for label-less switches (e.g. one per table row). */
  ariaLabel?: string;
}

/** Token-driven switch. See {@link ToggleProps}. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  ariaLabel,
}: ToggleProps) {
  const labelId = useId();

  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      {...(label ? { 'aria-labelledby': labelId } : {})}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`shrink-0 relative w-9 h-5 rounded-pill transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-offset-surface focus-visible:ring-border-strong ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${checked ? 'bg-success' : 'bg-border-strong'} ${label ? '' : (className ?? '')}`}
    >
      {/* The knob is absolutely positioned and slides on `translate-x`, so
          the track never changes size when the switch is flipped. */}
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-pill bg-surface shadow-sm
          transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );

  if (!label) return track;

  return (
    <div className={`flex items-start gap-3 ${className ?? ''}`}>
      <span className="pt-0.5">{track}</span>
      {/* Not a <label>: it wraps a button, and forwarding a label click to
          a non-input control is inconsistent across browsers. The text
          toggles through its own handler and names the switch through
          `aria-labelledby`. */}
      <span
        onClick={disabled ? undefined : () => onChange(!checked)}
        className={`select-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          id={labelId}
          className={`block text-body ${disabled ? 'text-text-subtle' : 'text-text'}`}
        >
          {label}
        </span>
        {description ? (
          <span className="block text-body text-text-muted">{description}</span>
        ) : null}
      </span>
    </div>
  );
}
