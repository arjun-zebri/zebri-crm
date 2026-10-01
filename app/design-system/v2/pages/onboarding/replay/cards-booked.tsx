import { CalendarCheck, Check, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { WEDDING, aud } from '../brand-doc-parts';

import { CLIENT, DATES, type ReplayData } from './replay-data';
import { CardTitle, Eyebrow, Reveal, type Beat } from './replay-parts';

/**
 * The replay's closing scenes: both signatures going on (the MC's own,
 * from step 5), the deposit invoice raised the moment they do and paid
 * by the couple, and the booking itself.
 *
 * @module app/design-system/v2/pages/onboarding/replay/cards-booked
 */

const SCRIPT = 'type-title font-normal tracking-normal font-[family-name:var(--font-signature)]';

/**
 * A signature line whose mark writes itself in from the left once
 * `on`, with who signed beside it. Full width, one under the other: a
 * full name in script does not fit half the card.
 */
function Signature({ on, who, role, children }: { on: boolean; who: string; role: string; children: ReactNode }) {
  return (
    <div className="flex items-end gap-4">
      <div className="relative h-14 min-w-0 flex-1 overflow-hidden border-b border-zebra-300">
        <div
          className={`absolute bottom-0 left-0 flex h-full items-end overflow-hidden whitespace-nowrap transition-[width] duration-1100 ease-[cubic-bezier(0.5,0,0.3,1)] motion-reduce:transition-none ${
            on ? 'w-full' : 'w-0'
          }`}
        >
          {children}
        </div>
      </div>
      <div className="w-28 shrink-0 pb-0.5">
        <p className="truncate type-body text-zebra-950">{who}</p>
        <p className="truncate type-body text-zebra-500">{role}</p>
      </div>
    </div>
  );
}

/** The MC's signature as they made it in step 5: drawn or uploaded, typed, or their name if they skipped. */
function OwnMark({ d }: { d: ReplayData }) {
  const s = d.signature;
  if (s?.kind === 'image') {
    // A data URL made in step 5: next/image cannot take it.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={s.src} alt={`${d.signer}'s signature`} className="h-14 w-auto max-w-none object-contain object-left-bottom" />;
  }
  return <span className={`${SCRIPT} pb-1 text-zebra-950`}>{s?.kind === 'typed' ? s.text : d.signer}</span>;
}

/** 7. The couple signs, then the MC's own signature follows. */
export function SignedCard({ on, d }: { on: Beat; d: ReplayData }) {
  return (
    <>
      <Eyebrow>Signatures</Eyebrow>
      <CardTitle className="mt-3">Agreed and signed</CardTitle>
      <div className="mt-5 space-y-4">
        <Signature on={on(0)} who={CLIENT.name} role="Client">
          <span className={`${SCRIPT} pb-1 text-zebra-950`}>{CLIENT.name}</span>
        </Signature>
        <Signature on={on(1)} who={d.signer} role="Your signature">
          <OwnMark d={d} />
        </Signature>
      </div>
    </>
  );
}

/** An invoice amount: always with cents, as invoices print them. */
const cents = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 });

/**
 * 8. The deposit invoice, as a real one reads: who it is from and to,
 * its number and dates, the one line, GST, the total and the balance
 * still to come. Then Sarah pays it.
 */
export function InvoiceCard({ on, d }: { on: Beat; d: ReplayData }) {
  const paying = on(1) && !on(2);
  // Australian prices include GST: the GST in a price is one eleventh.
  const gst = Math.round((d.due / 11) * 100) / 100;
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <span className="truncate type-heading font-normal text-zebra-950 font-[family-name:var(--b-heading)]">{d.business}</span>
        <span className="shrink-0 type-label text-zebra-950">Tax invoice</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 type-body">
        <div>
          <dt className="text-zebra-500">Billed to</dt>
          <dd className="truncate text-zebra-950">{CLIENT.name}</dd>
        </div>
        <div>
          <dt className="text-zebra-500">Invoice</dt>
          <dd className="text-zebra-950">INV-0042</dd>
        </div>
        <div>
          <dt className="text-zebra-500">Issued</dt>
          <dd className="text-zebra-950">{DATES.issued}</dd>
        </div>
        <div>
          <dt className="text-zebra-500">Due</dt>
          <dd className="text-zebra-950">On receipt</dd>
        </div>
      </dl>
      <div className="mt-4 type-body">
        <div className="flex justify-between gap-4 border-y border-zebra-100 py-2.5 text-zebra-950">
          <span className="truncate">
            Deposit, {d.depositPercent}% of {d.pkg.name}
          </span>
          <span className="tabular-nums">{cents(d.due)}</span>
        </div>
        <div className="flex justify-between gap-4 pt-2.5 text-zebra-500">
          <span>Includes GST</span>
          <span className="tabular-nums">{cents(gst)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4 pt-1.5">
          <span className="type-label text-zebra-950">Total due (AUD)</span>
          <span className="type-title font-normal text-zebra-950 tabular-nums font-[family-name:var(--b-heading)]">{cents(d.due)}</span>
        </div>
        <p className="mt-1 text-zebra-500">
          Balance of {cents(d.balance)} due {DATES.balanceDue}.
        </p>
      </div>
      <div className="mt-auto">
        <Reveal on={on(0)}>
          <div
            className={`flex h-11 items-center justify-center gap-2 rounded-button bg-[var(--b-primary)] type-label text-[var(--b-on-primary)] transition-[scale] duration-200 motion-reduce:transition-none ${
              paying ? 'scale-98' : ''
            }`}
          >
            {on(2) ? (
              <>
                <Check aria-hidden="true" strokeWidth={1.5} className="size-4" />
                Paid by card
              </>
            ) : paying ? (
              <>
                <Loader2 aria-hidden="true" strokeWidth={1.5} className="size-4 animate-spin motion-reduce:animate-none" />
                {CLIENT.first} is paying
              </>
            ) : (
              `Pay ${cents(d.due)}`
            )}
          </div>
        </Reveal>
      </div>
    </>
  );
}

/** 9. The booking: the deposit landed, the date in the calendar, and what it took. */
export function PaidCard({ on, d }: { on: Beat; d: ReplayData }) {
  return (
    <>
      <div className="flex items-center">
        <span className="flex size-8.5 items-center justify-center rounded-pill border-[1.5px] border-current/85">
          <Check aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </span>
      </div>
      <p className="mt-auto type-eyebrow opacity-85">Booked</p>
      <Reveal on={on(0)} className="mt-2 duration-700">
        <p className="type-hero font-normal font-[family-name:var(--b-heading)]">{aud(d.due)} paid</p>
      </Reveal>
      <p className="mt-3 type-body opacity-90">
        {WEDDING.couple} · {WEDDING.date} · {WEDDING.venue}
      </p>
      <Reveal on={on(1)} className="mt-4">
        <span className="inline-flex items-center gap-2 rounded-pill bg-current/10 px-3 py-1.5 type-body">
          <CalendarCheck aria-hidden="true" strokeWidth={1.5} className="size-4" />
          Added to your calendar
        </span>
      </Reveal>
      <Reveal on={on(2)} className="mt-6 border-t border-current/20 pt-5 type-body">
        Enquiry to paid deposit in under three days.
      </Reveal>
    </>
  );
}
