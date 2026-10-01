import type { RowSection } from '@/components/ui-v2/row-sections';

import type { DemoPackage } from '../../onboarding/packages';
import { TODAY, daysBetween, shortDate } from '../payments/dates';
import type { HistoryItem } from '../payments/payments-data';


import { PACKAGES, templateOf, type PackageId, type TemplateId } from './templates-data';

/**
 * Made-up proposals for the v2 Proposals page. The couples still deciding
 * are the Clients page's (Sophie & Max, Olivia & Ben, Grace & Sam, Mia &
 * Leo) plus a few new leads; the accepted ones are couples the Payments
 * page bills. "Today" is the Payments demo's, Sun 27 Sep 2026 (see
 * `payments/dates.ts`). Nothing is read from the database; the real page
 * fills the same shapes from `proposals` and `proposal_events`.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/proposals-data
 */

/** The Proposals tab's sections, most in need of the MC first. */
export type ProposalGroup = 'opened' | 'unopened' | 'draft' | 'accepted' | 'closed';

export const PROPOSAL_GROUPS: RowSection<ProposalGroup>[] = [
  { id: 'opened', title: 'Opened, not accepted', dot: 'bg-warning' },
  { id: 'unopened', title: 'Sent, not opened', dot: 'bg-zebra-400' },
  { id: 'draft', title: 'Drafts', dot: 'bg-zebra-300' },
  { id: 'accepted', title: 'Accepted', dot: 'bg-grass-500', shut: true },
  { id: 'closed', title: 'Declined or expired', dot: 'bg-zebra-300', shut: true },
];

/** Seconds each partner spent on each section, summed over every visit: first partner, then second. */
export type Reading = [section: string, first: number, second: number][];

/** A proposal as written down: dates and facts, nothing worked out. */
export interface ProposalSeed {
  id: string;
  names: [string, string];
  template: TemplateId;
  /** The wedding: "YYYY-MM-DD" and the venue. */
  event: string;
  venue: string;
  createdOn: string;
  sentOn?: string | undefined;
  openedOn?: string | undefined;
  lastOpenedOn?: string | undefined;
  opens?: number | undefined;
  /** Scrolled as far as the packages. */
  reached?: boolean | undefined;
  /** The package they spent longest on. */
  leaning?: PackageId | undefined;
  acceptedOn?: string | undefined;
  chosen?: PackageId | undefined;
  signedOn?: string | undefined;
  /** Deposit paid. */
  paidOn?: string | undefined;
  declinedOn?: string | undefined;
  expiresOn?: string | undefined;
  /** When Zebri or the MC last followed it up. */
  nudgedOn?: string | undefined;
  /** Zebri's one-line read of how it is going. */
  read?: string | undefined;
  reading?: Reading | undefined;
  history: HistoryItem[];
  /**
   * The MC's own package, when the proposal offers one rather than the
   * template's (a new account prices its first proposal as it sends it).
   * Sets the value and the name the rows and preview show.
   */
  offer?: DemoPackage | undefined;
  /** The welcome's heading and note as the MC wrote them in the editor; the template's when unset. */
  headline?: string | undefined;
  welcome?: string | undefined;
}

/** A proposal with where it stands worked out against today. */
export interface Proposal extends ProposalSeed {
  group: ProposalGroup;
  /** The chosen package's price, else the one they lean to, else the first offered. */
  value: number;
  /** How the row reads the timing: "Opened 5 times, last today". */
  when: string;
  /** Days until it expires, for one still out. */
  expiresIn: number | null;
}

/** "today", "yesterday", else "Thu 24 Sep". */
export const dayWord = (iso: string) => {
  const d = daysBetween(iso, TODAY);
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : shortDate(iso);
};

/** Works out a proposal's section, value and wording. */
export function finish(s: ProposalSeed): Proposal {
  const closed = Boolean(s.declinedOn) || (!s.acceptedOn && Boolean(s.expiresOn) && s.expiresOn! < TODAY);
  const group: ProposalGroup = s.acceptedOn ? 'accepted' : closed ? 'closed' : !s.sentOn ? 'draft' : s.openedOn ? 'opened' : 'unopened';
  const pkg = s.chosen ?? s.leaning ?? templateOf(s.template).packages[0]!;
  const opens = s.opens ?? 1;
  const when =
    group === 'accepted'
      ? `Accepted ${shortDate(s.acceptedOn!)}`
      : group === 'closed'
        ? s.declinedOn
          ? `Declined ${shortDate(s.declinedOn)}`
          : `Expired ${shortDate(s.expiresOn!)}`
        : group === 'draft'
          ? `Drafted ${dayWord(s.createdOn)}`
          : group === 'opened'
            ? `Opened ${opens === 1 ? 'once' : `${opens} times`}, last ${dayWord(s.lastOpenedOn ?? s.openedOn!)}`
            : `Sent ${dayWord(s.sentOn!)}`;
  const out = group === 'opened' || group === 'unopened';
  return { ...s, group, value: s.offer?.price ?? PACKAGES[pkg].price, when, expiresIn: out && s.expiresOn ? daysBetween(TODAY, s.expiresOn) : null };
}

/** "Wedding Sat 21 Nov 2026 · Curzon Hall". */
export const weddingLine = (p: ProposalSeed) => `${shortDate(p.event)} ${p.event.slice(0, 4)} · ${p.venue}`;
