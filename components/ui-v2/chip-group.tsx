'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';

/**
 * Design system v2 chip group (preview): a labelled row of toggle chips
 * for picking one option or several from a short list.
 *
 * Each chip is a real button with `aria-pressed`, inside a labelled
 * `role="group"`, so it reads as "What you do, group, MC, toggle button,
 * pressed". A selected chip gets a grass tint and a check, so the state
 * never relies on colour alone.
 *
 * `hints` adds a muted note inside a chip after its name ("Ella
 * ella.b@gmail.com", "Noah opened last time"). `inline` puts the label in
 * a narrow column to the left, muted, for a compact form of short rows
 * (To, Via) such as the reminder composer; stack a `Segmented` beside
 * the same label width for a row that picks one of a few.
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
}

/** v2 chip group. See {@link ChipGroupProps}. */
export function ChipGroup({ label, description, options, value, onChange, multiple = false, hints, inline = false }: ChipGroupProps) {
  const labelId = useId();
  function toggle(option: string) {
    if (!multiple) return onChange([option]);
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }
  return (
    <div className={inline ? 'flex items-start gap-4' : 'space-y-2'}>
      {/* The description sits under the label, like a field's help. */}
      <div className={inline ? 'w-14 shrink-0 pt-1.5' : 'space-y-0.5'}>
        <p id={labelId} className={inline ? 'type-body text-zebra-500' : 'type-label text-zebra-950'}>
          {label}
        </p>
        {description ? (
          <p id={`${labelId}-desc`} className="type-body text-zebra-500">
            {description}
          </p>
        ) : null}
      </div>
      <div role="group" aria-labelledby={labelId} aria-describedby={description ? `${labelId}-desc` : undefined} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(option)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-button border px-3 type-label transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
                on
                  ? 'border-grass-600 bg-grass-50 text-grass-900'
                  : 'border-zebra-200 bg-field text-zebra-700 hover:border-zebra-300 hover:text-zebra-950'
              }`}
            >
              {on ? <Check aria-hidden="true" strokeWidth={1.5} className="size-3.5" /> : null}
              {option}
              {hints?.[option] ? <span className="font-normal opacity-70">{hints[option]}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
