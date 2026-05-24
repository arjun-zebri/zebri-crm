/**
 * Discount affordance — collapsed chip that expands into an inline
 * compact pill.
 *
 * - **Collapsed**: `[+ Discount]` subtle tonal chip.
 * - **Configured (percentage)**: pill with an inline range slider
 *   (0-50%), the current value, a %/$ toggle, and a remove ×.
 *   The slider doesn't push siblings around because the pill keeps
 *   a fixed footprint.
 * - **Configured (fixed)**: same shape but a small number input
 *   replaces the slider (fixed-amount has no natural upper bound).
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

/** Maximum the percentage slider accepts. 50% covers every realistic
 *  wedding discount (early-bird, deposit deals, etc.). */
const PERCENTAGE_MAX = 50;

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

  function toggleType() {
    onTypeChange(type === 'percentage' ? 'fixed' : 'percentage');
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-control bg-surface-emphasis pl-2.5 pr-1 py-1 text-caption font-medium text-text">
      <span className="text-text-muted">Discount</span>

      {type === 'percentage' ? (
        <>
          <input
            type="range"
            min="0"
            max={PERCENTAGE_MAX}
            step="1"
            value={value ?? 0}
            onChange={(e) => onValueChange(parseInt(e.target.value, 10) || 0)}
            disabled={!canEdit}
            aria-label="Discount percentage"
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-border accent-brand-fg disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="w-8 text-right tabular-nums">
            {Math.round(value ?? 0)}%
          </span>
        </>
      ) : (
        <>
          <span className="text-text-muted">$</span>
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            readOnly={!canEdit}
            disabled={!canEdit}
            className="w-14 bg-transparent text-right text-caption font-medium text-text tabular-nums focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Discount amount"
          />
        </>
      )}

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
