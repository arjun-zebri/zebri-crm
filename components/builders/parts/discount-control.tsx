/**
 * Discount chip — text-only label that expands inline when clicked.
 *
 * - **Not configured**: subtle "Discount" chip (neutral tone, no icons).
 * - **Configured**: same chip but in the success tone (mint green) with
 *   an inline number input + a %/$ toggle + a remove ×. No icon
 *   prefix on either state.
 *
 * The parent wraps this + sibling chips in a `useAutoAnimate()`
 * container so the width change between states is interpolated
 * smoothly by FormKit's drop-in layout animation.
 *
 * @module components/builders/parts/discount-control
 */
'use client';

import { X } from 'lucide-react';

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
  // Not configured: subtle text-only chip.
  if (type === null) {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={!canEdit}
        className="inline-flex items-center rounded-control bg-surface-muted px-2.5 py-1 text-caption font-medium text-text-muted transition-colors duration-200 hover:bg-surface-emphasis hover:text-text disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        Discount
      </button>
    );
  }

  function toggleType() {
    onTypeChange(type === 'percentage' ? 'fixed' : 'percentage');
  }

  // Configured: success tone (mint green) chip with inline editor.
  return (
    <span className="inline-flex items-center gap-1.5 rounded-control bg-success/10 pl-2.5 pr-1 py-1 text-caption font-medium text-success transition-colors duration-200">
      <span>Discount</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
        min="0"
        step={type === 'percentage' ? '1' : '0.01'}
        readOnly={!canEdit}
        disabled={!canEdit}
        aria-label="Discount value"
        className="w-10 bg-transparent text-right text-caption font-medium text-success tabular-nums focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={toggleType}
        disabled={!canEdit}
        aria-label={`Switch to ${type === 'percentage' ? 'fixed amount' : 'percentage'}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-success/70 transition-colors hover:bg-success/10 hover:text-success disabled:opacity-50 cursor-pointer"
      >
        {type === 'percentage' ? '%' : '$'}
      </button>
      {canEdit ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove discount"
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-success/70 transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
        >
          <X size={11} strokeWidth={1.5} />
        </button>
      ) : null}
    </span>
  );
}
