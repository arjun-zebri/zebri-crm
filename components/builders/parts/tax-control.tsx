/**
 * GST/tax chip — text-only label that toggles between neutral and
 * applied (mint green) states.
 *
 * The button stays mounted; only its background tone changes. The
 * parent wraps the chip container with `useAutoAnimate()` so any
 * sibling-chip width changes (e.g. discount expanding) animate
 * smoothly.
 *
 * @module components/builders/parts/tax-control
 */
'use client';

export interface TaxControlProps {
  /** Whether the 10% GST line is currently applied. */
  applied: boolean;
  /** Locks editing. */
  canEdit: boolean;
  onApply: () => void;
  onRemove: () => void;
}

export function TaxControl({ applied, canEdit, onApply, onRemove }: TaxControlProps) {
  return (
    <button
      type="button"
      onClick={applied ? onRemove : onApply}
      disabled={!canEdit}
      aria-label={applied ? 'Remove GST' : 'Apply 10% GST'}
      className={`inline-flex items-center rounded-control px-2.5 py-1 text-caption font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
        applied
          ? 'bg-success/10 text-success hover:bg-danger/10 hover:text-danger'
          : 'bg-surface-muted text-text-muted hover:bg-surface-emphasis hover:text-text'
      }`}
    >
      GST 10%
    </button>
  );
}
