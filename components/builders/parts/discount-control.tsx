/**
 * Discount affordance — collapsed link + expanded inline editor.
 *
 * Reduces visual noise: when no discount is set, only a small
 * "+ Add discount" link button shows. Click expands to a single
 * row with `[ % | $ ] [ value input ]   [× remove]`.
 *
 * The "type" switch is a segmented control (two pill buttons) — not
 * a select. Two options don't deserve a dropdown.
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
  // Not configured: show the "+ Add discount" affordance as a
  // dashed-outline pill button — more obviously clickable than a
  // plain text link.
  if (type === null) {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={!canEdit}
        className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-border-strong bg-transparent px-3 py-1.5 text-caption font-medium text-text-muted hover:border-text-muted hover:bg-surface-muted hover:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <Plus size={14} strokeWidth={1.5} />
        Add discount
      </button>
    );
  }

  // Configured: render the inline editor.
  return (
    <div className="flex items-center gap-2 text-body">
      <span className="text-text-muted">Discount</span>

      {/* Type switch (% / $) */}
      <div className="inline-flex rounded-control border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => onTypeChange('percentage')}
          disabled={!canEdit}
          className={`px-2.5 py-1 text-caption font-medium transition-colors ${
            type === 'percentage'
              ? 'bg-surface-emphasis text-text'
              : 'text-text-muted hover:text-text'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          %
        </button>
        <button
          type="button"
          onClick={() => onTypeChange('fixed')}
          disabled={!canEdit}
          className={`px-2.5 py-1 text-caption font-medium transition-colors border-l border-border ${
            type === 'fixed'
              ? 'bg-surface-emphasis text-text'
              : 'text-text-muted hover:text-text'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          $
        </button>
      </div>

      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
        placeholder={type === 'percentage' ? '10' : '0.00'}
        min="0"
        step={type === 'percentage' ? '1' : '0.01'}
        readOnly={!canEdit}
        disabled={!canEdit}
        className="w-20 rounded-control border border-border bg-surface px-2 py-1 text-body text-text tabular-nums focus:outline-none focus:border-border-strong disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />

      {canEdit ? (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-text-subtle hover:text-danger transition-colors cursor-pointer"
          aria-label="Remove discount"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      ) : null}
    </div>
  );
}
