import { doc, newPackageItem, newSectionFor, newSectionId, paragraph } from '@/features/proposals';
import type { PackageOption, RichDoc, Section, SectionData, SectionStyle } from '@/features/proposals';

import type { DemoPackage } from '../../../../onboarding/packages';
import type { Template } from '../../../proposals/templates-data';

import { STARTER_COPY } from './starter-copy';

/**
 * The pieces a proposal's starter page is built from: a text section in
 * the shared column, the spacing a heading and its data section share,
 * and each data section filled for one template and one MC. Add uses
 * `filledSection` too, so a section added later arrives filled.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/starter-sections
 */

/** A v2 demo package as a production package option: one whole-dollar price, its lines as inclusions. */
export function optionOf(p: DemoPackage, popular = false): PackageOption {
  return {
    id: `pk-${newSectionId()}`,
    title: p.name,
    description: '',
    pricingMode: 'single',
    fixedPrice: p.price,
    priceFrequency: 'one_time',
    priceDecimals: 'whole',
    gstInclusive: true,
    weekendLoadingPercent: null,
    isPopular: popular,
    items: (p.lines.length ? p.lines : ['']).map((line) => ({ ...newPackageItem(), description: line, defaultIncluded: true })),
  };
}

/** A text section in the shared column. */
export const words = (name: string, content: RichDoc, style: Partial<SectionStyle> = {}): Section => ({
  id: newSectionId(),
  kind: 'content',
  name,
  style: { height: 'fit', contentWidth: 'medium', ...style },
  content,
});

/**
 * A heading and the data section it introduces sit close, so the two
 * read as one block. Padding is the same above and below a section, so
 * both halves of the pair are pulled in (2026-10-05 review: the gap
 * under "Questions couples ask" was wider than the questions).
 */
export const TIGHT: Partial<SectionStyle> = { padding: 16 };
/** The call to action and its heading: closer than two topics, looser than a pair. */
export const NEAR: Partial<SectionStyle> = { padding: 24 };
/** `section` with `style` laid over its own. */
export const styled = (section: Section, style: Partial<SectionStyle>): Section => ({ ...section, style: { ...section.style, ...style } });

/** A data section of `kind`, its data reshaped by `patch`. */
function data<K extends SectionData['kind']>(name: string, kind: K, patch: (d: Extract<SectionData, { kind: K }>) => SectionData, style: Partial<SectionStyle> = {}): Section {
  const s = newSectionFor(kind);
  return { ...s, name, style: { ...s.style, ...style }, data: patch(s.data as Extract<SectionData, { kind: K }>) };
}

/**
 * A fresh section of `kind`, already filled for this template and this
 * MC: their packages, the template's kind words and questions. Add uses it too, so a section added later never lands as an
 * empty band or with someone else's sample prices (2026-10-05 review).
 */
export function filledSection(kind: SectionData['kind'] | 'content' | 'pageBreak', template: Template, packages: DemoPackage[]): Section {
  const copy = STARTER_COPY[template.id];
  switch (kind) {
    case 'gallery':
      // Empty for the MC's own photos: there is no stock library to fill it from.
      return data('Photos', 'gallery', (d) => ({ kind: 'gallery', gallery: { ...d.gallery, layout: 'grid' } }), { contentWidth: 'wide', padding: 'compact' });
    case 'packages': {
      const real = packages.filter((p) => p.name.trim() && p.price > 0);
      const options = real.map((p, i) => optionOf(p, real.length > 1 && i === 0));
      return data('Packages', 'packages', (d) => ({ kind: 'packages', packages: { ...d.packages, layout: 'stacked', ctaLabel: 'Choose this package', options } }), { contentWidth: 'wide', padding: 'compact' });
    }
    case 'testimonials':
      return data('Reviews', 'testimonials', (d) => ({
        kind: 'testimonials',
        testimonials: { ...d.testimonials, layout: 'cards', items: copy.words.map((w) => ({ id: newSectionId(), quote: w.quote, names: w.names, detail: w.detail })) },
      }));
    case 'faq':
      return data('Common questions', 'faq', (d) => ({ kind: 'faq', faq: { ...d.faq, collapsible: true, items: copy.faq.map(([question, answer]) => ({ id: newSectionId(), question, answer })) } }), { padding: 'compact' });
    case 'accept':
      return data('Accept', 'accept', (d) => ({ kind: 'accept', accept: { ...d.accept, buttonLabel: 'Accept and hold our date' } }));
    case 'video':
      // An empty slot until the MC adds their video hello.
      return data('Video', 'video', (d) => d, { padding: 'compact' });
    case 'content':
      return words('Text', doc(paragraph()));
    default:
      return newSectionFor(kind);
  }
}
