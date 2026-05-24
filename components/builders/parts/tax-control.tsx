/**
 * GST/tax affordance — single chip that smoothly transitions
 * between the unapplied and applied states.
 *
 * The button itself stays mounted; its background tone and the
 * leading icon (Plus ↔ X) crossfade based on `applied`. Both
 * transitions use ~200ms CSS so the state change reads as a
 * deliberate morph rather than an abrupt swap.
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
  return (
    <button
      type="button"
      onClick={applied ? onRemove : onApply}
      disabled={!canEdit}
      aria-label={applied ? 'Remove GST' : 'Apply 10% GST'}
      className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-caption font-medium transition-colors duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
        applied
          ? 'bg-surface-emphasis text-text hover:bg-danger/10 hover:text-danger'
          : 'bg-surface-muted text-text-muted hover:bg-surface-emphasis hover:text-text'
      }`}
    >
      {/* Icon crossfade: both icons share the same slot, opacity
          drives which one shows. ~200ms transition matches the
          background colour change. */}
      <span className="relative inline-flex h-3 w-3 items-center justify-center">
        <Plus
          size={12}
          strokeWidth={1.5}
          className={`absolute inset-0 transition-opacity duration-200 ${
            applied ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <X
          size={12}
          strokeWidth={1.5}
          className={`absolute inset-0 transition-opacity duration-200 ${
            applied ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </span>
      GST 10%
    </button>
  );
}
