import type { ReactNode } from 'react';

import type { RowSection } from '@/components/ui-v2/row-sections';

import type { DocumentKind } from './kinds';

/**
 * One sent document of any kind, as the Documents page's Sent list shows
 * it, so proposals, contracts and questionnaires share one list and one
 * row. Each kind's hook (`useProposalDocuments`, …) turns its own
 * records into these; the page only merges, filters and sections them.
 *
 * @module app/design-system/v2/pages/dashboard/documents/doc-item
 */

/** Where a document sits in the Sent list, most in need of the MC first. */
export type DocSection = 'needs' | 'waiting' | 'draft' | 'done' | 'closed' | 'couple' | 'day' | 'bdm';

/**
 * The Sent list's sections. Needs you is a document the client has
 * looked at and not answered (a proposal opened, not accepted), where a
 * nudge lands best, or an invoice past due; Waiting on them is everything else still out.
 * Settled ones start folded.
 */
export const DOC_SECTIONS: RowSection<DocSection>[] = [
  { id: 'needs', title: 'Needs you', dot: 'bg-warning' },
  { id: 'waiting', title: 'Waiting on them', dot: 'bg-zebra-400' },
  { id: 'draft', title: 'Drafts', dot: 'bg-zebra-300' },
  { id: 'done', title: 'Done', dot: 'bg-grass-500', shut: true },
  { id: 'closed', title: 'Declined or expired', dot: 'bg-zebra-300', shut: true },
];

/**
 * Marriage paperwork's own sections: where a couple is waiting matters
 * (on them, on the wedding, on the Registry), so it has its own words,
 * and Not sent comes straight after Needs you, since sending is the
 * first thing to do.
 */
export const PAPERWORK_SECTIONS: RowSection<DocSection>[] = [
  { id: 'needs', title: 'Needs you', dot: 'bg-warning' },
  { id: 'draft', title: 'Not sent', dot: 'bg-zebra-300' },
  { id: 'couple', title: 'With the couple', dot: 'bg-zebra-400' },
  { id: 'day', title: 'Ready for the day', dot: 'bg-grass-300' },
  { id: 'bdm', title: 'With BDM', dot: 'bg-zebra-400' },
  { id: 'done', title: 'Registered', dot: 'bg-grass-500', shut: true },
];

/** Every section, for a search across every kind. */
export const ALL_SECTIONS: RowSection<DocSection>[] = [
  ...DOC_SECTIONS.slice(0, 2),
  ...PAPERWORK_SECTIONS.filter((s) => ['couple', 'day', 'bdm'].includes(s.id)),
  ...DOC_SECTIONS.slice(2),
];

/** One document in the Sent list. */
export interface DocItem {
  /** Unique across kinds: the kind, then its own id. */
  key: string;
  kind: DocumentKind;
  /** The client: one name, or a couple. */
  names: [string, string];
  /** Under the names: what it is and what it is for. */
  detail: string;
  /** Where it stands: "Opened twice, last today", "1 of 2 signed". */
  status: string;
  /** What it is worth, for a proposal or contract. */
  value?: number | undefined;
  /** Zebri's one line on it ("Lingered on Premium"), while it is out. */
  read?: string | undefined;
  section: DocSection;
  /** Lower-cased words the search matches. */
  search: string;
  onOpen: () => void;
  /** The row's one action while it is out: Nudge, Remind. */
  action?: ReactNode;
}
