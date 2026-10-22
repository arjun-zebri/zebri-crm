import { newSectionId } from '@/features/proposals';

import type { DocSection, EngineDataMap } from '../../model/types';

/**
 * Header: the MC's logo across the top of a document, with their own
 * words under it (a tagline, contact details). The logo is the brand
 * kit's own (not a copy in the section), so a new logo lands in every
 * document's header at once; until there is one, the business name
 * stands in, in the heading face. The section keeps the logo's height,
 * set by dragging its corner, the words, and whether they sit under the
 * logo or beside it (the bar's layout buttons); alignment is the
 * section's own (the bar's align buttons).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/sections/header/data
 */

export type HeaderData = EngineDataMap['header'];

/** How tall a logo can be dragged, in page pixels. */
export const LOGO_MIN = 16;
export const LOGO_MAX = 200;

/** A header's data, read safely: a section saved before heights (an S/M/L size) gets the default. */
export function headerOf(section: DocSection): HeaderData {
  const raw = section.data?.kind === 'header' ? (section.data.header as Partial<HeaderData>) : {};
  return { height: typeof raw.height === 'number' ? raw.height : 48, ...(raw.text ? { text: raw.text } : {}), ...(raw.layout ? { layout: raw.layout } : {}) };
}

/**
 * How a header lays out its logo and words, both placed by the
 * section's alignment: stacked, the two lined up left, centre or right;
 * or side by side, the row of logo and words set left, centred, or
 * spread to the page's edges (right), as a letterhead's contact details
 * sit across from its logo. Side by side stacks again on a phone-width
 * page, where the two would crush each other.
 */
export function headerFlow(data: HeaderData, align: Align): { box: string; words: string; align: Align } {
  if (data.layout === 'beside') {
    return { box: `flex flex-col gap-4 @xl/doc:flex-row @xl/doc:items-center @xl/doc:gap-8 ${SPREAD[align]}`, words: 'min-w-40 max-w-full', align: align === 'right' ? 'right' : 'left' };
  }
  return { box: `flex flex-col gap-4 ${ITEMS[align]}`, words: 'w-full', align };
}

/** Where a side-by-side row of logo and words sits, by the section's alignment. */
const SPREAD = { left: '@xl/doc:justify-start', center: '@xl/doc:justify-center', right: '@xl/doc:justify-between' } as const;

type Align = 'left' | 'center' | 'right';

/** Where stacked logo and words sit, by the section's alignment. */
export const ITEMS = { left: 'items-start', center: 'items-center', right: 'items-end' } as const;

/**
 * A fresh header: the logo 48px tall at the left with the MC's words
 * beside it, as a letterhead reads (founder, 2026-10-21), in a slim band
 * as wide as the page's widest column, so the logo sits near the edge.
 */
export function headerSection(): DocSection {
  return {
    id: newSectionId(),
    kind: 'header',
    name: 'Header',
    style: { height: 'fit', padding: 24, align: 'left', contentWidth: 'wide' },
    data: { kind: 'header', header: { height: 48, layout: 'beside' } },
  };
}
