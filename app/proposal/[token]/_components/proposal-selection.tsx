/**
 * Selection detail for the chosen option: the inclusions list, the
 * add-on toggles (seeded from the MC's pre-ticks, editable while the
 * proposal is active), and the live total.
 *
 * In the accepted state the same component renders read-only with the
 * recorded `accepted_addon_selection`, so the couple always sees
 * exactly what they agreed to.
 *
 * @module app/proposal/[token]/_components/proposal-selection
 */
'use client';

import { Check } from 'lucide-react';

import {
  addOnItems,
  baseItems,
  formatCurrency,
  selectionTotal,
  type PublicProposalOption,
} from './public-proposal';

export interface ProposalSelectionProps {
  option: PublicProposalOption;
  selection: Record<string, boolean>;
  onToggle: (itemId: string, next: boolean) => void;
  /** Read-only rendering (accepted/declined/expired states). */
  locked: boolean;
  brand: string;
  textColor: string;
  mutedColor: string;
}

export function ProposalSelection({
  option,
  selection,
  onToggle,
  locked,
  brand,
  textColor,
  mutedColor,
}: ProposalSelectionProps) {
  const base = baseItems(option);
  const addOns = addOnItems(option);
  const total = selectionTotal(option, selection);

  return (
    <div>
      <p
        className="pb-2 text-xs font-medium uppercase tracking-wider border-b border-border"
        style={{ color: mutedColor }}
      >
        What&apos;s included
      </p>
      <ul>
        {base.map((item) => (
          <li
            key={item.id}
            className="flex items-baseline justify-between gap-4 border-b border-border/50 py-3"
          >
            <span className="flex min-w-0 items-start gap-2 text-sm" style={{ color: textColor }}>
              <Check size={14} strokeWidth={1.5} className="mt-[3px] shrink-0" style={{ color: brand }} />
              <span className="min-w-0">{item.description}</span>
            </span>
            <span className="shrink-0 text-sm tabular-nums" style={{ color: mutedColor }}>
              {formatCurrency(Number(item.amount))}
            </span>
          </li>
        ))}
      </ul>

      {addOns.length > 0 ? (
        <div className="mt-5">
          <p
            className="pb-2 text-xs font-medium uppercase tracking-wider border-b border-border"
            style={{ color: mutedColor }}
          >
            Optional extras
          </p>
          <ul>
            {addOns.map((item) => {
              const ticked = !!selection[item.id];
              return (
                <li key={item.id} className="border-b border-border/50">
                  <label
                    className={`flex items-center justify-between gap-4 py-3 ${
                      locked ? '' : 'cursor-pointer'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5 text-sm" style={{ color: textColor }}>
                      <input
                        type="checkbox"
                        checked={ticked}
                        disabled={locked}
                        onChange={(e) => onToggle(item.id, e.target.checked)}
                        aria-label={`Include ${item.description}`}
                        className="h-4 w-4 shrink-0 cursor-pointer rounded border-border disabled:cursor-not-allowed"
                        style={{ accentColor: brand }}
                      />
                      <span className="min-w-0">{item.description}</span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums" style={{ color: mutedColor }}>
                      +{formatCurrency(Number(item.amount))}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
        <span className="text-sm font-semibold" style={{ color: textColor }}>
          Total{option.gst_inclusive ? ' (GST incl.)' : ''}
        </span>
        <span className="text-lg font-semibold tabular-nums" style={{ color: textColor }}>
          {formatCurrency(total)}
        </span>
      </div>
      {!option.gst_inclusive ? (
        <p className="mt-1 text-right text-xs" style={{ color: mutedColor }}>
          GST will be added on the invoice.
        </p>
      ) : null}
      {option.deposit_percent ? (
        <p className="mt-1 text-right text-xs" style={{ color: mutedColor }}>
          {option.deposit_percent}% deposit secures your date.
        </p>
      ) : null}
    </div>
  );
}
