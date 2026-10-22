import type { SectionKind } from '@/features/proposals';

import type { DocSection, DocType } from '../model/types';

/**
 * What a document editor is opened with: who the page is for, its
 * booking terms, how Add fills a new section, and whether it is a
 * couple's copy or a template.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/state/options
 */

/** Who and what a composed page is for, as its variables read it. */
export interface DocFor {
  couple: string;
  date: string;
  venue: string;
}

/** What a builder is opened on, besides its page. */
export interface DocEditorOptions {
  /** Whose details the page shows: the couple, or a template's sample couple. */
  who: DocFor;
  /** The booking terms kept with the page, when it has some. */
  terms?: BookingTerms | undefined;
  /** Fills a section Add creates; the engine's default otherwise. */
  fill?: FillSection | undefined;
  /** What kind of document it is; a proposal unless said. */
  type?: DocType | undefined;
  /** A couple's proposal (their details as words) or a template (as chips). */
  mode?: DocMode | undefined;
}

/** A couple's proposal, or a template for every couple. */
export type DocMode = 'proposal' | 'template';

/** A new section of `kind`, filled for this document (its packages, its words). */
export type FillSection = (kind: SectionKind) => DocSection;

/**
 * What saying yes sets going (spec §4, the Accept section is the money
 * hub): a contract to sign first, a deposit invoice, and when the rest
 * falls due. Production keeps these on the proposal row, not the layout.
 */
export interface BookingTerms {
  /** They sign your contract before they pay. */
  contract: boolean;
  /** Share of the package taken on accepting, 0 for none. */
  deposit: number;
  /** Days before the wedding the balance is due. */
  balanceDays: number;
}

/** Desktop or phone: how wide the page shows on the desk. */
export type Device = 'desktop' | 'phone';
