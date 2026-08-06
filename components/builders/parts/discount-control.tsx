/**
 * Discount chip — text-only label that opens a Popover with the
 * real form controls (segmented type switcher + value input +
 * Remove / Done buttons).
 *
 * The chip itself stays minimal — "Discount" when not configured,
 * "Discount 10%" / "Discount $100" in the success tone when set.
 * All editing happens inside the popover so the row doesn't grow
 * or shift while the user is adjusting values.
 *
 * @module components/builders/parts/discount-control
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

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

function formatChipValue(type: DiscountType, value: number | null): string {
  const v = value ?? 0;
  return type === 'percentage' ? `${Math.round(v)}%` : `$${v.toFixed(2)}`;
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
  const [open, setOpen] = useState(false);
  const applied = type !== null;

  function handleTriggerClick() {
    if (!canEdit) return;
    // First click on an un-configured chip seeds the default (10%)
    // so the popover has something to show; the user just tunes it.
    if (!applied) onAdd();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={handleTriggerClick}
          disabled={!canEdit}
          aria-label={applied ? 'Edit discount' : 'Add discount'}
          className={`inline-flex items-center rounded-control px-2.5 py-1 text-caption font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
            applied
              ? 'bg-success/10 text-success hover:bg-success/15'
              : 'bg-surface-muted text-text-muted hover:bg-surface-emphasis hover:text-text'
          }`}
        >
          {applied ? (
            <>
              Discount&nbsp;
              <span className="tabular-nums">{formatChipValue(type, value)}</span>
            </>
          ) : (
            'Discount'
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[90] w-64 rounded-control border border-border bg-surface shadow-lg p-3 animate-fade-in"
        >
          <p className="mb-3 text-caption font-medium uppercase tracking-wide text-text-muted">
            Discount
          </p>

          {/* Type segmented control */}
          <div className="mb-3 inline-flex w-full rounded-control border border-border bg-surface overflow-hidden">
            <button
              type="button"
              onClick={() => onTypeChange('percentage')}
              className={`flex-1 px-2.5 py-1.5 text-caption font-medium transition-colors ${
                type === 'percentage' || type === null
                  ? 'bg-surface-emphasis text-text'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Percentage
            </button>
            <button
              type="button"
              onClick={() => onTypeChange('fixed')}
              className={`flex-1 px-2.5 py-1.5 text-caption font-medium border-l border-border transition-colors ${
                type === 'fixed'
                  ? 'bg-surface-emphasis text-text'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Fixed
            </button>
          </div>

          {/* Value input */}
          <label className="mb-3 block">
            <span className="mb-1 block text-caption text-text-muted">Amount</span>
            <div className="relative">
              {type === 'fixed' ? (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body text-text-subtle">
                  $
                </span>
              ) : null}
              <input
                type="number"
                value={value ?? ''}
                onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
                min="0"
                step={type === 'percentage' ? '1' : '0.01'}
                className={`w-full rounded-control border border-border bg-surface py-1.5 text-body text-text focus:outline-none focus:border-border-strong [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  type === 'fixed' ? 'pl-6 pr-3' : 'px-3'
                }`}
                autoFocus
              />
              {type === 'percentage' ? (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body text-text-subtle">
                  %
                </span>
              ) : null}
            </div>
          </label>

          {/* Footer actions */}
          <div className="flex items-center justify-between">
            {applied ? (
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  setOpen(false);
                }}
                className="text-caption text-text-muted hover:text-danger transition-colors cursor-pointer"
              >
                Remove
              </button>
            ) : (
              <span />
            )}
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
