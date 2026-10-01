import { Clock } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';

import { shortDate } from '../dates';
import { money, type Invoice } from '../payments-data';
import { planFor, type StepState } from '../plan';
import type { PaymentsState } from '../use-payments-state';

import { History } from './document-facts';
import { followUpOn } from './reminder-drafts';

/**
 * The invoice modal's side column. First the package and how much of it
 * is paid, then the couple's whole payment plan with this invoice's
 * instalment picked out, so the MC sees one late deposit in the context
 * of what is still to come. Then History: what Zebri will do next
 * (follow up, or send it) with Pause beside it, and what has happened,
 * newest first, with a missed due date in red.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/invoice-side
 */

const DOT: Record<StepState, string> = {
  paid: 'bg-grass-500',
  overdue: 'bg-danger',
  due: 'bg-warning',
  upcoming: 'bg-zebra-300',
};

/** Zebri's next move on this invoice, if it has one. */
function nextMove(i: Invoice) {
  if (i.paidOn) return null;
  if (!i.sentOn && i.zebriSends) return { title: `Zebri sends it ${shortDate(i.zebriSends)}`, note: 'Then follows up if unpaid' };
  return { title: `Zebri follows up ${shortDate(followUpOn(i))}`, note: 'If still unpaid' };
}

/** The side column. */
export function InvoiceSide({ invoice: i, state }: { invoice: Invoice; state: PaymentsState }) {
  const { steps, paid } = planFor(i, state.invoices);
  const move = nextMove(i);
  const paused = state.paused.has(i.id);
  const history = state.reminded.has(i.id) ? [{ when: 'Just now', text: 'You sent a reminder' }, ...i.history] : i.history;
  return (
    <div className="space-y-8">
      <section aria-label="Payment plan" className="space-y-3">
        <div>
          <p className="type-body text-zebra-500">Package · {i.item.replace(/ package$/, '')}</p>
          <p className="flex items-baseline gap-1.5">
            <span className="type-title tabular-nums text-zebra-950">{money(paid)}</span>
            <span className="type-body text-zebra-500">of {money(i.total)} paid</span>
          </p>
        </div>
        <ul className="-mx-3">
          {steps.map((s) => (
            <li
              key={s.label}
              aria-current={s.current ? 'true' : undefined}
              className={`flex items-center gap-3 rounded-button px-3 py-2.5 ${s.current ? 'bg-zebra-950/[0.03]' : ''}`}
            >
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-pill ${DOT[s.state]}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate type-label text-zebra-950">{s.label}</span>
                <span className={`block truncate type-body ${s.state === 'overdue' ? 'text-danger' : 'text-zebra-500'}`}>
                  {s.sub}
                  {s.current ? ' · this invoice' : ''}
                </span>
              </span>
              <span className="type-label tabular-nums text-zebra-950">{money(s.amount)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="doc-history" className="space-y-3">
        <h3 id="doc-history" className="type-body text-zebra-500">
          History
        </h3>
        {move ? (
          <div className={`flex items-start gap-3 rounded-panel px-4 py-3 ${paused ? 'bg-zebra-100' : 'bg-grass-50'}`}>
            <Clock aria-hidden="true" strokeWidth={1.5} className={`mt-0.5 size-4 shrink-0 ${paused ? 'text-zebra-400' : 'text-grass-700'}`} />
            <span className="min-w-0 flex-1">
              <span className={`block type-label ${paused ? 'text-zebra-500 line-through' : 'text-grass-900'}`}>{move.title}</span>
              <span className="block type-body text-zebra-500">{paused ? 'Paused by you' : move.note}</span>
            </span>
            <Button variant="plain" onClick={() => state.togglePause(i.id)} className="-my-1">
              {paused ? 'Resume' : 'Pause'}
            </Button>
          </div>
        ) : null}
        <History items={history} />
      </section>
    </div>
  );
}
