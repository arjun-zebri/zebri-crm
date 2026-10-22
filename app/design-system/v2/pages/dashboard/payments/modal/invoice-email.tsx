import type { ReactNode } from 'react';

import { DocumentsIcon, LockIcon } from '@/components/ui-v2/icons';

import { brandVars } from '../../../onboarding/brand-doc-parts';
import { Portrait } from '../../../onboarding/proposal-media';
import { INITIAL } from '../../../onboarding/use-onboarding-state';
import { useAccount, type BalanceFrom } from '../../account';
import { clientName } from '../../clients/clients-data';
import { TODAY, addSpan, fullDate, spanText, type Span } from '../dates';
import { coupleName, money, type Invoice } from '../payments-data';

/**
 * A payment invoice as the couple meets it: an email, not a sheet of
 * paper. It wears the MC's brand as the proposal does, because it lands
 * in the same inbox and should feel like the same business: their logo
 * and name at the top, the brand gradient behind the amount, their
 * heading font, the brand colour on the one action and the eyebrow.
 *
 * Top to bottom, the order a couple needs it:
 * - the amount, when it is due and what it secures, with Pay right
 *   under it (light on the brand colour, the one thing to press);
 * - the MC's note, signed with their portrait, as the proposal's welcome;
 * - the payment schedule, deposit then balance on a two-step line, over
 *   the package total, so the couple sees the whole of what they owe;
 * - the tax invoice attached as a PDF (the paper `InvoicePreview`).
 *
 * A deposit is the case it was built for. A later payment (anything
 * with `paidBefore`) wears the same email, so a couple's last invoice
 * looks like their first (founder, 2026-10-19): its label in the
 * eyebrow and on Pay, and the schedule showing what they have paid
 * already, then this payment, then whatever is still to come.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/invoice-email
 */

/** The note a deposit email goes out with. */
export const noteFor = (greet: string) =>
  `Hi ${greet}, here is your deposit to lock in your date. Once it is paid, you are all booked in. I can't wait.`;

/**
 * The couple's payment email. `balance` dates the balance on a
 * deposit's schedule: how long before the event (and the event's date
 * when known) or after this invoice; 14 days, undated, when left out.
 */
export function InvoiceEmail({
  invoice: i,
  balance = { span: { count: 14, unit: 'days' }, eventOn: null },
}: {
  invoice: Invoice;
  balance?: { span: Span; eventOn: string | null; from?: BalanceFrom | undefined } | undefined;
}) {
  const { clients, business, brand, mc } = useAccount();
  const client = clients.find((c) => clientName(c) === coupleName(i.names));
  const theme = brand ?? INITIAL.brand;
  const pct = (n: number) => Math.round((n / i.total) * 100);
  const deposit = i.paidBefore === 0;
  const later = i.total - i.paidBefore - i.amount;
  return (
    // Brand values are the MC's, chosen at runtime, so they arrive as custom properties.
    <article
      style={brandVars(theme)}
      className="mx-auto w-full max-w-xl overflow-hidden rounded-check bg-field font-[family-name:var(--b-body)] shadow-lg ring-1 ring-hairline"
    >
      <header className="flex h-14 items-center justify-center gap-3 border-b border-hairline px-6">
        {theme.logoUrl ? (
          // The MC's own file as a data URL: next/image cannot take it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.logoUrl} alt="" className="h-7 w-auto max-w-24 object-contain" />
        ) : null}
        <span className="truncate font-[family-name:var(--b-heading)] type-subheading text-zebra-950">{business}</span>
      </header>

      <section className="flex flex-col items-center bg-[image:var(--b-deep)] px-10 pb-10 pt-12 text-center text-[var(--b-on-primary)]">
        <p className="type-eyebrow opacity-75">
          {i.label} for {coupleName(i.names)}
        </p>
        <p className="mt-2 font-[family-name:var(--b-heading)] type-hero tabular-nums">{money(i.amount)}</p>
        <p className="mt-2 type-body opacity-80">
          Due {fullDate(i.dueOn)}, {deposit ? 'to secure' : 'for'} {client?.date ?? 'your date'}
        </p>
        <span className="mt-8 inline-flex h-11 items-center rounded-check bg-[var(--b-on-primary)] px-8 type-label text-[var(--b-primary)] shadow-sm">
          {deposit ? 'Pay deposit' : `Pay ${i.label.toLowerCase()}`}
        </span>
        <p className="mt-3 flex items-center gap-1.5 type-body opacity-70">
          <LockIcon aria-hidden="true" className="size-3.5" />
          Card, Apple Pay or Google Pay
        </p>
      </section>

      {i.note ? (
        <section className="space-y-5 px-10 pt-10">
          <p className="whitespace-pre-line type-body text-zebra-700">{i.note}</p>
          <div className="flex items-center gap-3">
            <Portrait />
            <span>
              <span className="block font-[family-name:var(--b-heading)] type-subheading text-zebra-950">{mc?.name ?? business}</span>
              <span className="block type-body text-zebra-500">Your {mc?.role ?? 'MC'}</span>
            </span>
          </div>
        </section>
      ) : null}

      <section aria-label="Payment schedule" className="space-y-5 px-10 py-10">
        <p className="type-eyebrow text-[var(--b-primary)]">Payment schedule</p>
        <ol className="relative space-y-6 before:absolute before:bottom-6 before:left-[5px] before:top-2 before:w-px before:bg-hairline">
          {deposit ? null : (
            <Step done label={`Paid so far, ${pct(i.paidBefore)}%`} when="Paid, thank you" amount={money(i.paidBefore)} />
          )}
          <Step now label={`${i.label}, ${pct(i.amount)}%`} when={`Due ${fullDate(i.dueOn)}`} amount={money(i.amount)} />
          {later > 0 ? (
            <Step
              label={`Balance, ${pct(later)}%`}
              when={
                !deposit
                  ? 'Still to come'
                  : 
              balance.from === 'invoice'
                    ? `Due ${fullDate(addSpan(TODAY, balance.span))}, ${spanText(balance.span)} after this invoice`
                    : balance.eventOn
                      ? `Due ${fullDate(addSpan(balance.eventOn, balance.span, -1))}, ${spanText(balance.span)} before your event`
                      : `${spanText(balance.span)} before your event`
              }
              amount={money(later)}
            />
          ) : null}
        </ol>
        <div className="flex justify-between gap-6 border-t border-hairline pt-4 type-body">
          <span className="text-zebra-500">{i.item}, incl. GST</span>
          <span className="type-numeric text-zebra-950">{money(i.total)}</span>
        </div>
      </section>

      <footer className="flex items-center gap-3 bg-zebra-50 px-10 py-4 type-body">
        <DocumentsIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-500" />
        <span className="min-w-0 flex-1 truncate text-zebra-700">Tax invoice #{i.number}.pdf</span>
        <span className="text-zebra-500">Questions? Just reply.</span>
      </footer>
    </article>
  );
}

/** One payment on the schedule: a dot on the line (filled for the one due now, and for one paid), what, when and how much. */
function Step({
  label,
  when,
  amount,
  now = false,
  done = false,
}: {
  label: string;
  when: string;
  amount: string;
  now?: boolean;
  done?: boolean;
}): ReactNode {
  return (
    <li className="relative flex items-start gap-4 pl-7">
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1.5 size-[11px] rounded-pill ${now || done ? 'bg-[var(--b-primary)]' : 'bg-field ring-1 ring-inset ring-hairline'}`}
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-zebra-950 ${now ? 'type-label' : 'type-body'}`}>{label}</span>
        <span className="block type-body text-zebra-500">{when}</span>
      </span>
      <span className={`tabular-nums ${now ? 'type-label text-zebra-950' : 'type-body text-zebra-700'}`}>{amount}</span>
    </li>
  );
}
