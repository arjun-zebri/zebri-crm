/**
 * Selection detail for the chosen option, in three sections: the
 * priced inclusions ("Your package"), the tappable add-on cards
 * ("Add to your day"), and the brand-tinted summary panel with the
 * live total + deposit line.
 *
 * Add-on cards keep a NEUTRAL border whether ticked or not — the
 * checkbox alone carries the brand colour — so a fully pre-ticked
 * list doesn't wash the page in brand borders.
 *
 * In the accepted state the same component renders read-only with the
 * recorded `accepted_addon_selection`, so the couple always sees
 * exactly what they agreed to. Shared by the public page, the
 * composer preview, and the branding editor.
 *
 * @module components/proposal/option-selection
 */
'use client';

import { Check } from 'lucide-react';

import {
  addOnItems,
  baseItems,
  formatCurrency,
  selectionTotal,
  type ProposalViewBranding,
  type PublicProposalOption,
} from '@/lib/payments/proposal-view';

export interface ProposalSelectionProps {
  option: PublicProposalOption;
  selection: Record<string, boolean>;
  onToggle?: ((itemId: string, next: boolean) => void) | undefined;
  /** Read-only rendering (accepted/declined/expired states, previews). */
  locked: boolean;
  /** Section label — "Your package" while active, "Chosen package"
   *  on the accepted receipt. */
  heading: string;
  branding: ProposalViewBranding;
}

export function ProposalSelection({
  option,
  selection,
  onToggle,
  locked,
  heading,
  branding,
}: ProposalSelectionProps) {
  const { brand, textColor, mutedColor, radius, headingFontFamily, headingWeight } = branding;
  const base = baseItems(option);
  const addOns = addOnItems(option);
  const ticked = addOns.filter((item) => !!selection[item.id]);
  const baseTotal = base.reduce((sum, item) => sum + Number(item.amount), 0);
  const total = selectionTotal(option, selection);
  const cardRadius = Math.min(radius, 14);

  return (
    <div className="space-y-8">
      {/* ─── The package ─── */}
      <section>
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: brand }}
        >
          {heading}
        </p>
        <h2
          className="mt-2 text-2xl"
          style={{ color: textColor, fontFamily: headingFontFamily, fontWeight: headingWeight }}
        >
          {option.title}
        </h2>
        {option.description ? (
          <p className="mt-1 text-sm" style={{ color: mutedColor }}>
            {option.description}
          </p>
        ) : null}
        <ul className="mt-4">
          {base.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-4 border-b border-border/60 py-3"
            >
              <span className="flex min-w-0 items-start gap-2.5 text-sm" style={{ color: textColor }}>
                <Check size={14} strokeWidth={2} className="mt-[3px] shrink-0" style={{ color: brand }} />
                <span className="min-w-0">{item.description}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums" style={{ color: mutedColor }}>
                {formatCurrency(Number(item.amount))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ─── Add-ons as tappable cards ─── */}
      {addOns.length > 0 ? (
        <section>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: brand }}
          >
            Add to your day
          </p>
          {!locked ? (
            <p className="mt-1 text-xs" style={{ color: mutedColor }}>
              Tap to include. Your total updates instantly.
            </p>
          ) : null}
          <div className="mt-3 space-y-2.5">
            {addOns.map((item) => {
              const on = !!selection[item.id];
              return (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 border border-border px-4 py-3.5 transition ${
                    locked ? '' : 'cursor-pointer'
                  }`}
                  style={{ borderRadius: cardRadius }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={locked}
                    onChange={(e) => onToggle?.(item.id, e.target.checked)}
                    aria-label={`Include ${item.description}`}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-border disabled:cursor-not-allowed"
                    style={{ accentColor: brand }}
                  />
                  <span className="min-w-0 flex-1 text-sm" style={{ color: textColor }}>
                    {item.description}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums" style={{ color: mutedColor }}>
                    +{formatCurrency(Number(item.amount))}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ─── Summary panel ─── */}
      <div
        className="p-5"
        style={{
          borderRadius: radius,
          backgroundColor: `color-mix(in srgb, ${brand} 6%, transparent)`,
        }}
      >
        <div className="flex items-baseline justify-between gap-4 text-sm" style={{ color: textColor }}>
          <span className="min-w-0 truncate">{option.title}</span>
          <span className="shrink-0 tabular-nums">{formatCurrency(baseTotal)}</span>
        </div>
        {ticked.map((item) => (
          <div
            key={item.id}
            className="mt-1.5 flex items-baseline justify-between gap-4 text-sm"
            style={{ color: mutedColor }}
          >
            <span className="min-w-0 truncate">{item.description}</span>
            <span className="shrink-0 tabular-nums">+{formatCurrency(Number(item.amount))}</span>
          </div>
        ))}
        <div
          className="mt-4 flex items-baseline justify-between gap-4 pt-3"
          style={{ borderTop: `1px solid color-mix(in srgb, ${brand} 18%, transparent)` }}
        >
          <span className="text-sm font-semibold" style={{ color: textColor }}>
            Total{' '}
            <span className="font-normal" style={{ color: mutedColor }}>
              {option.gst_inclusive ? 'GST incl.' : '+ GST'}
            </span>
          </span>
          <span
            className="text-3xl tabular-nums"
            style={{ color: textColor, fontFamily: headingFontFamily, fontWeight: headingWeight }}
          >
            {formatCurrency(total)}
          </span>
        </div>
        {option.deposit_percent || !option.gst_inclusive ? (
          <p className="mt-2 text-xs" style={{ color: mutedColor }}>
            {option.deposit_percent
              ? `${formatCurrency((total * Number(option.deposit_percent)) / 100)} deposit reserves your date`
              : ''}
            {option.deposit_percent && !option.gst_inclusive ? ' · ' : ''}
            {!option.gst_inclusive ? 'GST is added on the invoice' : ''}
          </p>
        ) : null}
      </div>
    </div>
  );
}
