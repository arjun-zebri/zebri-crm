import { CheckIcon } from '@/components/ui-v2/icons';

import { BoxedLabel } from './boxed-label';
import { DISABLED, HOVER_ON_WHITE } from './control-styles';

/**
 * `ChipGroup`'s `stacked` look: the options as a list of boxed rows, one
 * under another, each with a round mark (pick one) or a square one (pick
 * several), its name, and its hint on a line of its own under it. For a
 * form filled in once by a stranger, the couple's (user, 2026-10-15):
 * a row of pills read as tags, not as a question, and gave a hint such
 * as "your divorce is not final yet" nowhere to go. Two options with no
 * hints (Yes, No) sit side by side, phones too, so a yes-or-no question
 * is not two full-width bars.
 *
 * @module components/ui-v2/chip-group-stacked
 */

export interface StackedChoicesProps {
  labelId: string;
  label: string;
  description?: string | undefined;
  options: readonly string[];
  value: readonly string[];
  multiple: boolean;
  hints?: Partial<Record<string, string>> | undefined;
  disabled: boolean;
  optional: boolean;
  onToggle: (option: string) => void;
}

/** The mark leading an option: a ring with a dot for pick one, a box with a tick for pick several. */
function Mark({ on, multiple }: { on: boolean; multiple: boolean }) {
  const edge = on ? 'border-selected' : 'border-zebra-300';
  if (multiple)
    return (
      <span aria-hidden="true" className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-check border ${on ? 'border-selected bg-selected text-zebra-50' : `${edge} bg-field`}`}>
        {on ? <CheckIcon className="size-3" /> : null}
      </span>
    );
  return (
    <span aria-hidden="true" className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-pill border bg-field ${edge}`}>
      {on ? <span className="size-2 rounded-pill bg-selected" /> : null}
    </span>
  );
}

/** The stacked list. Drawn by `ChipGroup` with `stacked`; see {@link StackedChoicesProps}. */
export function StackedChoices({ labelId, label, description, options, value, multiple, hints, disabled, optional, onToggle }: StackedChoicesProps) {
  const pair = options.length === 2 && !options.some((o) => hints?.[o]);
  return (
    <div>
      <BoxedLabel id={labelId} optional={optional}>
        {label}
      </BoxedLabel>
      {description ? (
        <p id={`${labelId}-desc`} className="-mt-0.5 mb-2 type-body text-zebra-500">
          {description}
        </p>
      ) : null}
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={description ? `${labelId}-desc` : undefined}
        className={`grid gap-2${pair ? ' grid-cols-2' : ''}`}
      >
        {options.map((option) => {
          const on = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onToggle(option)}
              // The pick's edge is drawn 2px (border plus an inset ring) so the row never changes size, as ChoiceCard's.
              className={`flex min-h-10 w-full items-start gap-3 rounded-panel border bg-field px-3 py-2.5 text-left transition-[border-color,box-shadow,background-color] duration-150 focus-mark ${DISABLED} motion-reduce:transition-none ${
                on ? 'border-selected ring-1 ring-inset ring-selected' : `border-zebra-200 hover:border-zebra-300 ${HOVER_ON_WHITE}`
              }`}
            >
              <Mark on={on} multiple={multiple} />
              <span className="min-w-0">
                <span className="block type-body text-zebra-950">{option}</span>
                {hints?.[option] ? <span className="block type-body text-zebra-500">{hints[option]}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
