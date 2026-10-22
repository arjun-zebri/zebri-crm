import { ClientsIcon, DiscoverIcon, ProposalIcon, ReceiptIcon, RunSheetIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';


import { AT_RISK, BOOKED_THIS_MONTH } from './demo-data';

/**
 * The greeting, the headline under it, and the quick starts under the
 * "Ask Zebri" box.
 *
 * @module app/design-system/v2/pages/dashboard/briefing
 */

/** "Good morning" before noon, "Good afternoon" before 6pm, else "Good evening". */
export function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The headline under the greeting: how the month is going, then the one
 * booking at risk. Each half appears only when it is true, and neither
 * repeats what the Up next panel shows. `null` parts mean "say nothing";
 * with both null the greeting stands alone.
 */
export interface Headline {
  /** "3 events booked this month, your best September yet." */
  win: string | null;
  /** The client (rendered as a link to them) and what is wrong. */
  risk: { id: string; client: string; reason: string } | null;
}

/** Builds the {@link Headline} for `now`'s month. */
export function headline(now: Date): Headline {
  const { count, bestYet } = BOOKED_THIS_MONTH;
  const month = now.toLocaleDateString('en-AU', { month: 'long' });
  let win: string | null = null;
  if (count > 0) {
    const booked = `${count} ${count === 1 ? 'event' : 'events'} booked this month`;
    win = bestYet ? `${booked}, your best ${month} yet.` : `${booked}.`;
  }
  return { win, risk: AT_RISK };
}

/** Which dialog a quick start opens. */
export type QuickStartId = 'proposal' | 'invoice' | 'run-sheet' | 'client' | 'trick';

/** One quick start. */
export interface QuickStart {
  id: QuickStartId;
  label: string;
  icon: ZebriIcon;
}

/**
 * Quick starts: the jobs that move money or save hours, in the order of
 * the lead-to-payment flow (proposal, invoice, then the run sheet). Never errands the
 * Up next panel already covers (replying, chasing), and never vague
 * ("Prep Saturday"). Each opens a dialog that does the job start to
 * finish (see `home/`), never a half-written prompt.
 */
export const QUICK_STARTS: QuickStart[] = [
  { id: 'proposal', label: 'Send a proposal', icon: ProposalIcon },
  { id: 'invoice', label: 'Send an invoice', icon: ReceiptIcon },
  { id: 'run-sheet', label: 'Build a run sheet', icon: RunSheetIcon },
  // A new account's: adding the first client, and Zebri showing off one
  // thing the MC has not used yet, as Discover Zebri (see `first-run/tricks.ts`).
  { id: 'client', label: 'Create a client', icon: ClientsIcon },
  { id: 'trick', label: 'Discover Zebri', icon: DiscoverIcon },
];

/** The quick starts a business's Home shows when it does not choose its own. */
export const DEFAULT_QUICK_STARTS: QuickStartId[] = ['proposal', 'invoice', 'run-sheet'];
