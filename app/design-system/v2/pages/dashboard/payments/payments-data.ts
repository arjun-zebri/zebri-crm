/**
 * Made-up invoices and contracts for the v2 Payments page. Nothing is
 * read from the database; the real page fills the same shapes. The
 * couples are the Clients page's, so a name reads the same on both
 * pages, and "today" is Sun 27 Sep 2026, the date the demo copy is
 * written against (see `dates.ts`). Amounts are whole dollars and
 * include GST.
 *
 * @module app/design-system/v2/pages/dashboard/payments/payments-data
 */

import type { RowSection } from '@/components/ui-v2/row-sections';

import { TODAY, addDays, daysBetween, shortDate } from './dates';
import { generatedSeeds } from './invoice-seed';

/** The MC's business, as it appears on the couple's copy. */
export const BUSINESS = { name: 'Arjun Punekar MC', abn: '51 824 753 556', email: 'hello@arjunmc.com.au' };

/** Formats whole dollars as "$1,450". */
export const money = (n: number) => `$${n.toLocaleString('en-AU')}`;

/** The GST inside a GST-inclusive amount (one eleventh), to the cent. */
export const gstOf = (n: number) => Math.round((n / 11) * 100) / 100;

/** Formats dollars and cents as "$131.82". */
export const cents = (n: number) =>
  `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Sections with nothing folded, for a short list. Folding the settled
 * ones keeps a long list to what needs the MC; on a list of a few rows
 * it only hides the one that just got paid or signed.
 */
export const unfolded = <S extends string>(sections: RowSection<S>[], rows: number) =>
  rows < 10 ? sections.map((s) => ({ ...s, shut: false })) : sections;

/** The Invoices sections, most urgent first. */
export type InvoiceGroup = 'overdue' | 'soon' | 'later' | 'paid';

export const INVOICE_GROUPS: RowSection<InvoiceGroup>[] = [
  { id: 'overdue', title: 'Overdue', dot: 'bg-danger' },
  { id: 'soon', title: 'Due in the next 30 days', dot: 'bg-warning' },
  { id: 'later', title: 'Scheduled later', dot: 'bg-zebra-300', shut: true },
  { id: 'paid', title: 'Paid', dot: 'bg-grass-500', shut: true },
];

/** One step in a document's history, newest first in the data. */
export interface HistoryItem {
  when: string;
  text: string;
}

/** An invoice as written down: the dates, and nothing worked out from them. */
export interface InvoiceSeed {
  id: string;
  number: number;
  names: [string, string];
  /** Which payment in the plan this is. */
  label: 'Deposit' | 'Second payment' | 'Final payment';
  amount: number;
  /** The package it pays towards, and that package's full price. */
  item: string;
  total: number;
  /** Paid towards the package before this invoice. */
  paidBefore: number;
  dueOn: string;
  paidOn: string | null;
  method: 'Card' | 'Bank transfer' | null;
  /** When Zebri sends it, for one scheduled but not yet sent. */
  zebriSends?: string | undefined;
  /** When it went to the couple; unset while it waits to be sent. */
  sentOn?: string | undefined;
  /** Who opened it first, and when. */
  openedBy?: string | undefined;
  openedOn?: string | undefined;
  /** When Zebri last sent a reminder. */
  remindedOn?: string | undefined;
  history: HistoryItem[];
  /** A line to the couple, printed on the invoice above how to pay. */
  note?: string | undefined;
}

/** An invoice with where it stands worked out against today. */
export interface Invoice extends InvoiceSeed {
  group: InvoiceGroup;
  /** "Fri 3 Oct". */
  due: string;
  /** How the row reads the timing: "12 days late", "Due Fri 3 Oct", "Paid Wed 24 Sep". */
  when: string;
  /** Days past due, for an overdue one. */
  late: number;
}

/** "Amelia & Jack", or "Priya" for one person (no second name). */
export const coupleName = (names: [string, string]) => (names[1] ? `${names[0]} & ${names[1]}` : names[0]);

/** Works out an invoice's section and wording from its dates. */
export function finish(s: InvoiceSeed): Invoice {
  const late = s.paidOn ? 0 : Math.max(0, daysBetween(s.dueOn, TODAY));
  const group: InvoiceGroup = s.paidOn
    ? 'paid'
    : late > 0
      ? 'overdue'
      : s.dueOn <= addDays(TODAY, 30)
        ? 'soon'
        : 'later';
  const due = shortDate(s.dueOn);
  const when = s.paidOn ? `Paid ${shortDate(s.paidOn)}` : late ? `${late} days late` : `Due ${due}`;
  return { ...s, group, due, when, late };
}

const seed = (s: Omit<InvoiceSeed, 'method' | 'paidOn'> & Partial<Pick<InvoiceSeed, 'method' | 'paidOn'>>): InvoiceSeed => ({
  paidOn: null,
  method: null,
  ...s,
});

/** The invoices written out by hand: the ones the Clients page and profile talk about. */
const NAMED: InvoiceSeed[] = [
  seed({ id: 'inv-1040', number: 1040, names: ['Ella', 'Noah'], label: 'Deposit', amount: 900, item: 'Classic MC package', total: 3600, paidBefore: 0, dueOn: '2026-09-15', sentOn: '2026-09-07', openedBy: 'Ella', openedOn: '2026-09-08', remindedOn: '2026-09-19', history: [{ when: 'Sat 19 Sep', text: 'Zebri sent a gentle reminder · opened by Ella' }, { when: 'Tue 15 Sep', text: 'Fell due, not paid' }, { when: 'Tue 8 Sep', text: 'Opened by Ella' }, { when: 'Mon 7 Sep', text: 'Sent to Ella and Noah' }] }),
  seed({ id: 'inv-1036', number: 1036, names: ['Olivia', 'Ben'], label: 'Second payment', amount: 1200, item: 'Premium MC package', total: 4350, paidBefore: 1000, dueOn: '2026-09-20', sentOn: '2026-09-09', openedBy: 'Ben', openedOn: '2026-09-10', history: [{ when: 'Sun 20 Sep', text: 'Fell due, not paid' }, { when: 'Thu 10 Sep', text: 'Opened by Ben' }, { when: 'Wed 9 Sep', text: 'Sent to Olivia and Ben' }] }),
  seed({ id: 'inv-1043', number: 1043, names: ['Amelia', 'Jack'], label: 'Final payment', amount: 1450, item: 'Premium MC package', total: 4350, paidBefore: 2900, dueOn: '2026-10-03', zebriSends: '2026-09-29', history: [{ when: 'Thu 24 Sep', text: 'Scheduled by Zebri' }] }),
  seed({ id: 'inv-1044', number: 1044, names: ['Zoe', 'Liam'], label: 'Final payment', amount: 1300, item: 'Classic MC package', total: 3600, paidBefore: 2300, dueOn: '2026-10-17', sentOn: '2026-09-24', openedBy: 'Zoe', openedOn: '2026-09-24', history: [{ when: 'Thu 24 Sep', text: 'Opened by Zoe' }, { when: 'Thu 24 Sep', text: 'Sent to Zoe and Liam' }] }),
  seed({ id: 'inv-1045', number: 1045, names: ['Sophie', 'Max'], label: 'Second payment', amount: 1000, item: 'Premium MC package', total: 4350, paidBefore: 1450, dueOn: '2026-10-24', sentOn: '2026-09-25', history: [{ when: 'Fri 25 Sep', text: 'Sent to Sophie and Max' }] }),
  seed({ id: 'inv-1046', number: 1046, names: ['Hannah', 'Joe'], label: 'Final payment', amount: 1100, item: 'Classic MC package', total: 3600, paidBefore: 2500, dueOn: '2027-01-09', zebriSends: '2026-12-26', history: [{ when: 'Mon 14 Sep', text: 'Scheduled by Zebri' }] }),
  seed({ id: 'inv-1047', number: 1047, names: ['Isla', 'Ethan'], label: 'Final payment', amount: 1600, item: 'Premium MC package', total: 4350, paidBefore: 2750, dueOn: '2027-02-06', zebriSends: '2027-01-23', history: [{ when: 'Wed 2 Sep', text: 'Scheduled by Zebri' }] }),
  seed({ id: 'inv-1048', number: 1048, names: ['Chloe', 'Marcus'], label: 'Final payment', amount: 1250, item: 'Classic MC package', total: 3600, paidBefore: 2350, dueOn: '2026-11-28', zebriSends: '2026-11-14', history: [{ when: 'Tue 1 Sep', text: 'Scheduled by Zebri' }] }),
  seed({ id: 'inv-1038', number: 1038, names: ['Amelia', 'Jack'], label: 'Second payment', amount: 1450, item: 'Premium MC package', total: 4350, paidBefore: 1450, dueOn: '2026-09-26', paidOn: '2026-09-24', method: 'Card', sentOn: '2026-09-15', openedBy: 'Amelia', openedOn: '2026-09-16', history: [{ when: 'Wed 24 Sep', text: 'Paid by Amelia, card ending 4821' }, { when: 'Wed 16 Sep', text: 'Opened by Amelia' }, { when: 'Tue 15 Sep', text: 'Sent to Amelia and Jack' }] }),
  seed({ id: 'inv-1039', number: 1039, names: ['Jess', 'Ali'], label: 'Deposit', amount: 800, item: 'Classic MC package', total: 3600, paidBefore: 0, dueOn: '2026-09-21', paidOn: '2026-09-18', method: 'Card', sentOn: '2026-09-16', openedBy: 'Jess', openedOn: '2026-09-17', history: [{ when: 'Fri 18 Sep', text: 'Paid by Jess, card' }, { when: 'Thu 17 Sep', text: 'Opened by Jess' }, { when: 'Wed 16 Sep', text: 'Sent to Jess and Ali' }] }),
  seed({ id: 'inv-1037', number: 1037, names: ['Grace', 'Sam'], label: 'Deposit', amount: 1000, item: 'Premium MC package', total: 4350, paidBefore: 0, dueOn: '2026-09-14', paidOn: '2026-09-10', method: 'Bank transfer', sentOn: '2026-09-07', openedBy: 'Grace', openedOn: '2026-09-08', history: [{ when: 'Thu 10 Sep', text: 'Paid by Grace, bank transfer' }, { when: 'Tue 8 Sep', text: 'Opened by Grace' }, { when: 'Mon 7 Sep', text: 'Sent to Grace and Sam' }] }),
  seed({ id: 'inv-1034', number: 1034, names: ['Isla', 'Ethan'], label: 'Second payment', amount: 1300, item: 'Premium MC package', total: 4350, paidBefore: 1450, dueOn: '2026-09-07', paidOn: '2026-09-02', method: 'Card', sentOn: '2026-08-24', openedBy: 'Isla', openedOn: '2026-08-25', history: [{ when: 'Wed 2 Sep', text: 'Paid by Isla, card' }, { when: 'Tue 25 Aug', text: 'Opened by Isla' }, { when: 'Mon 24 Aug', text: 'Sent to Isla and Ethan' }] }),
  seed({ id: 'inv-1021', number: 1021, names: ['Amelia', 'Jack'], label: 'Deposit', amount: 1450, item: 'Premium MC package', total: 4350, paidBefore: 0, dueOn: '2026-03-06', paidOn: '2026-03-03', method: 'Card', sentOn: '2026-03-03', openedBy: 'Amelia', openedOn: '2026-03-03', history: [{ when: 'Tue 3 Mar', text: 'Paid by Amelia, card' }, { when: 'Tue 3 Mar', text: 'Sent with the contract' }] }),
];

/** Wedding dates for the named couples, as on the Clients page; plans count back from these. */
export const EVENTS: Record<string, string> = {
  'Amelia & Jack': '2026-10-10', 'Ella & Noah': '2027-02-06', 'Mia & Leo': '2027-03-14', 'Zoe & Liam': '2026-10-31',
  'Sophie & Max': '2026-11-21', 'Grace & Sam': '2027-05-02', 'Olivia & Ben': '2027-02-27', 'Jess & Ali': '2027-04-10',
  'Hannah & Joe': '2027-01-23', 'Isla & Ethan': '2027-03-06', 'Chloe & Marcus': '2026-12-12',
};

/** Surnames for the demo's couples, so bills and emails read as real ones. */
const SURNAMES: Record<string, string> = {
  Ella: 'Brooks', Noah: 'Kent', Olivia: 'Chen', Ben: 'Adler', Amelia: 'Hart', Jack: 'Moreno', Zoe: 'Park', Liam: 'Shaw',
  Sophie: 'Tran', Max: 'Keller', Hannah: 'Lee', Joe: 'Park', Grace: 'Walker', Sam: 'Ito', Isla: 'Byrne', Ethan: 'Cole',
  Mia: 'Rossi', Leo: 'Grant', Jess: 'Nguyen', Ali: 'Haddad', Chloe: 'Martin', Marcus: 'Webb',
};
const FALLBACK = ['Mills', 'Reid', 'Hayes', 'Ford', 'Lane', 'Wood'];

/** A partner's full name and (made-up) email. */
export function personOf(first: string) {
  const last = SURNAMES[first] ?? FALLBACK[first.length % FALLBACK.length]!;
  return { first, name: `${first} ${last}`, email: `${first.toLowerCase()}.${last[0]!.toLowerCase()}@gmail.com` };
}

/** The named invoices' ids, so a plan only gathers a couple's real invoices, not a generated namesake's. */
export const NAMED_IDS = new Set(NAMED.map((n) => n.id));

/**
 * Every invoice over the two financial years the demo covers: the named
 * ones plus the MC's other bookings, generated (`invoice-seed.ts`). The
 * Overview's totals and chart are sums over this same list, so the tabs
 * always agree.
 */
export const INVOICE_SEEDS: InvoiceSeed[] = [...NAMED, ...generatedSeeds()];

/** The Contracts sections, in order. */
export type ContractGroup = 'waiting' | 'draft' | 'signed';

export const CONTRACT_GROUPS: RowSection<ContractGroup>[] = [
  { id: 'waiting', title: 'Waiting on signature', dot: 'bg-warning' },
  { id: 'draft', title: 'Drafts', dot: 'bg-zebra-300' },
  { id: 'signed', title: 'Signed', dot: 'bg-grass-500', shut: true },
];

/** Someone who signs a contract. */
export interface Signer {
  name: string;
  role: 'Client' | 'You';
  /** When they signed; `null` while waiting. */
  signed: string | null;
}

/** One contract. */
export interface Contract {
  id: string;
  names: [string, string];
  title: string;
  item: string;
  total: number;
  event: string;
  /** How the row reads it: "Sent Tue 22 Sep", "Not sent", "Signed Tue 3 Mar". */
  when: string;
  /** When it went to the couple, for one waiting on a signature. */
  sentOn?: string | undefined;
  group: ContractGroup;
  signers: Signer[];
  history: HistoryItem[];
  /** The clauses as the MC wrote them; the standard wording when unset. */
  clauses?: [title: string, text: string][] | undefined;
}

const signers = (a: string, b: string, you: string | null, x: string | null, y: string | null): Signer[] => [
  { name: a, role: 'Client', signed: x },
  { name: b, role: 'Client', signed: y },
  { name: 'Arjun Punekar', role: 'You', signed: you },
];

export const CONTRACTS: Contract[] = [
  { id: 'con-sophie-max', names: ['Sophie', 'Max'], title: 'MC agreement', item: 'Premium MC package', total: 4350, event: 'Sat 21 Nov 2026 · Curzon Hall', when: 'Sent Tue 22 Sep', sentOn: '2026-09-22', group: 'waiting', signers: signers('Sophie Tran', 'Max Keller', 'Tue 22 Sep', 'Wed 23 Sep', null), history: [{ when: 'Wed 23 Sep', text: 'Signed by Sophie' }, { when: 'Tue 22 Sep', text: 'Sent to Sophie and Max' }] },
  { id: 'con-hannah-joe', names: ['Hannah', 'Joe'], title: 'MC agreement', item: 'Classic MC package', total: 3600, event: 'Sat 20 Feb 2027 · Bells at Killcare', when: 'Sent Fri 25 Sep', sentOn: '2026-09-25', group: 'waiting', signers: signers('Hannah Lee', 'Joe Park', 'Fri 25 Sep', null, null), history: [{ when: 'Sat 26 Sep', text: 'Opened by Hannah' }, { when: 'Fri 25 Sep', text: 'Sent to Hannah and Joe' }] },
  { id: 'con-mia-leo', names: ['Mia', 'Leo'], title: 'MC agreement', item: 'Classic MC package', total: 3600, event: 'Sat 14 Mar 2027 · Hawthorn Hall', when: 'Not sent', group: 'draft', signers: signers('Mia Rossi', 'Leo Grant', null, null, null), history: [{ when: 'Sun 27 Sep', text: 'Drafted from your MC agreement' }] },
  { id: 'con-grace-sam', names: ['Grace', 'Sam'], title: 'MC and ceremony agreement', item: 'Premium MC package', total: 4350, event: 'Sun 2 May 2027 · Bells at Killcare', when: 'Not sent', group: 'draft', signers: signers('Grace Walker', 'Sam Ito', null, null, null), history: [{ when: 'Thu 10 Sep', text: 'Drafted from your MC agreement' }] },
  { id: 'con-amelia-jack', names: ['Amelia', 'Jack'], title: 'MC agreement', item: 'Premium MC package', total: 4350, event: 'Sat 10 Oct 2026 · Hawthorn Hall', when: 'Signed Tue 3 Mar', group: 'signed', signers: signers('Amelia Hart', 'Jack Moreno', 'Mon 2 Mar', 'Tue 3 Mar', 'Tue 3 Mar'), history: [{ when: 'Tue 3 Mar', text: 'Signed by everyone' }, { when: 'Mon 2 Mar', text: 'Sent to Amelia and Jack' }] },
  { id: 'con-zoe-liam', names: ['Zoe', 'Liam'], title: 'MC agreement', item: 'Classic MC package', total: 3600, event: 'Sat 31 Oct 2026 · Centennial Homestead', when: 'Signed Fri 17 Apr', group: 'signed', signers: signers('Zoe Park', 'Liam Shaw', 'Thu 16 Apr', 'Fri 17 Apr', 'Fri 17 Apr'), history: [{ when: 'Fri 17 Apr', text: 'Signed by everyone' }] },
  { id: 'con-olivia-ben', names: ['Olivia', 'Ben'], title: 'MC agreement', item: 'Premium MC package', total: 4350, event: 'Sat 3 Oct 2026 · The Grounds', when: 'Signed Mon 12 Jan', group: 'signed', signers: signers('Olivia Chen', 'Ben Adler', 'Sun 11 Jan', 'Mon 12 Jan', 'Mon 12 Jan'), history: [{ when: 'Mon 12 Jan', text: 'Signed by everyone' }] },
  { id: 'con-isla-ethan', names: ['Isla', 'Ethan'], title: 'MC agreement', item: 'Premium MC package', total: 4350, event: 'Sat 6 Mar 2027 · Gunners Barracks', when: 'Signed Wed 20 May', group: 'signed', signers: signers('Isla Byrne', 'Ethan Cole', 'Tue 19 May', 'Wed 20 May', 'Wed 20 May'), history: [{ when: 'Wed 20 May', text: 'Signed by everyone' }] },
];

/** The couple's first names still to sign: "Max", "Hannah and Joe". */
export const waitingOn = (c: Contract) =>
  c.signers
    .filter((s) => s.role === 'Client' && !s.signed)
    .map((s) => s.name.split(' ')[0])
    .join(' and ');

/** "1 of 2 signed": only the clients count, the MC signs when sending. */
export const signedLine = (c: Contract) => {
  const clients = c.signers.filter((s) => s.role === 'Client');
  return `${clients.filter((s) => s.signed).length} of ${clients.length} signed`;
};
