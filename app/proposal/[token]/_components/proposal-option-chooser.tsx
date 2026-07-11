/**
 * Option chooser — the couple picks between the MC's package options.
 *
 * One selectable card per option (title, pitch, inclusion count,
 * "from" base price). Rendered only for multi-option proposals; a
 * single-option proposal skips straight to the selection detail.
 * Radio semantics for screen readers.
 *
 * @module app/proposal/[token]/_components/proposal-option-chooser
 */
'use client';

import { formatCurrency, type PublicProposalOption, baseItems } from './public-proposal';

export interface ProposalOptionChooserProps {
  options: PublicProposalOption[];
  chosenId: string | null;
  onChoose: (optionId: string) => void;
  disabled: boolean;
  brand: string;
  textColor: string;
  mutedColor: string;
  radius: number;
}

export function ProposalOptionChooser({
  options,
  chosenId,
  onChoose,
  disabled,
  brand,
  textColor,
  mutedColor,
  radius,
}: ProposalOptionChooserProps) {
  return (
    <div role="radiogroup" aria-label="Choose your package">
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: brand }}
      >
        Choose your package
      </p>
      <p className="mt-1 mb-3 text-xs" style={{ color: mutedColor }}>
        Tap the one that fits your day best.
      </p>
      <div className="space-y-2.5">
      {options.map((option) => {
        const chosen = option.id === chosenId;
        const inclusions = baseItems(option).length;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={chosen}
            disabled={disabled}
            onClick={() => onChoose(option.id)}
            className="w-full border p-4 text-left transition cursor-pointer disabled:cursor-not-allowed"
            style={{
              borderRadius: radius,
              borderColor: chosen ? brand : 'var(--color-border, #e5e7eb)',
              boxShadow: chosen ? `0 0 0 1px ${brand}` : undefined,
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-semibold" style={{ color: textColor }}>
                {option.title}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: textColor }}>
                {formatCurrency(Number(option.subtotal))}
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs" style={{ color: mutedColor }}>
                {option.description ||
                  `${String(inclusions)} inclusion${inclusions !== 1 ? 's' : ''}`}
              </span>
              <span className="shrink-0 text-xs" style={{ color: mutedColor }}>
                {option.gst_inclusive ? 'GST incl.' : '+ GST'}
              </span>
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}
