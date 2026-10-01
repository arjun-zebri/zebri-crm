'use client';

import { useEffect, useRef } from 'react';

import { ColorField } from '@/components/ui-v2/color-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { FileDrop } from '@/components/ui-v2/file-drop';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { BrandPreview } from './brand-preview';
import { FONTS, fontStack } from './demo-data';
import type { DemoPackage } from './packages';
import type { Brand } from './use-onboarding-state';

/**
 * Step 4, Your brand: the MC's proposal on a canvas that runs edge to
 * edge under the step's title, and a narrow sidebar of the few choices
 * that make it theirs: a logo, a brand and an accent colour, and a
 * heading and body font. Kept to these on purpose: set once, the
 * brand carries through every document, and the layout itself is
 * designed later in the proposal builder.
 *
 * Fills the step's height (the flow gives this step the whole width;
 * see `bleed` in steps-meta), so the canvas gets every spare pixel.
 *
 * @module app/design-system/v2/pages/onboarding/step-brand
 */

export interface StepBrandProps {
  brand: Brand;
  business: string;
  name: string;
  packages: DemoPackage[];
  deposit: number;
  onBrand: (patch: Partial<Brand>) => void;
}

const FONT_OPTIONS = FONTS.map((f) => ({ value: f, label: f, fontFamily: fontStack(f) }));

export function StepBrand({ brand, business, name, packages, deposit, onBrand }: StepBrandProps) {
  // Every catalogue font, once, so the preview can show any pick at once.
  useEffect(() => ensureBrandFontsStylesheet(), []);
  const logoUrl = useRef<string | null>(null);
  useEffect(() => () => {
    if (logoUrl.current) URL.revokeObjectURL(logoUrl.current);
  }, []);

  return (
    // Bleeds past the step's padding to the panel's edges and down to the footer.
    <div className="-mx-5 -mb-6 flex min-h-0 flex-1 flex-col border-t border-zebra-200 sm:-mx-12 sm:-mb-9 lg:flex-row">
      <BrandPreview brand={brand} business={business} name={name} packages={packages} deposit={deposit} />
      <aside
        aria-label="Brand settings"
        className="flex shrink-0 flex-col gap-5 border-t border-zebra-200 px-4 py-5 lg:w-52 lg:overflow-y-auto lg:border-t-0 lg:border-l"
      >
        <FileDrop
          label="Logo"
          accept="image/png,image/svg+xml,image/jpeg,image/webp"
          onFile={(file) => {
            if (logoUrl.current) URL.revokeObjectURL(logoUrl.current);
            logoUrl.current = URL.createObjectURL(file);
            onBrand({ logoUrl: logoUrl.current });
          }}
        />
        <ColorField label="Brand colour" value={brand.primary} onChange={(primary) => onBrand({ primary })} />
        <ColorField label="Accent colour" value={brand.secondary} onChange={(secondary) => onBrand({ secondary })} />
        {/* Each font listed in its own face, so the MC picks by eye. */}
        <Dropdown label="Heading font" options={FONT_OPTIONS} value={brand.headingFont} onChange={(headingFont) => onBrand({ headingFont })} />
        <Dropdown label="Body font" options={FONT_OPTIONS} value={brand.bodyFont} onChange={(bodyFont) => onBrand({ bodyFont })} />
      </aside>
    </div>
  );
}
