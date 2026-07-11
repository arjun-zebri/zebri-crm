/**
 * Option chooser — the couple picks between the MC's package options.
 *
 * One radio-card per option: a ring radio, the package title in the
 * branding heading font, a "base price" figure on the right, the
 * pitch, and an inclusions summary. The MC's "most popular" pick gets
 * a brand-tinted card + an overlaid "MOST POPULAR" badge — rendered
 * here only, where more than one option exists to compare against.
 *
 * Rendered only for multi-option proposals; a single-option proposal
 * skips straight to the selection detail. Radio semantics for screen
 * readers. Shared by the public page, the composer preview, and the
 * branding editor (one layout, three surfaces).
 *
 * @module components/proposal/option-chooser
 */
'use client';

import { getTextColor } from '@/lib/branding/contrast';
import {
  baseItems,
  formatCurrency,
  type ProposalViewBranding,
  type PublicProposalOption,
} from '@/lib/payments/proposal-view';

export interface ProposalOptionChooserProps {
  options: PublicProposalOption[];
  chosenId: string | null;
  onChoose?: ((optionId: string) => void) | undefined;
  disabled: boolean;
  branding: ProposalViewBranding;
}

export function ProposalOptionChooser({
  options,
  chosenId,
  onChoose,
  disabled,
  branding,
}: ProposalOptionChooserProps) {
  const { brand, textColor, mutedColor, headingFontFamily, headingWeight } = branding;
  const radius = Math.min(branding.radius, 12);
  return (
    <div role="radiogroup" aria-label="Choose your package">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: brand }}>
        Choose your package
      </p>
      <p className="mt-1 mb-4 text-sm" style={{ color: mutedColor }}>
        Select the one that fits your day. Everything updates below.
      </p>
      <div className="space-y-4">
        {options.map((option) => {
          const chosen = option.id === chosenId;
          const summary = baseItems(option)
            .map((i) => i.description)
            .join(' · ');
          const popular = option.is_popular;
          return (
            <div key={option.id} className="relative">
              {popular ? (
                <span
                  className="absolute -top-2.5 left-5 z-10 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{ backgroundColor: brand, color: getTextColor(brand) }}
                >
                  Most popular
                </span>
              ) : null}
              <button
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={disabled}
                onClick={() => onChoose?.(option.id)}
                className="w-full border p-5 text-left transition cursor-pointer disabled:cursor-not-allowed"
                style={{
                  borderRadius: radius,
                  borderColor: chosen || popular ? brand : 'var(--color-border, #e5e7eb)',
                  boxShadow: chosen ? `0 0 0 1px ${brand}` : undefined,
                  backgroundColor: popular
                    ? `color-mix(in srgb, ${brand} 6%, transparent)`
                    : undefined,
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Ring radio */}
                  <span
                    className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                    style={{ borderColor: chosen ? brand : 'var(--color-border, #d1d5db)' }}
                  >
                    {chosen ? (
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: brand }}
                      />
                    ) : null}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <span
                        className="min-w-0 text-xl"
                        style={{
                          color: textColor,
                          fontFamily: headingFontFamily,
                          fontWeight: headingWeight,
                        }}
                      >
                        {option.title}
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className="block text-2xl tabular-nums"
                          style={{
                            color: textColor,
                            fontFamily: headingFontFamily,
                            fontWeight: headingWeight,
                          }}
                        >
                          {formatCurrency(Number(option.subtotal))}
                        </span>
                        <span className="block text-xs" style={{ color: mutedColor }}>
                          base price
                        </span>
                      </span>
                    </div>
                    {option.description ? (
                      <p className="mt-1 text-sm" style={{ color: mutedColor }}>
                        {option.description}
                      </p>
                    ) : null}
                    {summary ? (
                      <p className="mt-3 text-sm" style={{ color: mutedColor }}>
                        {summary}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
