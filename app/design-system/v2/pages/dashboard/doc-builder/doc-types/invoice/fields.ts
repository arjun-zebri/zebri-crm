import { PROPOSAL_VARIABLES } from '@/features/proposals';
import type { DocumentVariable } from '@/lib/branding/document-variables';

import type { Account } from '../../../account';
import { clientName } from '../../../clients/clients-data';
import { fullDate } from '../../../payments/dates';
import { cents, coupleName, personOf, type Invoice } from '../../../payments/payments-data';

/**
 * The fields an invoice's words can hold (`@` in the editor): the
 * couple's and the business's, as a proposal has, and the invoice's own
 * (its number, dates, who it is billed to, the payment, how to pay), so
 * everything but the lines and their totals is words the MC lays out and
 * retypes (founder, 2026-10-21: "make it very customisable and
 * flexible"). The values are worked out from the invoice the page is
 * drawn for (`invoiceValues`), as are the figures the lines block draws
 * (`./line-items-view.tsx`), so the editor and the sent copy read the
 * same numbers. `payment_amount` and `paid_on` are not offered on `@`:
 * they give the lines block this payment's figure and tell it to read "Paid".
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/invoice/fields
 */

const COUPLE = PROPOSAL_VARIABLES.filter((v) => v.group === 'Couple');
const BUSINESS = PROPOSAL_VARIABLES.filter((v) => v.group === 'Business');

/** The invoice's own fields. */
const INVOICE: DocumentVariable[] = [
  { id: 'invoice_number', label: 'Invoice number', group: 'Invoice', format: 'text', source: 'The invoice number, e.g. 1001.' },
  { id: 'issue_date', label: 'Issue date', group: 'Invoice', format: 'text', source: 'The day the invoice is sent.' },
  { id: 'due_date', label: 'Due date', group: 'Invoice', format: 'text', source: 'The day it falls due.' },
  { id: 'client_email', label: 'Client email', group: 'Invoice', format: 'text', source: 'Where the invoice is sent.' },
  { id: 'package_name', label: 'Package', group: 'Invoice', format: 'text', source: 'The package the couple booked.' },
  { id: 'payment_label', label: 'Payment', group: 'Invoice', format: 'text', source: 'Which payment this is, e.g. "Deposit".' },
  { id: 'amount_due', label: 'This payment', group: 'Invoice', format: 'text', source: 'This payment of the fee, including GST, before any lines you add.' },
  { id: 'payment_share', label: 'Share of the fee', group: 'Invoice', format: 'text', source: 'What part of the fee this payment is, e.g. "25% of $4,350".' },
  { id: 'invoice_note', label: 'Note', group: 'Invoice', format: 'text', source: 'The note you write when you send it.' },
  { id: 'pay_link', label: 'Pay online link', group: 'Invoice', format: 'text', source: 'Where the couple pays by card or Apple Pay.' },
  { id: 'bank_details', label: 'Bank details', group: 'Invoice', format: 'text', source: 'Your business name and bank account, from Settings.' },
  { id: 'payment_reference', label: 'Payment reference', group: 'Invoice', format: 'text', source: 'What the couple puts on a bank transfer, e.g. INV-1001.' },
];

/** What `@` offers in an invoice. */
export const INVOICE_FIELDS: readonly DocumentVariable[] = [...COUPLE, ...INVOICE, ...BUSINESS];

/** The invoice's field values for `invoice`, from `account`'s business. */
export function invoiceValues(invoice: Invoice, account: Account): Record<string, string> {
  const i = invoice;
  const client = account.clients.find((c) => clientName(c) === coupleName(i.names));
  const email = client?.email ?? (i.names[0] ? personOf(i.names[0]).email : '');
  return {
    // The account's own contact details, over the brand settings', which may not have them.
    ...(account.contact ? { abn: account.contact.abn, business_email: account.contact.email, business_phone: account.contact.phone } : {}),
    invoice_number: String(i.number),
    issue_date: fullDate(i.sentOn ?? i.zebriSends ?? i.dueOn),
    due_date: fullDate(i.dueOn),
    client_email: email,
    package_name: i.item,
    payment_label: i.label,
    amount_due: cents(i.amount),
    payment_share: `${Math.round((i.amount / i.total) * 100)}% of ${cents(i.total).replace('.00', '')}`,
    // Not on `@`: the lines block works its totals out from this and the lines the MC added.
    payment_amount: String(i.amount),
    paid_on: i.paidOn ? fullDate(i.paidOn) : '',
    invoice_note: i.note ?? '',
    pay_link: `zebri.app/pay/${i.number}`,
    bank_details: account.contact ? `${account.business} · ${account.contact.bank}` : '',
    payment_reference: `INV-${i.number}`,
  };
}
