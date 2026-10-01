import { TODAY, shortDate } from '../dates';
import type { Invoice } from '../payments-data';

/**
 * Where an invoice has got to, as five steps along the top of the
 * invoice modal: Sent, Opened, Due, Reminded, Paid. Each is a short bar
 * over its name and date, green once it has happened, red for a due
 * date that passed unpaid, grey while still to come. One line, read
 * left to right, so the MC sees at a glance that Ella opened it, it
 * fell due, a reminder went, and it is still not paid.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/invoice-progress
 */

type Tone = 'done' | 'late' | 'todo';

const BAR: Record<Tone, string> = { done: 'bg-grass-700', late: 'bg-danger/70', todo: 'bg-zebra-200' };
const NAME: Record<Tone, string> = { done: 'text-zebra-950', late: 'text-danger', todo: 'text-zebra-400' };

const day = (iso: string) => shortDate(iso).split(' ').slice(1).join(' ');

/** The five steps for an invoice. `reminded` is a reminder sent this visit. */
function stepsOf(i: Invoice, reminded: boolean): { name: string; date: string; tone: Tone }[] {
  const remindedOn = reminded ? TODAY : i.remindedOn;
  return [
    i.sentOn
      ? { name: 'Sent', date: day(i.sentOn), tone: 'done' }
      : { name: 'Sent', date: i.zebriSends ? `Sends ${day(i.zebriSends)}` : '—', tone: 'todo' },
    { name: 'Opened', date: i.openedOn ? day(i.openedOn) : '—', tone: i.openedOn ? 'done' : 'todo' },
    { name: 'Due', date: day(i.dueOn), tone: i.paidOn ? 'done' : i.late ? 'late' : 'todo' },
    { name: 'Reminded', date: remindedOn ? day(remindedOn) : '—', tone: remindedOn ? 'done' : 'todo' },
    { name: 'Paid', date: i.paidOn ? day(i.paidOn) : '—', tone: i.paidOn ? 'done' : 'todo' },
  ];
}

/** The progress track. */
export function InvoiceProgress({ invoice, reminded }: { invoice: Invoice; reminded: boolean }) {
  return (
    <ol aria-label="Progress" className="grid grid-cols-5 gap-1.5">
      {stepsOf(invoice, reminded).map((s) => (
        <li key={s.name} className="min-w-0 space-y-2">
          <span aria-hidden="true" className={`block h-1 rounded-pill ${BAR[s.tone]}`} />
          <span className="block">
            <span className={`block truncate type-label ${NAME[s.tone]}`}>{s.name}</span>
            <span className="block truncate type-body tabular-nums text-zebra-500">{s.date}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
