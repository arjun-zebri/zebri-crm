'use client'

import { useId, useRef, type KeyboardEvent } from 'react'

/**
 * Tappable choice pills: one option picked (`mode="single"`, the default) or
 * several (`mode="multiple"`).
 *
 * Use this instead of a `Select` or a native `<select>` for a short list of
 * options a person can see at once. Every option is a visible target, which
 * is what a thumb on a phone needs. A dropdown hides the options behind a tap.
 *
 * Semantics follow the ARIA pattern for each mode. Single is a `radiogroup`
 * of `radio` buttons with a roving tab stop, so Tab lands on the chosen
 * option and the arrow keys move and select. Multiple is a `group` of
 * `checkbox` buttons, each one a Tab stop. Both are labelled by the visible
 * `label`, so a screen reader announces the question before the options.
 *
 * The chosen state is the brand colour (`--brand-fg` / `--brand-bg`), so a
 * branded page picks it up with no per-call styling.
 *
 * @example
 * ```tsx
 * <ChoiceGroup
 *   label="Venue type"
 *   help="Pick the one closest to your plans."
 *   options={['Garden', 'Ballroom', 'Beach']}
 *   value={venue}
 *   onChange={setVenue}
 * />
 *
 * <ChoiceGroup
 *   mode="multiple"
 *   label="Services you need"
 *   optional
 *   options={['Ceremony', 'Reception', 'Speeches']}
 *   value={services}
 *   onChange={setServices}
 * />
 * ```
 *
 * @module components/ui/choice-group
 */

/** Props shared by both modes. */
export interface ChoiceGroupBaseProps {
  /** Visible question or group name. Labels the group for assistive tech. */
  label: string;
  /** The options, in display order. Duplicates are the caller's bug. */
  options: readonly string[];
  /** Helper text under the label. Hidden while `error` is set. */
  help?: string | undefined;
  /** Error message under the options. Role=alert. */
  error?: string | undefined;
  /** Quiet "Optional" tag beside the label. */
  optional?: boolean;
  /** Stops every option being chosen. */
  disabled?: boolean;
  /** Stable id for the group. Generated when omitted. */
  id?: string;
  /** Extra classes on the wrapper. */
  className?: string;
}

/** Exactly one option chosen. `value` is `null` until the person picks one. */
export interface ChoiceGroupSingleProps extends ChoiceGroupBaseProps {
  mode?: 'single';
  value: string | null;
  onChange: (value: string) => void;
}

/** Any number of options chosen, returned in the order the options are listed. */
export interface ChoiceGroupMultipleProps extends ChoiceGroupBaseProps {
  mode: 'multiple';
  value: string[];
  onChange: (value: string[]) => void;
}

/** Props for {@link ChoiceGroup}. */
export type ChoiceGroupProps = ChoiceGroupSingleProps | ChoiceGroupMultipleProps;

// The pill is the same 32px control height as every other control, with
// `min-h` rather than `h` so a long option wraps instead of clipping.
const PILL_BASE =
  'inline-flex min-h-8 items-center rounded-pill border px-3 py-1 text-body font-medium ' +
  'transition-colors cursor-pointer text-left ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fg focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'disabled:opacity-50 disabled:pointer-events-none';
const PILL_IDLE = 'border-border bg-surface text-text hover:bg-surface-muted';
const PILL_ON = 'border-brand-fg bg-brand-fg text-brand-bg';

/** Single- or multi-select pill group. See the module docs for semantics. */
export function ChoiceGroup(props: ChoiceGroupProps) {
  const { label, options, help, error, optional = false, disabled = false, id, className } = props;
  const autoId = useId();
  const baseId = id ?? autoId;
  const labelId = `${baseId}-label`;
  const helpId = help && !error ? `${baseId}-help` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const isMultiple = props.mode === 'multiple';
  const selected = (option: string) =>
    isMultiple ? props.value.includes(option) : props.value === option;

  // Single mode uses a roving tab stop: Tab reaches the chosen pill, or the
  // first one when nothing is chosen yet, and the arrows move from there.
  const singleTabStop = !isMultiple
    ? (props.value !== null && options.includes(props.value) ? props.value : options[0])
    : undefined;

  function choose(option: string) {
    if (disabled) return;
    if (props.mode === 'multiple') {
      const next = selected(option)
        ? props.value.filter((v) => v !== option)
        : [...props.value, option];
      // Keep the caller's option order, so the saved answer reads the same
      // whichever order the person ticked things in.
      props.onChange(options.filter((o) => next.includes(o)));
    } else {
      props.onChange(option);
    }
  }

  function handleArrowKeys(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (isMultiple) return;
    const last = options.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index === last ? 0 : index + 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index === 0 ? last : index - 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    const target = options[next];
    if (target === undefined) return;
    choose(target);
    buttonRefs.current[next]?.focus();
  }

  return (
    <div className={`space-y-1${className ? ` ${className}` : ''}`}>
      <div className="flex items-center gap-1.5">
        <span id={labelId} className="text-body font-medium text-text">
          {label}
        </span>
        {optional ? <span className="text-body text-text-muted">Optional</span> : null}
      </div>
      {help && !error ? (
        <p id={helpId} className="text-body text-text-muted">
          {help}
        </p>
      ) : null}
      <div
        role={isMultiple ? 'group' : 'radiogroup'}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="flex flex-wrap gap-2 pt-1"
      >
        {options.map((option, index) => {
          const on = selected(option);
          const tabIndex = isMultiple ? 0 : option === singleTabStop ? 0 : -1;
          return (
            <button
              key={option}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              role={isMultiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              tabIndex={tabIndex}
              disabled={disabled}
              onClick={() => choose(option)}
              onKeyDown={(e) => handleArrowKeys(e, index)}
              className={`${PILL_BASE} ${on ? PILL_ON : PILL_IDLE}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-body text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
