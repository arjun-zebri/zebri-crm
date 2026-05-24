/**
 * GST/tax chip — text-only label that opens a Popover with a rate
 * input + Remove / Done buttons.
 *
 * The chip stays minimal — "Tax" when not configured, "GST 10%"
 * (or whatever rate the user set) in the success tone when applied.
 * The popover lets the user change the rate (default 10% but
 * configurable for users in other jurisdictions / non-standard
 * scenarios).
 *
 * API: `rate` is `null` when no GST applies. A positive number is
 * the percentage. `onChange` carries the new rate (or `null` to
 * remove).
 *
 * @module components/builders/parts/tax-control
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export interface TaxControlProps {
  /** Current tax rate as a percentage. `null` = no tax applied. */
  rate: number | null;
  /** Locks editing. */
  canEdit: boolean;
  /** Fires with the new rate (or `null` when removed). */
  onChange: (next: number | null) => void;
}

const DEFAULT_RATE = 10;

export function TaxControl({ rate, canEdit, onChange }: TaxControlProps) {
  const [open, setOpen] = useState(false);
  // Local draft so the popover's input doesn't ping the parent on
  // every keystroke. Reseeded from `rate` on each open by way of
  // the `key` on the input below, so we avoid an effect.
  const [draft, setDraft] = useState<string>(String(rate ?? DEFAULT_RATE));

  const applied = rate !== null;

  function handleTriggerClick() {
    if (!canEdit) return;
    // First click seeds the default rate so the popover shows
    // something useful immediately.
    if (!applied) onChange(DEFAULT_RATE);
  }

  function handleOpenChange(next: boolean) {
    if (next) setDraft(String(rate ?? DEFAULT_RATE));
    setOpen(next);
  }

  function commitDraft() {
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed) || parsed <= 0) {
      onChange(null);
    } else {
      onChange(Math.min(100, parsed));
    }
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={handleTriggerClick}
          disabled={!canEdit}
          aria-label={applied ? 'Edit tax rate' : 'Add tax'}
          className={`inline-flex items-center rounded-control px-2.5 py-1 text-caption font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
            applied
              ? 'bg-success/10 text-success hover:bg-success/15'
              : 'bg-surface-muted text-text-muted hover:bg-surface-emphasis hover:text-text'
          }`}
        >
          {applied ? (
            <>
              GST&nbsp;
              <span className="tabular-nums">{Math.round(rate ?? 0)}%</span>
            </>
          ) : (
            'Tax'
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[90] w-64 rounded-card border border-border bg-surface shadow-lg p-3 animate-fade-in"
        >
          <p className="mb-3 text-caption font-medium uppercase tracking-wide text-text-muted">
            Tax rate
          </p>

          <label className="mb-3 block">
            <span className="mb-1 block text-caption text-text-muted">Rate</span>
            <div className="relative">
              <input
                type="number"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitDraft();
                }}
                min="0"
                max="100"
                step="0.5"
                aria-label="Tax rate percentage"
                className="w-full rounded-control border border-border bg-surface px-3 py-1.5 pr-8 text-body text-text focus:outline-none focus:border-border-strong [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body text-text-subtle">
                %
              </span>
            </div>
            <span className="mt-1.5 block text-caption text-text-subtle">
              Default is 10% (Australian GST). Set 0 to remove.
            </span>
          </label>

          <div className="flex items-center justify-between">
            {applied ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-caption text-text-muted hover:text-danger transition-colors cursor-pointer"
              >
                Remove
              </button>
            ) : (
              <span />
            )}
            <Button size="sm" onClick={commitDraft}>
              Done
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
