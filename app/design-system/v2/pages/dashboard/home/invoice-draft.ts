import { formatDate } from '@/components/ui-v2/date-field';

import { CLIENTS, STAGES, clientName } from '../clients/clients-data';
import { DEPOSIT, PACKAGES } from '../proposals/templates-data';

/**
 * What Send an invoice starts from: who can be invoiced, what for and
 * how much, when it falls due, and the email Zebri writes to carry it.
 *
 * @module app/design-system/v2/pages/dashboard/home/invoice-draft
 */

/** Clients far enough along to be invoiced. */
export const PAYERS = CLIENTS.filter(
  (c) => STAGES.indexOf(c.stage) >= STAGES.indexOf('Proposal'),
).map(clientName);
/** What an invoice can be for. */
export const KINDS = ['Deposit', 'Instalment', 'Final payment'] as const;
export type Kind = (typeof KINDS)[number];

// Every demo client is on the Classic package: the deposit holds the
// date and the rest splits into two equal payments.
/** The Classic package's price. */
export const PRICE = PACKAGES.classic.price;
const DEPOSIT_AMOUNT = Math.round((PRICE * DEPOSIT) / 100);
/** What each kind of invoice asks for. */
export const AMOUNT: Record<Kind, number> = {
  Deposit: DEPOSIT_AMOUNT,
  Instalment: (PRICE - DEPOSIT_AMOUNT) / 2,
  'Final payment': (PRICE - DEPOSIT_AMOUNT) / 2,
};

/** "YYYY-MM-DD", `days` from today. */
export function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "$1,350". */
export const dollars = (n: number) => `$${n.toLocaleString('en-AU')}`;

/** The email that carries the invoice. */
export function draft(who: string, kind: Kind, amount: number, due: string) {
  const [a = who, b = ''] = who.split(' & ');
  return {
    subject: `Your ${kind.toLowerCase()} invoice`,
    body: `Hi ${a}${b ? ` and ${b}` : ''},\n\nHere's the invoice for your ${kind.toLowerCase()}: ${dollars(amount)}, due ${formatDate(due)}. You can pay by card in a minute here: zebri.app/pay/0151\n\nThank you!\nArjun`,
  };
}
