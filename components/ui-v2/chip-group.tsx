'use client';

import { useId } from 'react';

import { CheckIcon } from '@/components/ui-v2/icons';

import { StackedChoices } from './chip-group-stacked';
import { DISABLED } from './control-styles';

/**
 * Design system v2 chip group (preview): a labelled row of toggle chips
 * for picking one option or several from a short list.
 *
 * Each chip is a real button with `aria-pressed`, inside a labelled
 * `role="group"`, so it reads as "What you do, group, MC, toggle button,
 * pressed". A selected chip gets the `selected` green edge and text over
 * a grass tint, and a check, so the state never relies on colour alone.
 * Chips sit inside content: 32px, `rounded-button`, `type-body`, as
 * PropertyChip and TagList are (2026-10-14).
 *
 * `hints` adds a muted note inside a chip after its name ("Ella
 * ella.b@gmail.com", "Noah opened last time"). `inline` puts the label in
 * a narrow column to the left, muted, for a compact form of short rows
 * (To, Via) such as the reminder composer; stack a `Segmented` beside
 * the same label width for a row that picks one of a few.
 *
 * `soft` drops the border for the settings look a row of PropertyChips
 * has: a picked chip is filled light green with a green tick that slides
 * in, an unpicked one is plain muted text. Use it where the group sits
 * among PropertyChips, so the page shows one chip style, not two.
 *
 * `stacked` lists the options one under another as boxed rows, each with
 * a radio or check mark and its hint on a line under its name, beside
 * boxed fields on a form a stranger fills in (the couple's; see
 * `chip-group-stacked.tsx`).
 *
 * @example
 * ```tsx
 * <ChipGroup label="Spacing" options={['Compact', 'Cozy', 'Roomy']} value={['Cozy']} onChange={setSpacing} />
 * <ChipGroup multiple label="What you do" options={roles} value={picked} onChange={setPicked} />
 * ```
 *
 * @module components/ui-v2/chip-group
 */

export interface ChipGroupProps {
  /** Visible label above the chips. */
  label: string;
  /** Muted line beside the label, e.g. "Select all that apply". */
  description?: string | undefined;
  /** The options, as their visible labels. */
  options: readonly string[];
  /** The selected option(s). */
  value: readonly string[];
  /** Called with the new selection. */
  onChange: (next: string[]) => void;
  /** Allow several at once. Single-select otherwise. */
  multiple?: boolean;
  /** A muted note inside a chip, after its name, keyed by option. */
  hints?: Partial<Record<string, string>> | undefined;
  /** Label in a narrow muted column to the left instead of above. */
  inline?: boolean | undefined;
  /** Borderless, filled when picked, to sit among PropertyChips. */
  soft?: boolean | undefined;
  /** Greys every chip out and stops it being pressed. */
  disabled?: boolean | undefined;
  /** A list of boxed rows with a mark and a hint line each, instead of chips. */
  stacked?: boolean | undefined;
  /** With `stacked`: "(optional)" after the name (see `BoxedLabel`). */
  optional?: boolean | undefined;
}

/** v2 chip group. See {@link ChipGroupProps}. */
export function ChipGroup({
  label,
  description,
  options,
  value,
  onChange,
  multiple = false,
  hints,
  inline = false,
  soft = false,
  disabled = false,
  stacked = false,
  optional = false,
}: ChipGroupProps) {
  const labelId = useId();
  function toggle(option: string) {
    if (!multiple) return onChange([option]);
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }
  if (stacked)
    return (
      <StackedChoices
        labelId={labelId}
        label={label}
        description={description}
        options={options}
        value={value}
        multiple={multiple}
        hints={hints}
        disabled={disabled}
        optional={optional}
        onToggle={toggle}
      />
    );
  return (
    <div className={inline ? 'flex items-start gap-4' : 'space-y-2'}>
      {/* The description sits under the label, like a field's help. */}
      <div className={inline ? 'w-14 shrink-0 pt-1.5' : 'space-y-0.5'}>
        <p
          id={labelId}
          className={inline ? 'type-body text-zebra-500' : 'type-label text-zebra-950'}
        >
          {label}
        </p>
        {description ? (
          <p id={`${labelId}-desc`} className="type-body text-zebra-500">
            {description}
          </p>
        ) : null}
      </div>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={description ? `${labelId}-desc` : undefined}
        className={`flex flex-wrap ${soft ? 'gap-1' : 'gap-2'}`}
      >
        {options.map((option) => {
          const on = value.includes(option);
          // Soft: the green fill and the tick carry the state, with aria-pressed for screen readers.
          const look = soft
            ? `px-2.5 ${on ? 'bg-grass-50 text-selected hover:bg-grass-100' : 'text-zebra-400 hover:bg-hover hover:text-zebra-950'}`
            : `border px-3 ${
                on
                  ? 'border-selected bg-grass-50 text-selected'
                  : 'border-hairline bg-field text-zebra-700 hover:bg-hover hover:text-zebra-950'
              }`;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => toggle(option)}
              className={`inline-flex h-8 items-center ${soft ? '' : 'gap-1.5 '}rounded-button type-body transition-colors duration-150 focus-mark ${DISABLED} motion-reduce:transition-none ${look}`}
            >
              {soft ? (
                // The tick opens from nothing (a 0fr to 1fr grid column) and fades in, so the
                // chip grows smoothly rather than jumping; the gap lives inside it.
                <span
                  aria-hidden="true"
                  className={`grid transition-[grid-template-columns,opacity] duration-150 ease-out motion-reduce:transition-none ${on ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0'}`}
                >
                  <span className="overflow-hidden">
                    <CheckIcon className="mr-1.5 size-3.5 text-selected" />
                  </span>
                </span>
              ) : on ? (
                <CheckIcon aria-hidden="true" className="size-3.5" />
              ) : null}
              {option}
              {hints?.[option] ? (
                <span className="font-normal opacity-70">{hints[option]}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
