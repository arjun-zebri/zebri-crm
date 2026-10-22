import type { Account } from '../account';

/**
 * Show me a trick: the things in Zebri a new MC has not used yet, each
 * told in one line by Zebri and shown on the real page (the spotlight
 * rings the real control), never done for them in a side dialog. A fun
 * way to learn the app one piece at a time, asked for rather than
 * pushed. A trick already shown, or for something already used, is not
 * offered again.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/tricks
 */

export interface Trick {
  id: string;
  /** What Zebri says, typed out: the payoff first. */
  line: string;
  /** Where Show me goes, and the `data-tour` of the control it rings there. */
  page: 'Home' | 'Clients' | 'Documents' | 'Payments';
  /** Payments' tab, or the kind on Documents. */
  tab?: 'proposals' | 'contracts' | 'questionnaires' | 'invoices' | undefined;
  target: string;
  /** The spotlight's note on that page. */
  title: string;
  body: string;
  /** Already in use on this account, so not worth a trick. */
  used?: (a: Account) => boolean;
  /** The block whose control it rings; not offered until that block is added (its icon is not there before). */
  block?: string;
}

export const TRICKS: Trick[] = [
  {
    id: 'calendar',
    line: 'Every booked event lands on your calendar, so Saturday is never a surprise.',
    page: 'Home',
    target: 'calendar',
    block: 'calendar',
    title: 'Your calendar',
    body: 'Booked events show here on their day, with the venue.',
  },
  {
    id: 'notifications',
    line: 'When a client opens, signs or pays, the bell lights up. You know before they text you.',
    page: 'Home',
    target: 'notifications',
    title: 'The bell',
    body: 'Opens, signatures and payments land here, newest first.',
  },
  {
    id: 'contract',
    line: 'Contracts sign themselves. Clients sign from their phone, and your signature is already on.',
    page: 'Documents',
    tab: 'contracts',
    target: 'new-contract',
    title: 'Send a contract',
    body: 'Pick a client who accepted a proposal. Zebri fills in the rest.',
    used: (a) => a.contracts.length > 0,
  },
  {
    id: 'invoice',
    line: 'Deposits by card, straight from the email. No bank details read out over the phone.',
    page: 'Payments',
    tab: 'invoices',
    target: 'new-invoice',
    title: 'Send an invoice',
    body: 'Set the deposit and when it is due. Zebri reminds them for you.',
    used: (a) => a.invoices.length > 0,
  },
  {
    id: 'proposal',
    line: 'Proposals that sell: your brand and packages are already on them, and you see the moment they open.',
    page: 'Documents',
    tab: 'proposals',
    target: 'new-proposal',
    title: 'Send a proposal',
    body: 'Pick a client and a template. Your look and prices are already on it.',
    used: (a) => a.proposals.length > 0,
  },
  {
    // No page to ring: Show me opens the next booked client's run sheet
    // (`run-sheet-landing.ts`), so `target` is only the no-client fallback.
    id: 'run-sheet',
    line: 'Every booked client has a run sheet. Lay out the night, then send it to the couple to approve.',
    page: 'Clients',
    target: 'new-client',
    title: 'Run sheets live on each client',
    body: 'Open a booked client and look under Documents.',
    used: (a) => a.runSheets !== true,
  },
];

/** The next trick worth showing, or null when Zebri has shown them all. */
export function nextTrick(account: Account, seen: readonly string[], added: ReadonlySet<string>): Trick | null {
  return TRICKS.find((t) => !seen.includes(t.id) && !t.used?.(account) && (!t.block || added.has(t.block))) ?? null;
}
