/**
 * Design system v2 segmented control (preview): two to five mutually
 * exclusive options in one 32px track, the picked one raised on a white
 * thumb. For switching a view (Proposal / Contract / Invoice) or a
 * small setting, where a row of chips would read as a form.
 *
 * Buttons with `aria-pressed` inside a labelled group, like ChipGroup,
 * so it needs no roving focus to be accessible; Tab reaches each option.
 * The thumb is each button's own background, so a pick crossfades and
 * the track never changes size.
 *
 * @example
 * ```tsx
 * <Segmented label="Preview" options={['Proposal', 'Contract', 'Invoice']} value={doc} onChange={setDoc} />
 * <Segmented label="Source" options={['All', 'Email']} counts={{ All: 4, Email: 1 }} value={src} onChange={setSrc} />
 * ```
 *
 * @module components/ui-v2/segmented
 */

export interface SegmentedProps<T extends string> {
  /** Names the group for assistive tech; not shown. */
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /**
   * A count after each option's label, in a quieter tone (a filter
   * showing how many items each option holds). Options left out show none.
   */
  counts?: Partial<Record<T, number>> | undefined;
}

/** v2 segmented control. See {@link SegmentedProps}. */
export function Segmented<T extends string>({ label, options, value, onChange, counts }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-9 items-center gap-0.5 rounded-panel bg-zebra-100 p-0.5">
      {options.map((option) => {
        const on = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option)}
            className={`h-8 rounded-button px-3 type-label transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
              on ? 'bg-field text-zebra-950 shadow-sm' : 'text-zebra-500 hover:text-zebra-950'
            }`}
          >
            {option}
            {counts?.[option] !== undefined ? <span className="ml-1.5 tabular-nums text-zebra-400">{counts[option]}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
