'use client';

import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, X } from 'lucide-react';
import { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';

/**
 * Canonical multi-value select.
 *
 * `Select` holds one value (Radix Select has no multiple mode), so this
 * is its sibling for "any of these": the same 32px trigger, a portalled
 * list of `Checkbox` rows, and the chosen values as removable chips
 * under the trigger. Chips rather than a comma list in the trigger: the
 * trigger never grows (one control height), and each choice can be
 * removed without opening the list.
 *
 * A chosen value that is no longer an option (a stage the MC deleted)
 * keeps its chip, labelled by the raw value, so it can still be seen and
 * removed rather than silently kept.
 *
 * @example
 * ```tsx
 * <MultiSelect
 *   label="Stop when the couple moves to"
 *   options={[{ value: 'lost', label: 'Lost' }]}
 *   value={stages}
 *   onValueChange={setStages}
 * />
 * ```
 *
 * @module components/ui/multi-select
 */

export interface MultiSelectOption {
  /** Stored value. */
  value: string;
  /** Visible label, also used in the chip's "Remove" name. */
  label: string;
}

export interface MultiSelectProps {
  /** Visible label rendered above the trigger. */
  label?: string;
  /** Accessible name when there is no visible `label`. */
  ariaLabel?: string;
  /** Help text below the chips. Hidden when `error` is set. */
  help?: string;
  /** Error message rendered in place of `help` (role=alert). */
  error?: string;
  /** Available options, in display order. */
  options: MultiSelectOption[];
  /** The chosen values, in the order they were chosen. */
  value: string[];
  /** Called with the whole next list on every add or remove. */
  onValueChange: (next: string[]) => void;
  /** Trigger text when nothing is chosen. */
  placeholder?: string;
  /** Disables the trigger, every chip, and the ticks in an open list. */
  disabled?: boolean;
  /** Extra classes on the wrapper. */
  className?: string;
}

/** The Select trigger's classes, so the two controls read as one family. */
const TRIGGER =
  'inline-flex h-8 w-full items-center justify-between gap-1.5 rounded-control border ' +
  'bg-surface px-2.5 text-body text-text transition-colors focus-visible:border-brand-fg ' +
  'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

/** Token-driven multi-value select. See {@link MultiSelectProps}. */
export function MultiSelect({
  label,
  ariaLabel,
  help,
  error,
  options,
  value,
  onValueChange,
  placeholder = 'None',
  disabled,
  className,
}: MultiSelectProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const name = label ?? ariaLabel;
  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) =>
    onValueChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className={`space-y-1.5${className ? ` ${className}` : ''}`}>
      {label ? (
        <label htmlFor={id} className="block text-body font-medium text-text">
          {label}
        </label>
      ) : null}

      <Popover.Root>
        <Popover.Trigger
          id={id}
          {...(disabled !== undefined && { disabled })}
          {...(ariaLabel !== undefined && !label && { 'aria-label': ariaLabel })}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || help ? noteId : undefined}
          className={`${TRIGGER} ${error ? 'border-danger' : 'border-border'}`}
        >
          <span className={`min-w-0 flex-1 truncate text-left${value.length ? '' : ' text-text-subtle'}`}>
            {value.length ? `${value.length} chosen` : placeholder}
          </span>
          <ChevronDown
            className="shrink-0 text-text-muted"
            width={16}
            height={16}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </Popover.Trigger>
        <Popover.Portal>
          {/* z-[90], the popover tier: above modals and side panels, as
              for Select. text-body on the panel itself because a portal
              does not inherit the trigger's type size. */}
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-[90] max-h-(--radix-popover-content-available-height) min-w-(--radix-popover-trigger-width) overflow-y-auto rounded-control border border-border bg-surface p-1 text-body text-text shadow-lg animate-fade-in"
          >
            <div role="group" aria-label={name}>
              {options.map((o) => (
                <div key={o.value} className="rounded-control px-2 py-1.5 hover:bg-surface-emphasis">
                  <Checkbox
                    label={o.label}
                    checked={value.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    {...(disabled !== undefined && { disabled })}
                  />
                </div>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li
              key={v}
              className="inline-flex items-center gap-1 rounded-pill bg-surface-emphasis py-0.5 pl-2.5 pr-1 text-body text-text"
            >
              {labelFor(v)}
              <button
                type="button"
                {...(disabled !== undefined && { disabled })}
                aria-label={`Remove ${labelFor(v)}`}
                onClick={() => toggle(v)}
                className="-my-0.5 rounded-pill p-1 text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fg disabled:cursor-not-allowed"
              >
                <X width={12} height={12} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p id={noteId} role="alert" className="text-body text-danger">
          {error}
        </p>
      ) : help ? (
        <p id={noteId} className="text-body text-text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}
