'use client';

import { ColorField } from '@/components/ui-v2/color-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { FileDrop } from '@/components/ui-v2/file-drop';

import { FONTS, fontStack } from '../../../onboarding/demo-data';
import type { Brand } from '../../../onboarding/use-onboarding-state';

/**
 * The proposal editor's brand fields: a logo, a brand and an accent
 * colour, and a heading and body font, each landing on the page beside
 * it as it changes. Set once here; every document after wears it
 * (contracts and invoices too), which the editor's intro line says.
 *
 * The logo is read to a data URL rather than an object URL, so it
 * survives the reload the saved account allows.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/brand-panel
 */

const FONT_OPTIONS = FONTS.map((f) => ({ value: f, label: f, fontFamily: fontStack(f) }));

export interface BrandPanelProps {
  brand: Brand;
  onBrand: (patch: Partial<Brand>) => void;
}

/** The Brand tab. See {@link BrandPanelProps}. */
export function BrandPanel({ brand, onBrand }: BrandPanelProps) {
  function readLogo(file: File) {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && onBrand({ logoUrl: reader.result });
    reader.readAsDataURL(file);
  }
  return (
    <div className="space-y-5">
      <FileDrop
        label="Logo"
        help={brand.logoUrl ? 'On the page now. Drop another to change it.' : undefined}
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        onFile={readLogo}
      />
      <ColorField label="Brand colour" value={brand.primary} onChange={(primary) => onBrand({ primary })} />
      <ColorField label="Accent colour" value={brand.secondary} onChange={(secondary) => onBrand({ secondary })} />
      {/* Each font listed in its own face, so the MC picks by eye. */}
      <Dropdown label="Heading font" options={FONT_OPTIONS} value={brand.headingFont} onChange={(headingFont) => onBrand({ headingFont })} />
      <Dropdown label="Body font" options={FONT_OPTIONS} value={brand.bodyFont} onChange={(bodyFont) => onBrand({ bodyFont })} />
    </div>
  );
}
