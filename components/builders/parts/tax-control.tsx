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
        className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-border-strong bg-transparent px-3 py-1.5 text-caption font-medium text-text-muted hover:border-text-muted hover:bg-surface-muted hover:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <Plus size={14} strokeWidth={1.5} />
        Apply 10% GST
      </button>
    );
  }

  // Applied: solid pill with a clear "Remove" affordance. Background
  // mirrors the success tone of the GST line in the totals so the
  // visual link is obvious.
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={!canEdit}
      className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-muted px-3 py-1.5 text-caption font-medium text-text hover:border-danger hover:text-danger transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <X size={14} strokeWidth={1.5} />
      GST 10%
    </button>
  );
}
