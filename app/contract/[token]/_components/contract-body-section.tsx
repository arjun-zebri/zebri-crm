/**
 * Shared contract-body prose section, rendered identically in both the branded
 * and fallback card variants.
 *
 * The contract body is a server-rendered HTML string (the locked
 * snapshot taken at send-time, with all `{{variable}}` substitution
 * applied). We use the `.contract-content` class so the editor,
 * preview pane, and public surface all render identical typography.
 *
 * The MC countersignature no longer lives here — it moved into
 * `contract-sign-section.tsx` when the sign form was split into its own
 * `contractSign` marker block. This section renders prose only.
 *
 * @module app/contract/[token]/_components/contract-body-section
 */
import type { CSSProperties } from 'react';

import type { ContractBodyBlock } from '@/app/(dashboard)/branding/blocks/types';
import { FONT_STACKS } from '@/lib/branding/fonts';
import { cssTextTransform } from '@/lib/branding/text-case';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { type PublicContract } from './public-contract';

export interface ContractBodySectionProps {
  contract: PublicContract;
  textColor: string;
  mutedColor: string;
}

export function ContractBodySection({
  contract,
  textColor,
  mutedColor,
}: ContractBodySectionProps) {
  const bodyDefaults = roleDefaults(contract, 'body');

  // Contract-scoped typography overrides live on the `contractBody` block. Read
  // them (absent on legacy contracts) and drive the live prose through CSS
  // variables — SETTING a variable ONLY for a property the MC explicitly
  // overrode. Every `.contract-content` rule falls back to its historical
  // hard-coded value, so an un-overridden contract renders byte-identically.
  // Paragraph font-family + size flow through this wrapper's own inline style
  // (there are no vars for them); the rest are `--cc-*` variables.
  const cbBlock = contract.branding_blocks?.find(
    (b): b is ContractBodyBlock => b.type === 'contractBody',
  );
  const bodyStyle = cbBlock?.bodyStyle;
  const subStyle = cbBlock?.subheadingStyle;

  const cssVars: Record<string, string> = {};
  if (bodyStyle?.color) cssVars['--cc-body-color'] = bodyStyle.color;
  if (bodyStyle?.lineHeight != null) cssVars['--cc-body-line-height'] = String(bodyStyle.lineHeight);
  if (bodyStyle?.textTransform) cssVars['--cc-body-case'] = cssTextTransform(bodyStyle.textTransform);
  if (subStyle?.fontFamily) cssVars['--cc-subheading-font'] = FONT_STACKS[subStyle.fontFamily];
  if (subStyle?.fontSize != null) cssVars['--cc-subheading-size'] = `${subStyle.fontSize}px`;
  if (subStyle?.fontWeight != null) cssVars['--cc-subheading-weight'] = String(subStyle.fontWeight);
  if (subStyle?.color) cssVars['--cc-subheading-color'] = subStyle.color;
  if (subStyle?.textTransform) cssVars['--cc-subheading-case'] = cssTextTransform(subStyle.textTransform);

  // Paragraph font + size come from the wrapper (inherited into `<p>`). Fall
  // back to the body role defaults — identical to before when unset.
  const bodyFontFamily = FONT_STACKS[(bodyStyle?.fontFamily ?? bodyDefaults.fontFamily) as never];
  const bodyFontSize = `${bodyStyle?.fontSize ?? bodyDefaults.fontSize}px`;

  return (
    <div className="space-y-8">
      {contract.locked_content_html ? (
        <div
          className="contract-content"
          style={{
            color: textColor,
            fontSize: bodyFontSize,
            fontFamily: bodyFontFamily,
            lineHeight: bodyDefaults.lineHeight,
            ...cssVars,
          } as CSSProperties}
          // The HTML is generated server-side from a TipTap document
          // and sanitised by the renderer — safe to inject.
          dangerouslySetInnerHTML={{ __html: contract.locked_content_html }}
        />
      ) : (
        <p
          style={{
            color: mutedColor,
            fontSize: `${bodyDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            lineHeight: bodyDefaults.lineHeight,
          }}
        >
          No content.
        </p>
      )}
    </div>
  );
}
