/**
 * GST/tax affordance — collapsed link or "Remove" affordance.
 *
 * Shows "+ Apply 10% GST" when no tax is applied. Once applied, the
 * tax line appears in the totals panel; this control morphs into a
 * small "Remove GST" link.
 *
 * @module components/builders/parts/tax-control
 */
'use client';

import { Plus, X } from 'lucide-react';

export interface TaxControlProps {
  /** Whether the 10% GST line is currently applied. */
  applied: boolean;
  /** Locks editing. */
  canEdit: boolean;
  onApply: () => void;
  onRemove: () => void;
}

export function TaxControl({ applied, canEdit, onApply, onRemove }: TaxControlProps) {
  if (!applied) {
    return (
      <button
        type="button"
        onClick={onApply}
        disabled={!canEdit}
        className="inline-flex items-center gap-1.5 text-body text-text-muted hover:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <Plus size={14} strokeWidth={1.5} />
        Apply 10% GST
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={!canEdit}
      className="inline-flex items-center gap-1.5 text-body text-text-muted hover:text-danger transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <X size={14} strokeWidth={1.5} />
      Remove GST
    </button>
  );
}
