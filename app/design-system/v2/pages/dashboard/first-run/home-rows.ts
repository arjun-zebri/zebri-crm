import { clientName } from '../clients/clients-data';
import type { CalendarEvent } from '../demo-activity';
import { TODAY, daysBetween } from '../payments/dates';
import { coupleName } from '../payments/payments-data';

import type { StepId, Tour } from './tour';
import type { NewAccount } from './use-new-account';

/**
 * A new account's Home, as the real Home's parts: the line under the
 * greeting, and the Up next rows. There is no separate guide. The guide's
 * steps are the MC's to-dos in Up next, written the way every later
 * to-do will be ("Clara & Felix accepted MC package. Send the contract."),
 * and what the client did shows in the row and the bell, as it always
 * will. When the practice run ends nothing swaps: the next to-do is
 * simply the first real client.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/home-rows
 */

/** What a to-do's button does: a step's job, starting the real round, or opening the plan sheet. */
export type Act = StepId | 'real' | 'plan';

/** Where a row that is only looked at leads. */
export type Look = 'proposals' | 'contracts' | 'invoices' | 'clients';

/** One Up next row. */
export interface HomeRow {
  id: string;
  /** Avatars for a client (their names), or an icon for the MC's own jobs and events. */
  lead: { names: [string, string] } | 'tools' | 'add' | 'plan' | 'event';
  title: string;
  detail: string;
  /** A time ("just now"), or a badge ("In 177 days"). */
  trail?: { time: string } | { badge: string; brand?: boolean } | undefined;
  /** A to-do: its button. `primary` on the one move that matters now. */
  action?: { label: string; act: Act; primary: boolean } | undefined;
  /** A row to look at: where it leads. */
  look?: Look | undefined;
}

const LOOK: Record<'proposal' | 'contract' | 'invoice', Look> = {
  proposal: 'proposals',
  contract: 'contracts',
  invoice: 'invoices',
};

/**
 * The line under the greeting. `live` lines type themselves out: once
 * something is sent to the test client, this line is the running
 * commentary ("Sent. Waiting for Clara to open it…", then each reply as
 * it lands), in place of a row rewriting itself in Up next.
 */
export interface Headline {
  text: string;
  live: boolean;
}

/** The line under the greeting, or null for none (as on the real Home when there is nothing to say). */
export function headlineOf(na: NewAccount, tour: Tour): Headline | null {
  const tester = na.progress.clients.find((c) => c.test);
  // After the practice run (the test client is cleared when the
  // celebration closes), until the first real client is in: what is next.
  if (tour.practised && !tour.client)
    return { text: 'That was the practice run. Now add a real client, and Zebri takes them from enquiry to paid.', live: true };
  if (!tester || tour.practised) return null;
  const who = coupleName(tester.names);
  if (!na.progress.toolsPicked)
    return { text: `Start by adding your first blocks. Then meet ${who}, a test client who replies in seconds.`, live: false };
  const latest = tour.activity[0];
  if (tour.test && latest)
    return latest.theirs
      ? // "is looking at" is still happening, so it trails off; the rest are done.
        { text: `${latest.text}${latest.what.startsWith('is ') ? '…' : '.'}`, live: true }
      : { text: `Sent. Waiting for ${tour.first} to open it…`, live: true };
  return { text: `${who} are a test client. They reply in seconds, so you can see what your clients see.`, live: false };
}

/** The Up next rows, to-dos first, then what is waiting on clients, then booked events. */
export function rowsOf(na: NewAccount, tour: Tour): HomeRow[] {
  const rows: HomeRow[] = [];
  // Nothing new arrives under the booking celebration; Home opens up after it.
  if (tour.celebrating) return rows;
  const primary = (act: Act) => tour.move.step === act || (act === 'real' && tour.complete && tour.test);
  if (!na.progress.toolsPicked)
    rows.push({
      id: 'tools',
      lead: 'tools',
      // Says what a block is (the word is new to everyone arriving), led by
      // the word itself as every other row is led by who it is about.
      title: 'Blocks',
      // Playful but plain: the Lego picture explains "pick only the pieces
      // you need" in one word, and "add more as you grow" says nothing is lost by starting small.
      detail: 'are the Lego pieces of Zebri. Pick only what you need now, and add more as you grow.',
      action: { label: 'Add blocks', act: 'tools', primary: primary('tools') },
    });

  const c = tour.client;
  const stored = na.progress.clients.find((s) => s.id === c?.id);
  // The client waits until the tools are picked: one to-do at a time at the start.
  // While the test client is replying, the headline tells it and Up next
  // steps aside; the row comes back with its button when there is a move.
  const replying = tour.pending && tour.test;
  if (c && stored && na.progress.toolsPicked && !(tour.complete && tour.test) && !replying) {
    const base = { id: `client-${c.id}`, lead: { names: c.names }, title: clientName(c) };
    const latest = tour.activity[0];
    const doc = tour.nextDoc;
    if (tour.complete)
      rows.push({ ...base, detail: 'has everything. Zebri follows up if they go quiet.', look: 'clients' });
    else if ((tour.pending || tour.docWaiting) && latest)
      // A reply is on its way, or a real client has yet to accept: what they did last, and when.
      rows.push({
        ...base,
        detail: latest.theirs ? latest.what : `has your ${latest.what.replace(/^sent the /, '')}`,
        trail: { time: latest.at > na.now - 60_000 ? 'just now' : `${Math.floor((na.now - latest.at) / 60_000)} min ago` },
        look: LOOK[doc ?? 'proposal'],
      });
    else if (doc === 'proposal')
      rows.push({
        ...base,
        detail: stored.test
          ? 'just got in touch! Send them a proposal and watch them reply.'
          : 'just got in touch! Send them a proposal.',
        action: { label: 'Send proposal', act: 'proposal', primary: primary('proposal') },
      });
    else if (doc === 'contract')
      rows.push({
        ...base,
        detail: `accepted ${tour.pkg.name}. Send the contract.`,
        action: { label: 'Send contract', act: 'contract', primary: primary('contract') },
      });
    else if (doc === 'invoice')
      rows.push({
        ...base,
        detail: 'signed. Send the deposit invoice.',
        action: { label: 'Send invoice', act: 'invoice', primary: primary('invoice') },
      });
  }

  if (tour.current === 'client' || (tour.complete && tour.test && !tour.practised))
    rows.push({
      id: 'add',
      lead: 'add',
      title: 'Add your first real client',
      detail: 'their name and their event',
      action: { label: 'New client', act: tour.current === 'client' ? 'client' : 'real', primary: true },
    });

  // The plan, beside the job rather than in front of it (as Shopify's
  // setup guide lists "Pick a plan" among its tasks): visible from the end
  // of setup until the week starts, secondary to the client. Adding a real
  // client still opens the same sheet, so either route gets there.
  if (tour.onboarded && !na.progress.plan)
    rows.push({
      id: 'plan',
      lead: 'plan',
      title: 'Start your free week',
      detail: 'nothing today, and 20% off your first 12 months',
      action: { label: 'Pick a plan', act: 'plan', primary: false },
    });

  // Booked clients' events, as the real Home shows the next event.
  for (const s of na.progress.clients) {
    const booked = na.account.clients.find((x) => x.id === s.id && x.stage === 'Booked');
    if (!booked || !s.date) continue;
    rows.push({
      id: `event-${s.id}`,
      lead: 'event',
      title: clientName(booked),
      detail: `${booked.date} · ${booked.venue}`,
      trail: { badge: `In ${daysBetween(TODAY, s.date)} days`, brand: true },
      look: 'clients',
    });
  }
  return rows;
}

/** The calendar's events for a new account: each booked client's day, as offsets from today. */
export function eventsOf(na: NewAccount): CalendarEvent[] {
  const today = new Date();
  return na.progress.clients.flatMap((s) => {
    const booked = na.account.clients.some((x) => x.id === s.id && x.stage === 'Booked');
    if (!booked || !s.date) return [];
    const day = Math.round((new Date(`${s.date}T00:00`).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
    return [{ day, time: '5:00pm', title: coupleName(s.names), detail: `Event · ${s.venue}`, booked: true }];
  });
}
