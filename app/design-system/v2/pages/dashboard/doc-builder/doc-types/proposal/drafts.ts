

import type { DocLayout } from '../../model/types';
import { kept } from '../../state/kept';
import type { BookingTerms } from '../../state/use-doc-editor';

/**
 * Unsent proposals, kept as the MC works. Closing the editor, by any
 * means, keeps the draft and reopening the same couple's proposal picks
 * it up where it was (2026-10-04 audit: one stray click threw a whole
 * page away). Held in memory and mirrored to this browser's storage, so
 * a reload keeps it too; the preview has no server to save to.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/drafts
 */

export interface Draft {
  layout: DocLayout;
  terms: BookingTerms;
  /** When it was last kept, ms. */
  at: number;
}

const store = kept<Draft>('zebri-v2-proposal-drafts');

/** The draft key for one couple's proposal from one template. */
export const draftKey = (couple: string, template: string) => `${couple}|${template}`;

/** The kept draft, or null. */
export const readDraft = (key: string): Draft | null => store.read(key);

/** Keeps `draft` under `key`. */
export const writeDraft = (key: string, draft: Draft) => store.write(key, draft);

/** Drops the draft: it was sent, or the MC started over. */
export const clearDraft = (key: string) => store.remove(key);
