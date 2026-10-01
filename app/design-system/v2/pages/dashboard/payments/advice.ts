import { TODAY, addDays, daysBetween, monthDay, shortDate } from './dates';
import type { InsightCard } from './overview/insights/tone';
import { EVENTS, coupleName, money, type Contract, type Invoice } from './payments-data';

/**
 * Zebri AI's insights on the Payments Overview, behind AI insights on the
 * cash flow chart. Each is something the chart cannot show: it reads who
 * opened what, who has signed, when each wedding is and how each couple
 * paid, and ends in one move to make. In order:
 * - late invoices only one partner has seen (remind the other one);
 * - bookings waiting on a signature, and on whom;
 * - final payments that fall due in the fortnight before the wedding
 *   (move the plan's final payment earlier);
 * - how much sooner card payments land than bank transfers (put card
 *   first on invoices).
 * Each is left out when the data does not back it. Demo stand-in for what
 * the model would write; every number is worked out from the demo data.
 *
 * @module app/design-system/v2/pages/dashboard/payments/advice
 */

/** What the insight's button does: send reminders or nudges, or change a setting. */
export type PaymentAction =
  | { kind: 'chase'; ids: string[] }
  | { kind: 'nudge'; ids: string[] }
  | { kind: 'setting'; id: 'final-30' | 'card-first' };

/** One insight: the dialog's card, plus what its button does. */
export interface PaymentAdvice extends InsightCard {
  id: 'late' | 'unsigned' | 'plan' | 'method';
  action: PaymentAction;
}

const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''));
const dayMonth = (iso: string) => shortDate(iso).split(' ').slice(1).join(' ');

/** Late invoices only one partner has opened: the other one has not seen it at all. */
function lateAdvice(invoices: Invoice[]): PaymentAdvice | null {
  const late = invoices.filter((i) => i.group === 'overdue' && i.openedBy).sort((a, b) => b.late - a.late);
  if (late.length === 0) return null;
  const other = (i: Invoice) => i.names.find((n) => n !== i.openedBy)!;
  const unseen = late.map(other);
  return {
    id: 'late',
    tone: 'danger',
    tag: 'Overdue',
    metric: money(late.reduce((s, i) => s + i.amount, 0)),
    title: late.length === 1 ? 'Only one partner has seen the late invoice' : 'Only one partner has seen each late invoice',
    why: late
      .map(
        (i) =>
          `${i.openedBy} opened ${coupleName(i.names)}’s ${i.label.toLowerCase()} on ${dayMonth(i.openedOn!)}${
            i.remindedOn ? ' and Zebri’s reminder after it' : ''
          }; ${other(i)} hasn’t opened anything.`,
      )
      .join(' '),
    rows: late.map((i) => ({ name: coupleName(i.names), detail: `Only ${i.openedBy} has looked · ${i.late} days late` })),
    move: `Send the next reminder to ${list(unseen)} instead, by text. Another email to the partner who has already seen it is the one most likely to be ignored.`,
    label: `Remind ${list(unseen)}`,
    doneLabel: 'Sent',
    action: { kind: 'chase', ids: late.map((i) => i.id) },
  };
}

/** Contracts out for signature, and whose name each is waiting on. */
function unsignedAdvice(contracts: Contract[]): PaymentAdvice | null {
  const waiting = contracts.filter((c) => c.group === 'waiting' && c.sentOn).sort((a, b) => a.sentOn!.localeCompare(b.sentOn!));
  if (waiting.length === 0) return null;
  const first = (name: string) => name.split(' ')[0]!;
  const read = (c: Contract) => {
    const clients = c.signers.filter((s) => s.role === 'Client');
    const signers = clients.filter((s) => s.signed);
    const signed = signers.map((s) => first(s.name));
    const pending = clients.filter((s) => !s.signed).map((s) => first(s.name));
    const opened = c.history.find((h) => h.text.startsWith('Opened by'));
    const days = daysBetween(c.sentOn!, TODAY);
    const story = signed.length
      ? `${list(signed)} signed ${coupleName(c.names)}’s on ${signers[0]!.signed}; ${list(pending)} hasn’t in the ${days} days since it went out.`
      : opened
        ? `${opened.text.replace('Opened by ', '')} opened ${coupleName(c.names)}’s on ${opened.when}, but nobody has signed in ${days} days.`
        : `Nobody has opened ${coupleName(c.names)}’s in ${days} days.`;
    return { pending, days, story, opened: !signed.length && opened ? opened.text.replace('Opened by ', '') : null };
  };
  const reads = waiting.map((c) => ({ c, ...read(c) }));
  const asks = reads.filter((r) => r.opened).map((r) => r.opened!);
  return {
    id: 'unsigned',
    tone: 'warning',
    tag: 'Unsigned',
    metric: money(waiting.reduce((s, c) => s + c.total, 0)),
    title: `${money(waiting.reduce((s, c) => s + c.total, 0))} of bookings aren’t locked in yet`,
    why: `${reads.map((r) => r.story).join(' ')} Until everyone signs, those dates aren’t held.`,
    rows: reads.map((r) => ({ name: coupleName(r.c.names), detail: `Waiting on ${list(r.pending)} · ${r.days} days` })),
    move: `Nudge ${list(reads.flatMap((r) => r.pending))} by name${
      asks.length ? `, and ask ${list(asks)} whether anything in the agreement needs changing: opening it and not signing often means a question` : ''
    }.`,
    label: `Nudge ${list(reads.flatMap((r) => r.pending))}`,
    doneLabel: 'Nudged',
    action: { kind: 'nudge', ids: waiting.map((c) => c.id) },
  };
}

/** Upcoming final payments due within two weeks of the wedding. */
function planAdvice(invoices: Invoice[]): PaymentAdvice | null {
  const finals = invoices
    .filter((i) => i.label === 'Final payment' && !i.paidOn && i.dueOn >= TODAY && EVENTS[coupleName(i.names)])
    .map((i) => ({ i, wedding: EVENTS[coupleName(i.names)]!, gap: daysBetween(i.dueOn, EVENTS[coupleName(i.names)]!) }))
    .sort((a, b) => a.i.dueOn.localeCompare(b.i.dueOn));
  const tight = finals.filter((f) => f.gap <= 14);
  if (tight.length < 2) return null;
  const closest = tight.reduce((a, b) => (b.gap < a.gap ? b : a));
  return {
    id: 'plan',
    tone: 'brand',
    tag: 'Payment plan',
    metric: `${tight.length} of ${finals.length}`,
    title: 'Final payments land in wedding fortnight',
    why: `${tight.length} of your ${finals.length} upcoming final payments fall due two weeks or less before the wedding, ${money(
      tight.reduce((s, f) => s + f.i.amount, 0),
    )} in all. ${coupleName(closest.i.names)}’s is due ${closest.gap} days before theirs. If one runs late, you’re chasing it the week you’re writing their run sheet.`,
    rows: finals.map((f) => ({
      name: coupleName(f.i.names),
      detail: `Due ${monthDay(f.i.dueOn)} · wedding ${monthDay(f.wedding)} (${f.gap} days)`,
    })),
    move: `Make final payments due 30 days before the wedding in your payment plan. New bookings get the new date; these couples keep theirs, so nothing changes on invoices already sent. A final due ${monthDay(
      addDays(closest.wedding, -30),
    )} would have given ${coupleName(closest.i.names)} three extra weeks.`,
    label: 'Change my payment plan',
    doneLabel: 'Plan updated',
    action: { kind: 'setting', id: 'final-30' },
  };
}

/** How long card and bank payments take to land, over the last year. */
function methodAdvice(invoices: Invoice[]): PaymentAdvice | null {
  const from = addDays(TODAY, -365);
  const paid = invoices.filter((i) => i.paidOn && i.sentOn && i.method && i.paidOn >= from);
  const by = (m: Invoice['method']) => {
    const xs = paid.filter((i) => i.method === m).map((i) => daysBetween(i.sentOn!, i.paidOn!));
    return { n: xs.length, avg: xs.length ? Math.round((xs.reduce((s, d) => s + d, 0) / xs.length) * 10) / 10 : 0 };
  };
  const card = by('Card');
  const bank = by('Bank transfer');
  if (card.n < 3 || bank.n < 3 || bank.avg - card.avg < 3) return null;
  const faster = Math.round(bank.avg - card.avg);
  return {
    id: 'method',
    tone: 'brand',
    tag: 'Getting paid',
    metric: `${faster} days`,
    title: `Card payments land ${faster} days sooner`,
    why: `Over the last 12 months, couples who paid by card did it ${card.avg} days after the invoice went out, on average. Bank transfers took ${bank.avg} days. ${bank.n} of ${paid.length} payments still came by bank, so most of the waiting is on those.`,
    rows: [
      { name: 'Card', detail: `${card.avg} days on average · ${card.n} payments` },
      { name: 'Bank transfer', detail: `${bank.avg} days on average · ${bank.n} payments` },
    ],
    move: 'Put card first on your invoices, with a Pay now button, and move your bank details underneath it. Couples who want to transfer still can.',
    label: 'Put card first',
    doneLabel: 'Card is first',
    action: { kind: 'setting', id: 'card-first' },
  };
}

/** Zebri's insights, most urgent first; empty when there is nothing to say. */
export function paymentInsights(invoices: Invoice[], contracts: Contract[]): PaymentAdvice[] {
  return [lateAdvice(invoices), unsignedAdvice(contracts), planAdvice(invoices), methodAdvice(invoices)].filter(
    (a): a is PaymentAdvice => a !== null,
  );
}
