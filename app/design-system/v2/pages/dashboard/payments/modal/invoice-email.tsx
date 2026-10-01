import { FileText, Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { formatDate } from '@/components/ui-v2/date-field';

import { brandVars } from '../../../onboarding/brand-doc-parts';
import { Portrait } from '../../../onboarding/proposal-media';
import { INITIAL } from '../../../onboarding/use-onboarding-state';
import { useAccount } from '../../account';
import { clientName } from '../../clients/clients-data';
import { addSpan, spanText, type Span } from '../dates';
import { coupleName, money, type Invoice } from '../payments-data';

/**
 * A deposit invoice as the couple meets it: an email, not a sheet of
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
 * @module app/design-system/v2/pages/dashboard/payments/modal/invoice-email
 */

/** The note a deposit email goes out with. */
export const noteFor = (greet: string) =>
  `Hi ${greet}, here is your deposit to lock in your date. Once it is paid, you are all booked in. I can't wait.`;

/**
 * The couple's deposit email. `balance` dates the balance on the
 * schedule: how long before the event, and the event's date when
 * known; 14 days, undated, when left out.
 */
export function InvoiceEmail({
  invoice: i,
  balance = { span: { count: 14, unit: 'days' }, eventOn: null },
}: {
  invoice: Invoice;
  balance?: { span: Span; eventOn: string | null } | undefined;
}) {
  const { clients, business, brand, mc } = useAccount();
  const client = clients.find((c) => clientName(c) === coupleName(i.names));
  const theme = brand ?? INITIAL.brand;
  const share = Math.round((i.amount / i.total) * 100);
  return (
    // Brand values are the MC's, chosen at runtime, so they arrive as custom properties.
    <article
      style={brandVars(theme)}
      className="mx-auto w-full max-w-xl overflow-hidden rounded-panel bg-field font-[family-name:var(--b-body)] shadow-lg ring-1 ring-zebra-950/5"
    >
      <header className="flex h-14 items-center justify-center gap-3 border-b border-zebra-200 px-6">
        {theme.logoUrl ? (
          // The MC's own file as a data URL: next/image cannot take it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.logoUrl} alt="" className="h-7 w-auto max-w-24 object-contain" />
        ) : null}
        <span className="truncate font-[family-name:var(--b-heading)] type-subheading text-zebra-950">{business}</span>
      </header>

      <section className="flex flex-col items-center bg-[image:var(--b-deep)] px-10 pb-10 pt-12 text-center text-[var(--b-on-primary)]">
        <p className="type-eyebrow opacity-75">Deposit for {coupleName(i.names)}</p>
        <p className="mt-2 font-[family-name:var(--b-heading)] type-hero tabular-nums">{money(i.amount)}</p>
        <p className="mt-2 type-body opacity-80">
          Due {formatDate(i.dueOn)}, to secure {client?.date ?? 'your date'}
        </p>
        <span className="mt-8 inline-flex h-11 items-center rounded-check bg-[var(--b-on-primary)] px-8 type-label text-[var(--b-primary)] shadow-sm">
          Pay deposit
        </span>
        <p className="mt-3 flex items-center gap-1.5 type-body opacity-70">
          <Lock aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
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
        <ol className="relative space-y-6 before:absolute before:bottom-6 before:left-[5px] before:top-2 before:w-px before:bg-zebra-200">
          <Step now label={`Deposit, ${share}%`} when={`Due ${formatDate(i.dueOn)}`} amount={money(i.amount)} />
          <Step
            label={`Balance, ${100 - share}%`}
            when={
              balance.eventOn
                ? `Due ${formatDate(addSpan(balance.eventOn, balance.span, -1))}, ${spanText(balance.span)} before your event`
                : `${spanText(balance.span)} before your event`
            }
            amount={money(i.total - i.amount)}
          />
        </ol>
        <div className="flex justify-between gap-6 border-t border-zebra-950/10 pt-4 type-body">
          <span className="text-zebra-500">{i.item}, incl. GST</span>
          <span className="tabular-nums text-zebra-950">{money(i.total)}</span>
        </div>
      </section>

      <footer className="flex items-center gap-3 bg-zebra-50 px-10 py-4 type-body">
        <FileText aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-zebra-500" />
        <span className="min-w-0 flex-1 truncate text-zebra-700">Tax invoice #{i.number}.pdf</span>
        <span className="text-zebra-500">Questions? Just reply.</span>
      </footer>
    </article>
  );
}

/** One payment on the schedule: a dot on the line (filled for the one due now), what, when and how much. */
function Step({ label, when, amount, now = false }: { label: string; when: string; amount: string; now?: boolean }): ReactNode {
  return (
    <li className="relative flex items-start gap-4 pl-7">
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1.5 size-[11px] rounded-pill ${now ? 'bg-[var(--b-primary)]' : 'bg-field ring-1 ring-inset ring-zebra-300'}`}
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-zebra-950 ${now ? 'type-label' : 'type-body'}`}>{label}</span>
        <span className="block type-body text-zebra-500">{when}</span>
      </span>
      <span className={`tabular-nums ${now ? 'type-label text-zebra-950' : 'type-body text-zebra-700'}`}>{amount}</span>
    </li>
  );
}
