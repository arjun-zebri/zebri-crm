/**
 * GST/tax chip — text-only label that opens a Popover with a rate
 * input, a "Prices include GST" checkbox, and Remove / Done buttons.
 *
 * The chip stays minimal, and reads as one of four states:
 * - "Tax" — nothing configured.
 * - "GST 10%" — a rate applies and is added on top.
 * - "GST incl.", no rate, just the note. This is the common case for
 *   MCs whose advertised prices are GST-inclusive.
 *
 * The rate and "Prices include GST" checkbox are mutually exclusive to
 * prevent double-charging: if a rate is set, the checkbox is disabled
 * and cannot be ticked. If the checkbox is ticked, the rate input is
 * disabled and the rate is cleared. This prevents an invoice from both
 * adding GST as a line item and claiming prices already include it.
 *
 * The popover lets the user change the rate (default 10% but
 * configurable for users in other jurisdictions / non-standard
 * scenarios).
 *
 * `gstInclusive` is a DISPLAY flag: it never changes the total, it
 * only decides whether surfaces render a "Prices include GST" note
 * under the total.
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
import { Checkbox } from '@/components/ui/checkbox';

export interface TaxControlProps {
  /** Current tax rate as a percentage. `null` = no tax applied. */
  rate: number | null;
  /** Locks editing. */
  canEdit: boolean;
  /** Fires with the new rate (or `null` when removed). */
  onChange: (next: number | null) => void;
  /** Whether the line-item prices already include GST. Display only. */
  gstInclusive?: boolean | undefined;
  /** Fires when the "Prices include GST" checkbox is toggled. Omit to
   *  hide the checkbox entirely (surfaces that don't store the flag). */
  onGstInclusiveChange?: ((next: boolean) => void) | undefined;
}

const DEFAULT_RATE = 10;

export function TaxControl({
  rate,
  canEdit,
  onChange,
  gstInclusive = false,
  onGstInclusiveChange,
}: TaxControlProps) {
  const [open, setOpen] = useState(false);
  // Local draft so the popover's input doesn't ping the parent on
  // every keystroke. Reseeded from `rate` on each open.
  //
  // An unset rate seeds BLANK, not 10. Pre-filling the default would
  // mean an MC who opened the popover only to tick "Prices include GST"
  // would apply a 10% GST line on Done without ever asking for one.
  // The placeholder still advertises 10 as the expected value.
  const [draft, setDraft] = useState<string>(rate != null ? String(rate) : '');

  // Committed state: whether a rate is currently saved (shown on the chip).
  const applied = rate !== null;

  // Draft state: whether the MC is typing a rate that would be committed on Done.
  // Parse the draft to see if there's a valid positive number. We use this for
  // the checkbox's disabled state and helper text so the checkbox responds LIVE
  // as the MC types or clears the field, even though the actual rate value only
  // commits when Done is clicked. The chip and "Remove" button still key off the
  // committed `applied` flag so they show the saved state, not the in-flight draft.
  const draftHasRate = (() => {
    const parsed = parseFloat(draft);
    return !Number.isNaN(parsed) && parsed > 0;
  })();

  function handleOpenChange(next: boolean) {
    if (next) setDraft(rate != null ? String(rate) : '');
    setOpen(next);
  }

  function commitDraft() {
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed) || parsed <= 0) {
      onChange(null);
    } else {
      const newRate = Math.min(100, parsed);
      onChange(newRate);
      // If gstInclusive is true and we just set a rate, uncheck the box to
      // prevent double-charging (prices cannot both include GST and have a
      // separate tax line added on top).
      if (gstInclusive && onGstInclusiveChange) {
        onGstInclusiveChange(false);
      }
    }
    setOpen(false);
  }

  function handleGstInclusiveToggle(next: boolean) {
    onGstInclusiveChange?.(next);
    // If checking the box, clear both the committed rate and the typed draft
    // to prevent double-charging. Prices cannot both include GST and have GST
    // added on top. Clear the draft so no stale number remains in the input
    // that would re-commit if Done is pressed later.
    if (next) {
      if (rate !== null && onChange) {
        onChange(null);
      }
      setDraft('');
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={!canEdit}
          aria-label={applied || gstInclusive ? 'Edit tax settings' : 'Add tax'}
          className={`inline-flex items-center rounded-control px-2.5 py-1 text-body font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
            applied || gstInclusive
              ? 'bg-success/10 text-success hover:bg-success/15'
              : 'bg-surface-muted text-text-muted hover:bg-surface-emphasis hover:text-text'
          }`}
        >
          {applied ? (
            <>
              GST&nbsp;
              <span className="tabular-nums">{Math.round(rate ?? 0)}%</span>
              {gstInclusive ? <>&nbsp;incl.</> : null}
            </>
          ) : gstInclusive ? (
            'GST incl.'
          ) : (
            'Tax'
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[90] w-64 rounded-control border border-border bg-surface shadow-lg p-3 animate-fade-in"
        >
          <p className="mb-3 text-body font-medium uppercase tracking-wide text-text-muted">
            Tax
          </p>

          <label className="mb-3 block">
            <span className="mb-1 block text-body text-text-muted">Rate</span>
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
                placeholder={String(DEFAULT_RATE)}
                aria-label="Tax rate percentage"
                disabled={gstInclusive}
                className="w-full rounded-control border border-border bg-surface px-3 py-1.5 pr-8 text-body text-text focus:outline-none focus:border-border-strong [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body text-text-subtle">
                %
              </span>
            </div>
            <span className="mt-1.5 block text-body text-text-subtle">
              {gstInclusive
                ? 'Leave blank when prices already include GST.'
                : 'Australian GST is 10%. Leave blank for none.'}
            </span>
          </label>

          {onGstInclusiveChange ? (
            <div className="mb-3 border-t border-border pt-3">
              <Checkbox
                checked={gstInclusive}
                onChange={handleGstInclusiveToggle}
                label="Prices include GST"
                disabled={draftHasRate}
              />
              <span className="mt-1.5 block text-body text-text-subtle">
                {draftHasRate
                  ? 'GST is being added on top, so prices cannot also include it.'
                  : 'Tells the couple the price already covers GST.'}
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            {applied ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-body text-text-muted hover:text-danger transition-colors cursor-pointer"
              >
                Remove
              </button>
            ) : (
              <span />
            )}
            <Button onClick={commitDraft}>
              Done
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
