/**
 * A toggleable filter chip: a label with an optional count, pressed when
 * its filter is on. Used for "narrow the list to this status" rows where
 * the count is the point. Not a tab (no panel) and not a checkbox (the
 * whole chip is the control). Pill-shaped, one 32px height, tokens only.
 *
 * @example
 * ```tsx
 * <FilterChip label="Active" count={12} pressed={filter === 'active'} onClick={() => setFilter('active')} />
 * ```
 *
 * @module components/ui/filter-chip
 */
export interface FilterChipProps {
  /** Short visible label, e.g. "Active". */
  label: string;
  /** Optional count shown before the label. */
  count?: number;
  /** True while this chip's filter is applied. Drives `aria-pressed`. */
  pressed: boolean;
  /** Toggle handler. The parent decides whether a second press clears the filter. */
  onClick: () => void;
  /** Optional extra classes for layout only, not colour. */
  className?: string;
}

/** A pressed-state filter chip. Renders a real `<button type="button">`. */
export function FilterChip({ label, count, pressed, onClick, className = '' }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-body transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong ${
        pressed ? 'border-border-strong bg-surface-emphasis text-text' : 'border-border bg-surface text-text-muted hover:text-text'
      } ${className}`.trim()}
    >
      {count !== undefined && <span className="font-semibold text-text tabular-nums">{count}</span>}
      <span>{label}</span>
    </button>
  );
}
