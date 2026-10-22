import type { DemoPackage } from '../../onboarding/packages';
import type { Client, Stage } from '../clients/clients-data';
import { mcSigns } from '../doc-builder/doc-types/contract/signing';
import type { ComposedPage } from '../doc-builder/doc-types/proposal/composed';
import type { DocLayout } from '../doc-builder/model/types';
import { TODAY, addDays, shortDate } from '../payments/dates';
import type { Contract, HistoryItem, InvoiceSeed } from '../payments/payments-data';
import type { ProposalSeed } from '../proposals/proposals-data';
import { PACKAGES, templateOf, type TemplateId } from '../proposals/templates-data';

/**
 * A new account's records, worked out from what the MC has done (who
 * they added, what they sent and when) and the clock. The test client's
 * replies are not stored: each lands `after` ms from its send, so the
 * records change by themselves as the replies come due, on every page
 * at once, and a reload mid-reply picks up where it was.
 *
 * Pure: `use-new-account.ts` holds the state and the clock.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/derive
 */

/** A client as stored. */
export interface Stored {
  id: string;
  names: [string, string];
  email: string;
  /** ISO, or empty. */
  date: string;
  venue: string;
  /** The rest of what New client takes (phone, guests, interest, source, notes), kept as given. */
  phone?: string | undefined;
  guests?: string | undefined;
  interest?: string | undefined;
  source?: string | undefined;
  notes?: string | undefined;
  /** The stage the MC moved them to by hand (Change stage); left out, it follows what was sent and paid. */
  stage?: Stage | undefined;
  /** The test client, who replies by themselves. */
  test: boolean;
  addedAt: number;
}

/**
 * A send as stored: to whom, when, and what the editor set on it (for a
 * proposal its template, package and words; for a contract its clauses;
 * for an invoice its deposit share, due date and note).
 */
export interface Sent {
  id: string;
  clientId: string;
  at: number;
  template?: TemplateId | undefined;
  /** For a proposal: the MC's own package it offers. */
  offer?: DemoPackage | undefined;
  headline?: string | undefined;
  welcome?: string | undefined;
  /** For a proposal: the page as composed, frozen at send. */
  composed?: ComposedPage | undefined;
  clauses?: [string, string][] | undefined;
  /** For a contract: the MC's contract as it was sent, frozen. */
  layout?: DocLayout | undefined;
  /** For an invoice: percent of the package, and days until due. */
  percent?: number | undefined;
  dueDays?: number | undefined;
  note?: string | undefined;
}

/**
 * When each test reply lands, in ms after the send. Paced to be watched:
 * each reply types itself out under the greeting and gets a few seconds
 * to be read before the next (at 1.5s apart they flashed past).
 */
export const REPLY = {
  proposal: { opened: 3000, picked: 7000, accepted: 11000 },
  contract: { opened: 3000, signed: 7000 },
  invoice: { opened: 3000, paid: 7000 },
} as const;

/** The test client: a couple, with an event about six months out. */
export const testClient = (at: number): Stored => ({
  id: `test-${at}`,
  names: ['Clara', 'Felix'],
  email: 'clara@test.zebri.app',
  date: addDays(TODAY, 180),
  venue: 'The Boathouse, Sydney',
  test: true,
  addedAt: at,
});

/** Whether a client id is the practice run's test client's. */
export const isTestClient = (id: string) => id.startsWith('test-');

const longDate = (iso: string) => `${shortDate(iso)} ${iso.slice(0, 4)}`;
const nameOf = (c: Stored) => (c.names[1] ? `${c.names[0]} & ${c.names[1]}` : c.names[0]);
/** The package a client leans to (and, testing, picks): the template's first. */
export const packageFor = (t: TemplateId) => templateOf(t).packages[0]!;

/** Newest first, as every history in the demo is written. */
const history = (items: [boolean, string][]): HistoryItem[] =>
  items.filter(([on]) => on).map(([, text]) => ({ when: 'Today', text })).reverse();

/**
 * A stored client as the account shows it; `booked` is whether they have
 * paid a deposit or been moved to Booked or later by hand, and `extra` is
 * what a booked one chose and paid, and their journey's dates ahead. A
 * stage set by hand wins over the one worked out from what was sent.
 */
export function toClient(c: Stored, proposal: boolean, booked: boolean, extra: Pick<Client, 'deal' | 'ahead'> = {}): Client {
  const stage: Stage = c.stage ?? (booked ? 'Booked' : proposal ? 'Proposal' : 'Enquiry');
  const read = extra.deal
    ? 'Booked and paid the deposit.'
    : booked
      ? `${stage === 'Booked' ? 'Booked' : `Moved to ${stage}`} by you.`
      : c.stage
        ? `Moved to ${stage} by you.`
        : proposal
          ? 'Has your proposal.'
          : 'Just added.';
  return {
    ...extra,
    id: c.id,
    names: c.names,
    date: c.date ? longDate(c.date) : 'Date to come',
    venue: c.venue || 'Venue to come',
    stage,
    since: 'Today',
    heat: booked ? 'Booked' : 'New',
    read,
    move: null,
    group: booked ? 'calm' : 'warm',
    email: c.email,
    // Added by hand in New client: what they typed, never the demo's "Website form".
    source: c.source?.trim() || 'Added by you',
  };
}

export function toProposal(s: Sent, c: Stored, now: number): ProposalSeed {
  const t = s.template ?? 'full-day';
  const ms = c.test ? now - s.at : -1;
  const opened = ms >= REPLY.proposal.opened;
  const picked = ms >= REPLY.proposal.picked;
  const accepted = ms >= REPLY.proposal.accepted;
  const pkg = packageFor(t);
  const name = s.offer?.name ?? PACKAGES[pkg].name;
  return {
    id: s.id,
    names: c.names,
    template: t,
    event: c.date || addDays(TODAY, 180),
    venue: c.venue || 'Venue to come',
    createdOn: TODAY,
    sentOn: TODAY,
    expiresOn: addDays(TODAY, 14),
    ...(opened ? { openedOn: TODAY, lastOpenedOn: TODAY, opens: 1 } : {}),
    ...(picked ? { reached: true, leaning: pkg } : {}),
    ...(accepted ? { acceptedOn: TODAY, chosen: pkg } : {}),
    offer: s.offer,
    headline: s.headline,
    welcome: s.welcome,
    ...(s.composed ? { composed: s.composed } : {}),
    history: history([
      [true, `Sent to ${nameOf(c)}`],
      [opened, `Opened by ${c.names[0]}`],
      [picked, `${c.names[0]} looked longest at ${name}`],
      [accepted, `Accepted ${name}`],
    ]),
  };
}

/** What a client's contract and invoice are for: their latest proposal's package. */
export const offerOf = (proposal: Sent | undefined): DemoPackage =>
  proposal?.offer ?? PACKAGES[packageFor(proposal?.template ?? 'full-day')];

/**
 * The deposit share a client's booking takes: what the MC set on the
 * proposal's Accept section when they sent it, else the account's
 * default. The proposal promised that number to the couple, so the
 * invoice must not quietly use another (2026-10-05 review).
 */
export const depositOf = (proposal: Sent | undefined, fallback: number): number => proposal?.composed?.terms.deposit ?? fallback;

export function toContract(s: Sent, c: Stored, p: DemoPackage, mc: string, now: number): Contract {
  const ms = c.test ? now - s.at : -1;
  const opened = ms >= REPLY.contract.opened;
  const signed = ms >= REPLY.contract.signed;
  return {
    id: s.id,
    names: c.names,
    title: 'Service agreement',
    item: p.name,
    total: p.price,
    event: `${c.date ? longDate(c.date) : 'Date to come'} · ${c.venue || 'Venue to come'}`,
    when: signed ? 'Signed today' : 'Sent today',
    sentOn: TODAY,
    group: signed ? 'signed' : 'waiting',
    signers: [
      ...c.names.filter(Boolean).map((n) => ({ name: n, role: 'Client' as const, signed: signed ? 'Today' : null })),
      // The MC signs on sending, unless their contract has the couple sign alone.
      ...(mcSigns(s.layout) ? [{ name: mc, role: 'You' as const, signed: 'Today' }] : []),
    ],
    clauses: s.clauses,
    layout: s.layout,
    history: history([
      [true, mcSigns(s.layout) ? `Sent to ${nameOf(c)}, signed by you` : `Sent to ${nameOf(c)}`],
      [opened, `Opened by ${c.names[0]}`],
      [signed, 'Signed by everyone'],
    ]),
  };
}

export function toInvoice(s: Sent, n: number, c: Stored, p: DemoPackage, deposit: number, now: number): InvoiceSeed {
  const ms = c.test ? now - s.at : -1;
  const opened = ms >= REPLY.invoice.opened;
  const paid = ms >= REPLY.invoice.paid;
  const percent = s.percent ?? deposit;
  return {
    id: s.id,
    number: 1001 + n,
    names: c.names,
    label: 'Deposit',
    amount: Math.round((p.price * percent) / 100),
    item: p.name,
    total: p.price,
    paidBefore: 0,
    dueOn: addDays(TODAY, s.dueDays ?? 7),
    note: s.note,
    paidOn: paid ? TODAY : null,
    method: paid ? 'Card' : null,
    sentOn: TODAY,
    ...(opened ? { openedBy: c.names[0], openedOn: TODAY } : {}),
    history: history([
      [true, `Sent to ${nameOf(c)}`],
      [opened, `Opened by ${c.names[0]}`],
      [paid, `Paid by ${c.names[0]}, card`],
    ]),
  };
}
