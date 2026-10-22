import { paragraph, text, type RichDoc } from '@/features/proposals';

/**
 * Small pieces the contract's and invoice's starting pages are written
 * with: quiet words, a hard line break, and a label over its value, so
 * the facts a document opens on (the booking, who it is billed to) are
 * ordinary words the MC retypes, not a block they cannot touch.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/words
 */

/** Quiet words: a label over a value, a footer. */
export const muted = (words: string) => text(words, [{ type: 'textStyle', attrs: { color: '#71716b' } }]);

/** A line break inside a paragraph. */
export const br = (): RichDoc => ({ type: 'hardBreak' });

/** A label and its value, one under the other in one paragraph (a line break, not a gap, between them). */
export const fact = (label: string, ...value: RichDoc[]) => paragraph(muted(label), br(), ...value);
