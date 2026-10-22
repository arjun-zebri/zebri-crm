'use client';

import type { Account } from '../../account';
import { clientName, type Client } from '../../clients/clients-data';
import { sampleDeposit } from '../../documents/invoice-templates';
import { fullDate } from '../../payments/dates';
import { cents, coupleName, personOf, type Invoice } from '../../payments/payments-data';

import { band, field, logo, M, page, part, rule, text, tint, W } from './build';
import { businessFields, type DesignSpec } from './spec';
import { LineItems, PayBox, Totals } from './widgets/money';

/**
 * The invoice as a design. Its required parts (the words "Tax invoice",
 * the ABN, number and dates, who it is billed to, the lines, the totals
 * with GST, how to pay) are locked: an Australian tax invoice has to carry
 * them, and their figures come from the invoice. Everything else is the
 * MC's to place and style.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/invoice
 */

/** What an invoice is filled from. */
export interface InvoiceData {
  invoice: Invoice;
}

export const INVOICE: DesignSpec<InvoiceData> = {
  kind: 'invoice',
  label: 'Invoice',
  layout: () => ({
    id: 'invoice',
    kind: 'invoice',
    title: 'Invoice',
    pages: [
      page('invoice-1', [
        // The onboarding look: a brand strip, "Tax invoice" in the brand colour, how to pay on a soft brand wash.
        band('band'),
        logo('logo', { x: M, y: M, w: 280, h: 44 }),
        field('contact', 'ABN and contact', 'business.contact', 'body', { x: M, y: 120, w: 340 }, { color: 'kit:muted', locked: true }),
        text('title', 'Tax invoice', 'Tax invoice', 'caption', { x: 430, y: M + 10, w: 300, h: 24 }, { align: 'right', color: 'kit:primary', locked: true }),
        field('number', 'Invoice number', 'invoice.number', 'body', { x: 430, y: 104, w: 300 }, { align: 'right', color: 'kit:muted', locked: true }),
        text('billed-label', 'Label', 'Billed to', 'caption', { x: M, y: 232, w: 200 }, { color: 'kit:muted' }),
        field('billed', 'Billed to', 'billed.to', 'body', { x: M, y: 258, w: 200 }, { locked: true }),
        text('dates-label', 'Label', 'Invoice', 'caption', { x: 290, y: 232, w: 200 }, { color: 'kit:muted' }),
        field('dates', 'Dates', 'invoice.dates', 'body', { x: 290, y: 258, w: 200 }, { locked: true }),
        text('event-label', 'Label', 'Event', 'caption', { x: 516, y: 232, w: 214 }, { color: 'kit:muted' }),
        field('event', 'Event', 'event', 'body', { x: 516, y: 258, w: 214 }),
        part('lines', 'Line items', 'line-items', { x: M, y: 380, w: W, h: 120 }),
        part('totals', 'Totals', 'totals', { x: 410, y: 530, w: 320, h: 110 }),
        field('note', 'Note', 'invoice.note', 'body', { x: M, y: 690, w: W }, { color: 'kit:muted' }),
        tint('pay-wash', { x: M, y: 800, w: W, h: 140 }),
        part('pay', 'How to pay', 'pay', { x: M + 24, y: 820, w: W - 48, h: 100 }),
        rule('foot-rule', { x: M, y: 1020, w: W }),
        text('thanks', 'Thanks', 'Thank you for having me on your day.', 'body', { x: M, y: 1044, w: W }, { color: 'kit:muted' }),
      ]),
    ],
  }),
  sample: (account) => ({ invoice: sampleDeposit(account) }),
  fill: ({ invoice: i }, account: Account) => {
    const event: Client | undefined = account.clients.find((c) => clientName(c) === coupleName(i.names));
    const people = event?.email !== undefined ? i.names.filter(Boolean).map((n) => ({ name: n, email: event.email ?? '' })) : i.names.filter(Boolean).map(personOf);
    const share = Math.round((i.amount / i.total) * 100);
    const b = businessFields(account);
    return {
      fields: {
        ...b.fields,
        'invoice.number': `#${i.number}`,
        'billed.to': [...people.map((p) => p.name), people[0]?.email ?? ''].filter(Boolean).join('\n'),
        'invoice.dates': `Issued ${fullDate(i.sentOn ?? i.zebriSends ?? i.dueOn)}\nDue ${fullDate(i.dueOn)}`,
        event: [i.item, event?.date, event?.venue].filter(Boolean).join('\n'),
        'invoice.note': i.note ?? '',
      },
      fieldNames: { ...b.fieldNames, 'invoice.number': 'Invoice number', 'billed.to': 'Billed to', 'invoice.dates': 'Issue and due dates', event: 'Event', 'invoice.note': 'Note to the couple' },
      widgets: {
        'line-items': () => <LineItems items={[{ label: `${i.label}, ${i.item}`, detail: `${share}% of ${cents(i.total).replace('.00', '')}${i.label === 'Deposit' ? ' · secures your date' : ''}`, amount: i.amount }]} />,
        totals: () => <Totals amount={i.amount} paid={Boolean(i.paidOn)} />,
        pay: () => <PayBox link={`zebri.app/pay/${i.number}`} bank={account.contact ? `${account.business} · ${account.contact.bank}` : undefined} reference={`INV-${i.number}`} />,
      },
    };
  },
};
