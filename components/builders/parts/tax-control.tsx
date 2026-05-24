/**
 * GST/tax affordance — subtle inline chip.
 *
 * Shows a "+ GST 10%" chip when no tax is applied. Once applied,
 * the same chip flips to its emphasised state with a × icon; click
 * to remove.
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
        className="inline-flex items-center gap-1.5 rounded-control bg-surface-muted px-2.5 py-1 text-caption font-medium text-text-muted hover:bg-surface-emphasis hover:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <Plus size={12} strokeWidth={1.5} />
        GST 10%
      </button>
    );
  }

  // Applied: same shape, slightly stronger background to signal
  // "active". Hover surfaces the danger tone to telegraph removal.
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={!canEdit}
      className="inline-flex items-center gap-1.5 rounded-control bg-surface-emphasis px-2.5 py-1 text-caption font-medium text-text hover:bg-danger/10 hover:text-danger transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <X size={12} strokeWidth={1.5} />
      GST 10%
    </button>
  );
}
