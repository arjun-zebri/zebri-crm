import { formatDate } from '@/components/ui-v2/date-field';
import { DocumentPage } from '@/components/ui-v2/document-page';

import { useAccount } from '../../account';
import { clientName } from '../../clients/clients-data';
import { cents, coupleName, gstOf, personOf, type Invoice } from '../payments-data';

import { BrandScope, Letterhead } from './letterhead';

/**
 * An invoice as the couple gets it, on a real A4 page (`DocumentPage`):
 * the MC's letterhead, who it is billed to, the invoice's number and
 * dates, the wedding it is for, the one line it charges, the totals with
 * GST broken out (an Australian tax invoice has to show it), then how to
 * pay (the pay link or a bank transfer with the invoice as reference)
 * and a thank-you footer. Laid out for the full 794px page, so it reads
 * as the printed document. A paid invoice says so where the amount due
 * would be.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/invoice-preview
 */

const LABEL = 'type-body text-zebra-500';

/** The couple's copy of an invoice. */
export function InvoicePreview({ invoice: i }: { invoice: Invoice }) {
  const issued = i.sentOn ?? i.zebriSends ?? i.dueOn;
  const share = Math.round((i.amount / i.total) * 100);
  const gst = gstOf(i.amount);
  const { clients, business, contact } = useAccount();
  const event = clients.find((c) => clientName(c) === coupleName(i.names));
  // A client with a real email (a new account's) is billed by the names they gave; the demo's are made up from theirs.
  const people =
    event?.email !== undefined
      ? i.names.filter(Boolean).map((n) => ({ name: n, email: event.email ?? '' }))
      : i.names.filter(Boolean).map(personOf);
  return (
    <BrandScope>
      <DocumentPage aria-label={`Invoice #${i.number}`}>
        <div className="flex h-full flex-col px-16 py-16">
          <header className="flex items-start justify-between gap-8">
            <div className="space-y-1">
              <Letterhead />
              {contact ? (
                <>
                  <p className={LABEL}>ABN {contact.abn}</p>
                  <p className={LABEL}>
                    {contact.email} · {contact.phone}
                  </p>
                </>
              ) : null}
            </div>
            <div className="text-right">
              <p className="type-title text-zebra-950">Tax invoice</p>
              <p className={LABEL}>#{i.number}</p>
            </div>
          </header>

          <div className="mt-14 grid grid-cols-3 gap-8 type-body">
            <div className="space-y-1">
              <p className={LABEL}>Billed to</p>
              {people.map((p) => (
                <p key={p.name} className="text-zebra-950">
                  {p.name}
                </p>
              ))}
              {people[0]?.email ? <p className="text-zebra-500">{people[0].email}</p> : null}
            </div>
            <div className="space-y-1">
              <p className={LABEL}>Invoice</p>
              <p className="text-zebra-950">Issued {formatDate(issued)}</p>
              <p className="text-zebra-950">Due {formatDate(i.dueOn)}</p>
            </div>
            <div className="space-y-1">
              <p className={LABEL}>Event</p>
              <p className="text-zebra-950">{i.item}</p>
              {event ? (
                <>
                  <p className="text-zebra-950">{event.date}</p>
                  <p className="text-zebra-500">{event.venue}</p>
                </>
              ) : null}
            </div>
          </div>

          <table className="mt-14 w-full border-collapse type-body tabular-nums">
            <thead>
              <tr className="border-b border-zebra-950 text-left">
                <th scope="col" className="pb-2 font-medium">Description</th>
                <th scope="col" className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zebra-950/10">
                <td className="py-4 text-zebra-950">
                  {i.label}, {i.item}
                  <span className="block text-zebra-500">
                    {share}% of {cents(i.total).replace('.00', '')}
                    {i.label === 'Deposit' ? ' · secures your date' : ''}
                  </span>
                </td>
                <td className="py-4 text-right align-top text-zebra-950">{cents(i.amount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Rows, not a two-column grid, so the rule above the total runs unbroken. */}
          <dl className="ml-auto mt-6 w-72 space-y-2 type-body tabular-nums">
            <div className="flex justify-between gap-8">
              <dt className="text-zebra-500">Subtotal (excl. GST)</dt>
              <dd className="text-zebra-950">{cents(i.amount - gst)}</dd>
            </div>
            <div className="flex justify-between gap-8">
              <dt className="text-zebra-500">GST (10%)</dt>
              <dd className="text-zebra-950">{cents(gst)}</dd>
            </div>
            <div className="flex justify-between gap-8 border-t border-zebra-950 pt-3 type-subheading text-zebra-950">
              <dt>{i.paidOn ? 'Paid' : 'Amount due'}</dt>
              <dd>{cents(i.amount)}</dd>
            </div>
          </dl>

          {i.note ? <p className="mt-14 whitespace-pre-line type-body text-zebra-700">{i.note}</p> : null}

          <section aria-label="How to pay" className="mt-14 grid grid-cols-2 gap-8 rounded-check bg-zebra-50 p-6 type-body">
            <div className="space-y-1">
              <p className="type-label text-zebra-950">Pay online</p>
              <p className="text-zebra-700">Card or Apple Pay at</p>
              <p className="text-zebra-950 underline">zebri.app/pay/{i.number}</p>
            </div>
            {contact ? (
              <div className="space-y-1">
                <p className="type-label text-zebra-950">Bank transfer</p>
                <p className="text-zebra-700">
                  {business} · {contact.bank}
                </p>
                <p className="text-zebra-700">Reference INV-{i.number}</p>
              </div>
            ) : null}
          </section>

          <footer className="mt-auto flex justify-between border-t border-zebra-950/10 pt-4 type-body text-zebra-500">
            <p>Thank you.{contact ? ` Questions? ${contact.email}` : ''}</p>
            <p>Page 1 of 1</p>
          </footer>
        </div>
      </DocumentPage>
    </BrandScope>
  );
}
