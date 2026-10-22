import type { ProposalLayout, Section, SectionKind } from '@/features/proposals';

import type { DocLayout, DocSection, EngineKind } from './types';

/**
 * The one place the engine's model meets production's. A `DocLayout` is
 * production's `ProposalLayout` with more section kinds, so production's
 * layout editor (`useLayoutEditor`) runs it as it is: its reducer moves,
 * restyles and edits sections without looking at their kind, and
 * `setData` only checks that the data's kind matches the section's. The
 * casts live here so nothing else needs one. Two things production does
 * look at a kind for, `resetStyle` and its renderers, are kept away from
 * engine kinds by `state/guard.ts` and `render/doc-section-view.tsx`.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/model/as-production
 */

/** The kinds production renders and edits itself. */
export const PROD_KINDS: ReadonlySet<SectionKind> = new Set(['content', 'packages', 'gallery', 'video', 'testimonials', 'faq', 'accept', 'pageBreak']);

/** Whether `section` is one of production's own kinds. */
export const isProdSection = (section: DocSection): section is Section => PROD_KINDS.has(section.kind as SectionKind);

/** Whether `kind` is one only the engine knows. */
export const isEngineKind = (kind: string): kind is EngineKind => !PROD_KINDS.has(kind as SectionKind);

/** `layout` as production's editor state holds it. */
export const toProd = (layout: DocLayout): ProposalLayout => layout as unknown as ProposalLayout;

/** Production's editor state back as the document it is. */
export const fromProd = (layout: ProposalLayout): DocLayout => layout as unknown as DocLayout;
