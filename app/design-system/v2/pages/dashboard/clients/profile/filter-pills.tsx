/**
 * A row of round filter pills above a list: the chosen one filled dark,
 * the rest outlined. Each is a toggle button inside a labelled group, so
 * a screen reader hears which is on without relying on the fill.
 *
 * Local to the profile for now; a candidate for `components/ui-v2` if a
 * second screen wants it.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/filter-pills
 */

export interface FilterPillsProps<T extends string> {
  /** The group's accessible name. */
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}

/** Filter pills. See {@link FilterPillsProps}. */
export function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
}: FilterPillsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`h-8 rounded-pill border px-3.5 type-body transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
            o === value
              ? 'border-zebra-950 bg-zebra-950 text-field'
              : 'border-zebra-200 text-zebra-700 hover:border-zebra-300 hover:text-zebra-950'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
