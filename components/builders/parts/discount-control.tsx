/**
 * Discount affordance — collapsed chip that expands into an inline
 * compact pill (still one element wide).
 *
 * Two states, both rendered as a single self-contained pill:
 * - **Collapsed**: `[+ Discount]` — subtle tonal chip.
 * - **Configured**: `[ Discount  10  %  × ]` — same pill, slightly
 *   emphasised, with an inline number input + a small % / $ toggle
 *   + a remove × icon. The pill stays compact so it doesn't push
 *   sibling controls onto a new row.
 *
 * @module components/builders/parts/discount-control
 */
'use client';

import { Plus, X } from 'lucide-react';

export type DiscountType = 'percentage' | 'fixed';

export interface DiscountControlProps {
  /** Current discount type. `null` = no discount configured. */
  type: DiscountType | null;
  /** Current value (percent 0-100 OR fixed amount, depending on `type`). */
  value: number | null;
  /** Locks editing. */
  canEdit: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onTypeChange: (next: DiscountType) => void;
  onValueChange: (next: number) => void;
}

export function DiscountControl({
  type,
  value,
  canEdit,
  onAdd,
  onRemove,
  onTypeChange,
  onValueChange,
}: DiscountControlProps) {
  // Collapsed: subtle inline-action chip.
  if (type === null) {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={!canEdit}
        className="inline-flex items-center gap-1.5 rounded-control bg-surface-muted px-2.5 py-1 text-caption font-medium text-text-muted hover:bg-surface-emphasis hover:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <Plus size={12} strokeWidth={1.5} />
        Discount
      </button>
    );
  }

  // Configured: same chip shape, slightly stronger background to
  // signal "active". Inline number input + a single %/$ toggle
  // (clicking it cycles, no separate buttons) + remove ×. The
  // whole thing fits on one line so click-to-expand doesn't push
  // siblings onto a new row.
  function toggleType() {
    onTypeChange(type === 'percentage' ? 'fixed' : 'percentage');
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-control bg-surface-emphasis pl-2.5 pr-1 py-1 text-caption font-medium text-text">
      <span>Discount</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
        min="0"
        step={type === 'percentage' ? '1' : '0.01'}
        readOnly={!canEdit}
        disabled={!canEdit}
        className="w-10 bg-transparent text-right text-caption font-medium text-text tabular-nums focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Discount value"
      />
      <button
        type="button"
        onClick={toggleType}
        disabled={!canEdit}
        aria-label={`Switch to ${type === 'percentage' ? 'fixed amount' : 'percentage'}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-text-muted hover:bg-surface-muted hover:text-text transition-colors disabled:opacity-50 cursor-pointer"
      >
        {type === 'percentage' ? '%' : '$'}
      </button>
      {canEdit ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove discount"
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-text-muted hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
        >
          <X size={11} strokeWidth={1.5} />
        </button>
      ) : null}
    </span>
  );
}
