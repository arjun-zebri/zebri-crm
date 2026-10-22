'use client';

import { useEffect, useState, type CSSProperties } from 'react';

import { ANIMATION_SPEED_MS, pageSurfaceStyle, resolveProposalVariables, resolveTheme } from '@/features/proposals';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';
import type { PublicDocData } from '@/lib/branding/public-blocks/shared';
import type { PublicBranding } from '@/lib/branding/public-branding';

import { BookingLine } from '../doc-types/proposal/booking-line';
import { packagesOn } from '../doc-types/proposal/composed';
import { docBrandVars } from '../look/brand-vars';
import { toProd } from '../model/as-production';
import type { DocLayout, DocSection } from '../model/types';
import { useDocFields } from '../sections/parts/parts';
import type { BookingTerms } from '../state/use-doc-editor';

import { DocSectionView } from './doc-section-view';
import { GalleryPlaceholder, VideoPlaceholder } from './video-placeholder';

/**
 * The couple's page, as they see it: every section through production's
 * renderer, with the booking line under the Accept section. Preview and
 * the sent proposal both show this, so what the MC previews is what goes
 * out, and what went out is what they see later.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/render/couple-page
 */

/** The price most couples are shown first: the popular package, else the first. */
export function leadPrice(layout: DocLayout): number {
  const options = packagesOn(layout);
  return (options.find((o) => o.isPopular) ?? options[0])?.fixedPrice ?? 0;
}

export interface CouplePageProps {
  layout: DocLayout;
  branding: PublicBranding;
  doc: PublicDocData;
  terms: BookingTerms;
  /** `'page'` is live (choices and reveals work); `'print'` is still, for a sent copy. */
  mode: 'page' | 'print';
  /**
   * Show where the MC's own media goes (an empty video hello as a brand
   * slot), for the MC's eyes only: Ready to send and template cards. Off,
   * an empty video is left out, as the couple's page leaves it.
   */
  placeholders?: boolean | undefined;
}

/** Whether `section` is a video with nothing added yet. */
const emptyVideo = (section: DocSection) => section.data?.kind === 'video' && !section.data.video.source;
/** Whether `section` is a gallery with no photos yet. */
const emptyGallery = (section: DocSection) => section.data?.kind === 'gallery' && !section.data.gallery.images.length;

/** The couple's page. See {@link CouplePageProps}. */
export function CouplePage({ layout, branding, doc, terms, mode, placeholders = false }: CouplePageProps) {
  useEffect(() => ensureBrandFontsStylesheet(), []);
  const theme = resolveTheme(toProd(layout), branding);
  // A document with its own fields (a contract's package and fee) fills them on top of the proposal's.
  const fields = useDocFields();
  const values = { ...resolveProposalVariables(branding, doc), ...fields?.values };
  // Live, the couple picks a package and the deposit line follows their pick (2026-10-05 review: it stayed on the popular one).
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = packagesOn(layout).find((o) => o.id === picked);
  const price = chosen?.fixedPrice ?? leadPrice(layout);
  const choice = mode === 'page' ? { selectedOptionId: picked ?? undefined, onSelectOption: setPicked } : undefined;
  const sections = layout.sections.filter((s) => s.kind !== 'pageBreak');
  return (
    <div
      className="@container/doc [&_a]:[color:var(--doc-link)]"
      // The page's colours and reveal speed, from its theme.
      style={{ ...pageSurfaceStyle(theme, branding), ...docBrandVars(branding.brand_color), '--doc-anim-ms': `${ANIMATION_SPEED_MS[theme.animation.speed]}ms` } as CSSProperties}
    >
      {sections.map((section, index) => (
        <div key={section.id}>
          {placeholders && emptyGallery(section) ? (
            // The engine draws nothing for an empty gallery, so the slot sits in the page's text column.
            <div className="mx-auto max-w-[720px] px-7.5 py-4">
              <GalleryPlaceholder brand={branding.brand_color} />
            </div>
          ) : (
          <DocSectionView
            section={section}
            index={index}
            branding={branding}
            theme={theme}
            doc={doc}
            mode={mode}
            values={values}
            proposal={choice}
            {...(placeholders && emptyVideo(section) ? { slots: { video: { media: <VideoPlaceholder brand={branding.brand_color} /> } } } : {})}
          />
          )}
          {section.kind === 'accept' ? <BookingLine terms={terms} theme={theme} price={price} /> : null}
        </div>
      ))}
    </div>
  );
}
