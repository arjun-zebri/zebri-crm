import type { PublicDocData } from '@/lib/branding/public-blocks/shared';
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal';

import type { DocFor } from '../state/use-doc-editor';

/**
 * The data a document's fields and data sections read: whose it is, the
 * date and the venue, on top of the sample proposal's other details.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/model/doc-data
 */

/**
 * A display date ("Sat 14 Mar 2027") as the ISO day the variables format,
 * or the text as it is. Read from the local calendar day: going through
 * `toISOString` turned midnight in Melbourne into the day before in UTC,
 * so every wedding showed a day early (2026-10-04 audit).
 */
export function isoOf(date: string): string {
  const t = Date.parse(date);
  if (Number.isNaN(t)) return date;
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The page's data, as its variables and its packages section read them:
 * the sample proposal's, with this couple's names, date and venue, and
 * the deposit from the terms (the line under the packages reads it).
 */
export function docFor(who: DocFor, deposit: number): PublicDocData {
  return {
    ...SAMPLE_PROPOSAL_DOC,
    coupleName: who.couple,
    eventDate: isoOf(who.date),
    venue: who.venue,
    title: `${who.couple}, your wedding`,
    ...(SAMPLE_PROPOSAL_DOC.proposal ? { proposal: { ...SAMPLE_PROPOSAL_DOC.proposal, depositPercent: deposit } } : {}),
  };
}
