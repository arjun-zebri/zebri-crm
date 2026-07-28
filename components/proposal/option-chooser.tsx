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

import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import { EditableLabel } from '@/components/proposal/editable-label';
import { getTextColor } from '@/lib/branding/contrast';
import { applyCase, cssTextTransform } from '@/lib/branding/text-case';
import { FONT_STACKS } from '@/lib/branding/fonts';
import { PROPOSAL_LABEL_DEFAULTS, type ProposalLabelEdit } from '@/lib/branding/proposal-labels';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { roleDefaults } from '@/lib/branding/type-defaults';
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
  publicBranding: PublicBranding;
  onEditLabel?: ProposalLabelEdit | undefined;
}

export function ProposalOptionChooser({
  options,
  chosenId,
  onChoose,
  disabled,
  branding,
  publicBranding,
  onEditLabel,
}: ProposalOptionChooserProps) {
  const { brand, accent, mutedColor, headingColor, subheadingColor, headingFontFamily, headingWeight, labels } =
    branding;
  const radius = Math.min(branding.radius, 12);
  const sectionLabelDefaults = roleDefaults(publicBranding, 'sectionLabel');
  const bodyDefaults = roleDefaults(publicBranding, 'body');
  const finePrintDefaults = roleDefaults(publicBranding, 'finePrint');
  const sectionHeadingDefaults = roleDefaults(publicBranding, 'sectionHeading');
  const totalDefaults = roleDefaults(publicBranding, 'total');
  return (
    <div role="radiogroup" aria-label="Choose your package">
      <EditableLabel
        as="p"
        value={applyCase(labels.choose.text, sectionLabelDefaults.textTransform)}
        onCommit={onEditLabel && ((v) => onEditLabel('choose', v))}
        placeholder={PROPOSAL_LABEL_DEFAULTS.choose.text}
        cornerRadius={branding.cornerRadius}
        className="font-semibold"
        style={{
          fontSize: `${sectionLabelDefaults.fontSize}px`,
          color: sectionLabelDefaults.color,
          fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
          fontWeight: sectionLabelDefaults.fontWeight,
          lineHeight: sectionLabelDefaults.lineHeight,
          letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
          textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
          ...resolveTextStyle(labels.choose.style, {
            fontFamily: 'work_sans',
            fontSize: sectionLabelDefaults.fontSize,
            fontWeight: sectionLabelDefaults.fontWeight,
            color: sectionLabelDefaults.color,
            align: 'left',
            lineHeight: sectionLabelDefaults.lineHeight,
            letterSpacing: sectionLabelDefaults.letterSpacing,
          }),
        }}
      />
      <EditableLabel
        as="p"
        value={applyCase(labels.chooseHint.text, bodyDefaults.textTransform)}
        onCommit={onEditLabel && ((v) => onEditLabel('chooseHint', v))}
        placeholder={PROPOSAL_LABEL_DEFAULTS.chooseHint.text}
        cornerRadius={branding.cornerRadius}
        className="mt-1 mb-4"
        style={{
          fontSize: `${bodyDefaults.fontSize}px`,
          color: bodyDefaults.color,
          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
          fontWeight: bodyDefaults.fontWeight,
          lineHeight: bodyDefaults.lineHeight,
          letterSpacing: `${bodyDefaults.letterSpacing}px`,
          textTransform: cssTextTransform(bodyDefaults.textTransform),
          ...resolveTextStyle(labels.chooseHint.style, {
            fontFamily: 'work_sans',
            fontSize: bodyDefaults.fontSize,
            fontWeight: bodyDefaults.fontWeight,
            color: bodyDefaults.color,
            align: 'left',
            lineHeight: bodyDefaults.lineHeight,
            letterSpacing: bodyDefaults.letterSpacing,
          }),
        }}
      />
      <div className="space-y-4">
        {options.map((option) => {
          const chosen = option.id === chosenId;
          const summary = baseItems(option)
            .map((i) => i.description)
            .join(' · ');
          // The "most popular" highlight uses the ACCENT colour so it
          // reads as a distinct flag, separate from the primary
          // selection state (ring + border).
          const popular = option.is_popular;
          return (
            <div key={option.id} className="relative">
              {popular ? (
                <span
                  className="absolute -top-2.5 left-5 z-10 rounded-full px-3 py-1 font-semibold uppercase tracking-[0.12em]"
                  style={{
                    // Chip affordance (visual UI element, not document text):
                    // keeps uppercase + tracking for visual distinction.
                    fontSize: `${sectionLabelDefaults.fontSize}px`,
                    backgroundColor: accent,
                    color: getTextColor(accent),
                  }}
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
                  borderColor: chosen ? brand : popular ? accent : branding.borderColor,
                  boxShadow: chosen ? `0 0 0 1px ${brand}` : undefined,
                  backgroundColor: popular
                    ? `color-mix(in srgb, ${accent} 6%, transparent)`
                    : undefined,
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Ring radio */}
                  <span
                    className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                    style={{ borderColor: chosen ? brand : branding.borderColor }}
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
                        className="min-w-0"
                        style={{
                          fontSize: `${sectionHeadingDefaults.fontSize}px`,
                          color: headingColor,
                          fontFamily: headingFontFamily,
                          fontWeight: headingWeight,
                        }}
                      >
                        {option.title}
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className="block tabular-nums"
                          style={{
                            fontSize: `${totalDefaults.fontSize}px`,
                            color: headingColor,
                            fontFamily: headingFontFamily,
                            fontWeight: headingWeight,
                          }}
                        >
                          {formatCurrency(Number(option.subtotal))}
                        </span>
                        <span className="block" style={{ fontSize: `${finePrintDefaults.fontSize}px`, color: mutedColor }}>
                          base price
                        </span>
                      </span>
                    </div>
                    {option.description ? (
                      <p className="mt-1" style={{ fontSize: `${bodyDefaults.fontSize}px`, color: subheadingColor }}>
                        {option.description}
                      </p>
                    ) : null}
                    {summary ? (
                      <p className="mt-3" style={{ fontSize: `${bodyDefaults.fontSize}px`, color: subheadingColor }}>
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
