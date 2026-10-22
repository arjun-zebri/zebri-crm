import { column, columns, doc, heading, paragraph, text, variable } from '@/features/proposals';

import type { Account } from '../../../account';
import type { DocLayout } from '../../model/types';
import { headerSection } from '../../sections/header/data';
import { partSection } from '../../sections/parts/parts';
import { words } from '../proposal/starter-sections';
import { br, fact, muted } from '../words';

/**
 * Zebri's starting invoice, the one a new MC or Celebrant opens on Set
 * up and edits in place, as the contract is (founder, 2026-10-21: "make
 * the invoice the same thing, very customisable and flexible"). Every
 * word is the MC's own text with `@` fields for the invoice
 * (`./fields.ts`): the business details beside the logo, "Tax invoice",
 * who it is billed to, the dates, the event, how to pay and the note.
 * Only the lines and their totals stay a working part, since their
 * figures and GST are worked out; what it shows is the MC's choice (the
 * bar's Show menu). An Australian tax invoice must carry "Tax invoice",
 * the ABN, the date and the GST, so the starter has all four; removing
 * one is the MC's call, as in any editor.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/invoice/starter
 */

/** The letterhead's words beside the logo: the ABN and how to reach the business. */
const letterhead = () => doc(paragraph(muted('ABN '), variable('abn'), br(), variable('business_email'), text(' · '), variable('business_phone')));

/**
 * The invoice's details in three columns, then which payment it is. The
 * line under the columns closes the section on words: one ending in
 * columns gets the editor's empty line after it, a gap the MC could not remove.
 */
const details = () =>
  doc(
    heading(2, text('Tax invoice')),
    paragraph(muted('Invoice #'), variable('invoice_number')),
    columns(
      column(1, fact('Billed to', variable('couple_name'), br(), variable('client_email'))),
      column(1, fact('Invoice', text('Issued '), variable('issue_date'), br(), text('Due '), variable('due_date'))),
      column(1, fact('Event', variable('package_name'), br(), variable('event_date'), br(), variable('venue'))),
    ),
    paragraph(variable('payment_label'), text(' for '), variable('package_name')),
  );

/** How to pay, side by side (bank transfer once the business has bank details), then the MC's note to the couple. */
const howToPay = (bank: boolean) => {
  const online = fact('Pay online', text('Card or Apple Pay at '), variable('pay_link'));
  return doc(
    heading(3, text('How to pay')),
    bank ? columns(column(1, online), column(1, fact('Bank transfer', variable('bank_details'), br(), text('Reference '), variable('payment_reference')))) : online,
    paragraph(variable('invoice_note')),
  );
};

/**
 * The invoice's starting page for `account`. The letterhead and bank
 * transfer go in only once the business has an ABN and bank details:
 * without them they would print as a bare "ABN" and an empty line. Added
 * later, they are `@` fields away.
 */
export function invoiceStarter(account: Account): DocLayout {
  const header = headerSection();
  const known = Boolean(account.contact);
  return {
    version: 2,
    sections: [
      known ? { ...header, data: { kind: 'header', header: { height: 48, layout: 'beside', text: letterhead() } } } : header,
      words('Details', details(), { padding: 'compact' }),
      partSection('lineItems', 'Line items', { padding: 'compact' }),
      words('How to pay', howToPay(known), { padding: 'compact' }),
      words('Footer', doc(paragraph(muted('Thank you for having me on your day.'))), { align: 'center', padding: 'compact' }),
    ],
  };
}
