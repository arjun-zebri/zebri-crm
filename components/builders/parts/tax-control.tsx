/**
 * GST/tax chip — text-only label that opens a Popover with a rate
 * input, a "Prices include GST" checkbox, and Remove / Done buttons.
 *
 * The chip stays minimal, and reads as one of four states:
 * - "Tax" — nothing configured.
 * - "GST 10%" — a rate applies and is added on top.
 * - "GST 10% incl." — a rate applies and the couple is also told the
 *   prices include GST.
 * - "GST incl." — no rate line, just the note. This is the common
 *   case for an MC whose advertised prices are GST-inclusive, and
 *   it's what applying a GST-inclusive package now produces.
 *
 * The popover lets the user change the rate (default 10% but
 * configurable for users in other jurisdictions / non-standard
 * scenarios).
 *
 * `gstInclusive` is a DISPLAY flag: it never changes a total, it only
 * decides whether surfaces render a "Prices include GST" note under
 * the total. Because it's independent of `rate`, an MC can technically
 * set a rate AND tick the box, which produces a document that both
 * adds GST and says prices include it. The popover hint spells that
 * out rather than blocking the combination, since a rate of 0 with the
 * note is the far more common intent.
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

  const applied = rate !== null;

  function handleOpenChange(next: boolean) {
    if (next) setDraft(rate != null ? String(rate) : '');
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
                className="w-full rounded-control border border-border bg-surface px-3 py-1.5 pr-8 text-body text-text focus:outline-none focus:border-border-strong [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body text-text-subtle">
                %
              </span>
            </div>
            <span className="mt-1.5 block text-body text-text-subtle">
              Australian GST is 10%. Leave blank for none.
            </span>
          </label>

          {onGstInclusiveChange ? (
            <div className="mb-3 border-t border-border pt-3">
              <Checkbox
                checked={gstInclusive}
                onChange={onGstInclusiveChange}
                label="Prices include GST"
              />
              <span className="mt-1.5 block text-body text-text-subtle">
                Tells the couple the price already covers GST. Any rate set
                above is still added on top.
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
