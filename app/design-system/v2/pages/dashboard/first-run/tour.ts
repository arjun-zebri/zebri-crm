import type { Account } from '../account';
import type { Notification, NotificationKind } from '../demo-activity';
import { money } from '../payments/payments-data';

import { REPLY, offerOf, type Stored } from './derive';
import type { NewAccount } from './use-new-account';

/**
 * The first-run guide, worked out from the new account: the one move
 * that matters next (its words, and where its button leads), the client
 * the guide is following, and their activity (what the MC sent and what
 * the test client did back). Home turns this into Up next rows and
 * notifications; the spotlight on the other pages rings the button for
 * the same move.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/tour
 */

export type StepId = 'tools' | 'client' | 'proposal' | 'contract' | 'invoice';

/** The steps whose job is done on a page (Build your Zebri opens over Home). */
export type PageStep = Exclude<StepId, 'tools'>;

/** Where a step's job is done, and the `data-tour` of the button that starts it there. */
export interface Where {
  page: 'Clients' | 'Proposals' | 'Payments';
  tab?: 'proposals' | 'contracts' | 'invoices' | undefined;
  target: string;
}

export const WHERE: Record<PageStep, Where> = {
  client: { page: 'Clients', target: 'new-client' },
  proposal: { page: 'Proposals', tab: 'proposals', target: 'new-proposal' },
  contract: { page: 'Payments', tab: 'contracts', target: 'new-contract' },
  invoice: { page: 'Payments', tab: 'invoices', target: 'new-invoice' },
};

/** Which block each document needs; a step whose block was left out is skipped. */
const NEEDS = { proposal: 'proposals', contract: 'contracts', invoice: 'payments' } as const;

/** One line of a client's activity. */
export interface Event {
  at: number;
  /** "Clara opened your proposal", "You sent the contract". */
  text: string;
  /** The same without the name, for where the name is already said ("opened your proposal"). */
  what: string;
  /** Said by the client (a reply) rather than done by the MC. */
  theirs: boolean;
  /** For a reply: how the notification panel marks it, and its second line. */
  kind: NotificationKind;
  detail: string;
}

/** The next move: what Home says, and the button, when there is one. */
export interface Move {
  step: StepId | null;
  title: string;
  detail: string;
  button: string | null;
}

/** "under a minute", "1 minute", "3 minutes". */
export function minutes(ms: number) {
  const m = Math.round(ms / 60_000);
  return m < 1 ? 'under a minute' : `${m} minute${m === 1 ? '' : 's'}`;
}

type Doc = 'proposal' | 'contract' | 'invoice';
type Line = [after: number, what: string, kind: NotificationKind, detail: string];

/**
 * A client's activity, newest first: what the MC sent them, and (for the
 * test client) each scripted reply that has come due by `now`.
 */
export function activityOf({ progress: p, account, now }: Pick<NewAccount, 'progress' | 'account' | 'now'>, c: Stored): Event[] {
  const last = (k: 'proposals' | 'contracts' | 'invoices') => [...p[k]].reverse().find((s) => s.clientId === c.id);
  const sent = { proposal: last('proposals'), contract: last('contracts'), invoice: last('invoices') };
  const pkg = offerOf(sent.proposal);
  const deposit = Math.round((pkg.price * (sent.invoice?.percent ?? account.deposit)) / 100);
  const script: Record<Doc, Line[]> = {
    proposal: [
      [REPLY.proposal.opened, 'opened your proposal', 'comment', `${pkg.name} · ${money(pkg.price)}`],
      [REPLY.proposal.picked, `is looking at ${pkg.name}`, 'comment', 'Read the packages twice'],
      [REPLY.proposal.accepted, `accepted ${pkg.name}, ${money(pkg.price)}`, 'signed', 'Ready for the contract'],
    ],
    contract: [
      [REPLY.contract.opened, 'opened the contract', 'comment', 'Service agreement'],
      [REPLY.contract.signed, 'signed the contract', 'signed', 'Service agreement · everyone has signed'],
    ],
    invoice: [
      [REPLY.invoice.opened, 'opened the invoice', 'comment', `${money(deposit)} deposit`],
      [REPLY.invoice.paid, `paid the ${money(deposit)} deposit`, 'payment', `${money(deposit)} · card`],
    ],
  };
  const yours = { proposal: 'sent the proposal', contract: 'sent the contract', invoice: 'sent the deposit invoice' };
  return (['proposal', 'contract', 'invoice'] as const)
    .flatMap((step): Event[] => {
      const at = sent[step]?.at;
      if (at === undefined) return [];
      const replies = c.test
        ? script[step].map(([after, what, kind, detail]) => ({ at: at + after, text: `${c.names[0]} ${what}`, what, theirs: true, kind, detail }))
        : [];
      return [{ at, text: `You ${yours[step]}`, what: yours[step], theirs: false, kind: 'comment', detail: '' }, ...replies];
    })
    .filter((e) => e.at <= now)
    .sort((a, b) => b.at - a.at);
}

/** Every reply so far as a notification, for the bell: newest first, each unread until opened. */
export function noticesOf(na: Pick<NewAccount, 'progress' | 'account' | 'now'>): Notification[] {
  return na.progress.clients.flatMap((c) =>
    activityOf(na, c)
      .filter((e) => e.theirs)
      .map((e) => ({
        id: `${c.id}-${e.at}`,
        kind: e.kind,
        who: c.names[1] ? `${c.names[0]} & ${c.names[1]}` : c.names[0],
        what: e.what,
        detail: e.detail,
        ago: agoShort(e.at, na.now),
        today: true,
        unread: true,
      })),
  ).sort((a, b) => b.id.localeCompare(a.id));
}

/** "now", "3m": the notification panel's clock. */
const agoShort = (at: number, now: number) => {
  const m = Math.floor((now - at) / 60_000);
  return m < 1 ? 'now' : `${m}m`;
};

/** The counts under Up next, from the account: what unpaid invoices add up to, and proposals not yet accepted. */
export function countsOf(account: Account) {
  return {
    outstanding: account.invoices.filter((i) => !i.paidOn).reduce((sum, i) => sum + i.amount, 0),
    unsigned: account.proposals.filter((x) => !x.acceptedOn).length,
  };
}

/** The guide's state. */
export function tourOf(na: NewAccount) {
  const { handoff, progress: p, account, pending } = na;
  const blocks = p.blocks ?? handoff.blocks;
  const steps: StepId[] = [
    'tools',
    'client',
    ...(['proposal', 'contract', 'invoice'] as const).filter((s) => blocks.includes(NEEDS[s])),
  ];
  const stored = p.clients.find((c) => c.id === p.round.clientId) ?? null;
  const client = account.clients.find((c) => c.id === stored?.id) ?? null;
  const first = stored?.names[0] ?? '';
  const who = client ? (stored!.names[1] ? `${stored!.names[0]} & ${stored!.names[1]}` : first) : '';
  const last = (k: 'proposals' | 'contracts' | 'invoices') =>
    stored ? [...p[k]].reverse().find((s) => s.clientId === stored.id) : undefined;
  const sent = { proposal: last('proposals'), contract: last('contracts'), invoice: last('invoices') };
  const accepted = account.proposals.some((x) => x.id === sent.proposal?.id && x.acceptedOn);
  const done = (s: StepId) => (s === 'tools' ? p.toolsPicked : s === 'client' ? stored !== null : sent[s] !== undefined);
  const current = steps.find((s) => !done(s)) ?? null;
  // The contract and invoice are made from the accepted proposal, so they wait on it.
  const waiting = (current === 'contract' || current === 'invoice') && !accepted;
  // The followed client's next document, whatever else (Build your Zebri) is still to do.
  const nextDoc = (['proposal', 'contract', 'invoice'] as const).find((s) => steps.includes(s) && !done(s)) ?? null;
  const docWaiting = (nextDoc === 'contract' || nextDoc === 'invoice') && !accepted;
  const tester = p.clients.find((c) => c.test);
  const booked = tester !== undefined && account.clients.some((c) => c.id === tester.id && c.stage === 'Booked');
  // Setup ends when the MC closes the booking celebration, not the moment
  // the deposit lands, so Home opens up after the moment, not under it.
  const onboarded = p.round.practised || (booked && Boolean(p.celebrated));
  /** The test client has paid and the moment has not been marked yet. */
  const celebrating = booked && !p.round.practised && !p.celebrated;
  /**
   * How far setup has got, 0 to 4: tools picked (1), the contract is next
   * (2), the invoice is next (3), done (4). The sidebar opens each page
   * as setup reaches it.
   */
  const reach = onboarded
    ? 4
    : !p.toolsPicked
      ? 0
      : nextDoc === 'contract'
        ? docWaiting ? 1 : 2
        : nextDoc === 'invoice'
          ? docWaiting ? 2 : 3
          : nextDoc === 'proposal'
            ? 1
            : 4;
  const test = stored?.test ?? false;
  const pkg = offerOf(sent.proposal);
  const deposit = Math.round((pkg.price * (sent.invoice?.percent ?? account.deposit)) / 100);
  const activity = stored ? activityOf(na, stored) : [];
  const latestReply = activity.find((e) => e.theirs) ?? null;
  const complete = current === null && !pending;
  // From the client landing in Zebri to their last reply.
  const loop = stored && latestReply ? minutes(latestReply.at - stored.addedAt) : '';

  const move: Move = complete
    ? test
      ? { step: null, title: `${latestReply?.text ?? `${first} is booked`}.`, detail: `New client to paid in ${loop}. Every real client can go the same way.`, button: 'Add a real client' }
      : { step: null, title: `Everything is out to ${first}.`, detail: 'Zebri tells you as they open, sign and pay, and nudges them if they go quiet.', button: null }
    : current === 'tools'
      ? { step: 'tools', title: 'Add your first blocks', detail: 'Blocks are the Lego pieces of Zebri. Pick only what you need now, and add more as you grow.', button: 'Add blocks' }
    : current === 'client'
      ? { step: 'client', title: 'Add your first real client', detail: 'Their name and their event. Zebri follows them from here.', button: 'New client' }
      : pending
        ? { step: null, title: `${first} has it open`, detail: 'Their replies land here as they happen.', button: null }
        : waiting
          ? { step: null, title: `${first} has your proposal`, detail: `Zebri tells you the moment ${first} opens it. The contract and deposit follow once they accept.`, button: null }
          : current === 'proposal'
            ? { step: 'proposal', title: `Send ${who} a proposal`, detail: test ? `${first} is a test client who replies in seconds, so you can see what your clients see.` : 'Pick a template. Your brand and price are already on it.', button: 'Send a proposal' }
            : current === 'contract'
              ? { step: 'contract', title: `${first} accepted. Send the contract.`, detail: 'Made from their proposal. You sign it once, and never again.', button: 'Send the contract' }
              : { step: 'invoice', title: 'Now the deposit', detail: `${money(deposit)} that locks in their date. ${first} pays by card.`, button: 'Send the deposit invoice' };

  return {
    client,
    first,
    who,
    current,
    waiting,
    nextDoc,
    docWaiting,
    pending,
    onboarded,
    celebrating,
    reach,
    move,
    activity,
    latestReply,
    complete,
    test,
    pkg,
    loop,
    practised: p.round.practised,
  };
}

export type Tour = ReturnType<typeof tourOf>;
