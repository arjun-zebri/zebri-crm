import { TODAY, addDays, daysBetween, shortDate } from './dates';
import { EVENTS, NAMED_IDS, coupleName, type Invoice, type InvoiceSeed } from './payments-data';

/**
 * A couple's payment plan for one package, for the invoice modal's side
 * column: every instalment (deposit, second payment, final balance)
 * with where it stands. Instalments already invoiced come from the
 * invoices; the rest are worked out the way Zebri schedules them: a
 * quarter of the package as the deposit, the balance split in two, the
 * final falling two weeks before the wedding and the second halfway
 * between. Earlier instalments with no invoice here were paid before
 * the demo's records begin. Only the named couples' invoices are
 * gathered together; a generated invoice stands alone with its plan
 * filled in around it.
 *
 * @module app/design-system/v2/pages/dashboard/payments/plan
 */

const ORDER: InvoiceSeed['label'][] = ['Deposit', 'Second payment', 'Final payment'];

/** Where one instalment stands. */
export type StepState = 'paid' | 'overdue' | 'due' | 'upcoming';

/** One instalment in the plan. */
export interface PlanStep {
  label: 'Deposit' | 'Second payment' | 'Final balance';
  amount: number;
  state: StepState;
  /** The line under the label: "12 days overdue", "Due 15 Nov · 2 weeks before", "Paid 3 Mar". */
  sub: string;
  /** This instalment is the invoice open in the modal. */
  current: boolean;
}

const roundTo50 = (n: number) => Math.round(n / 50) * 50;
const noDay = (iso: string) => shortDate(iso).split(' ').slice(1).join(' ');

/** The plan around `invoice`, among every invoice. */
export function planFor(invoice: Invoice, all: Invoice[]) {
  const mine = NAMED_IDS.has(invoice.id)
    ? all.filter((i) => NAMED_IDS.has(i.id) && coupleName(i.names) === coupleName(invoice.names) && i.item === invoice.item)
    : [invoice];
  const byLabel = new Map(mine.map((i) => [i.label, i]));
  const event = EVENTS[coupleName(invoice.names)] ?? addDays(invoice.dueOn, invoice.label === 'Final payment' ? 14 : 120);
  const finalDue = byLabel.get('Final payment')?.dueOn ?? addDays(event, -14);
  const idx = mine.map((i) => ORDER.indexOf(i.label));
  const first = mine[idx.indexOf(Math.min(...idx))]!;
  const last = mine[idx.indexOf(Math.max(...idx))]!;
  const firstAt = ORDER.indexOf(first.label);
  const lastAt = ORDER.indexOf(last.label);
  // What the missing instalments must add up to: before the first invoice,
  // what it says was paid already; after the last, what is left.
  const before = first.paidBefore;
  const after = invoice.total - last.paidBefore - last.amount;
  const amountAt = (n: number) => {
    if (n < firstAt) {
      if (firstAt === 1) return before;
      const deposit = Math.min(before, roundTo50(invoice.total * 0.25));
      return n === 0 ? deposit : before - deposit;
    }
    const missingAfter = ORDER.length - 1 - lastAt;
    return Math.round(after / Math.max(1, missingAfter));
  };

  const steps: PlanStep[] = ORDER.map((label, n) => {
    const inv = byLabel.get(label);
    const name = label === 'Final payment' ? 'Final balance' : label;
    if (inv) {
      const state: StepState = inv.paidOn ? 'paid' : inv.group === 'overdue' ? 'overdue' : 'due';
      const sub = inv.paidOn
        ? `Paid ${noDay(inv.paidOn)}`
        : inv.late
          ? `${inv.late} days overdue`
          : `Due ${noDay(inv.dueOn)}`;
      return { label: name, amount: inv.amount, state, sub, current: inv.id === invoice.id };
    }
    const amount = amountAt(n);
    // Not invoiced before the first invoice we hold: paid before the records begin.
    if (n < firstAt) return { label: name, amount, state: 'paid', sub: 'Paid', current: false };
    const secondDue = addDays(last.dueOn, Math.round(daysBetween(last.dueOn, finalDue) / 2));
    const due = label === 'Final payment' ? finalDue : secondDue;
    const sub = `Due ${noDay(due)}${label === 'Final payment' ? ' · 2 weeks before' : ''}`;
    return { label: name, amount, state: due < TODAY ? 'overdue' : 'upcoming', sub, current: false };
  });
  const paid = steps.filter((s) => s.state === 'paid').reduce((s, x) => s + x.amount, 0);
  return { steps, paid };
}
