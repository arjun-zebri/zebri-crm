import type { JSONContent } from '@tiptap/core';

import type { StepEmail } from '../../journeys/step-settings';
import { addDays, TODAY } from '../../payments/dates';
import { CLAUSES } from '../../payments/modal/contract-clauses';
import { finish, type Contract, type Invoice } from '../../payments/payments-data';

/**
 * What a proposal sets going, drawn for the couple it is going to, so
 * Ready to send can show each one before it goes: the email that carries
 * the link, the contract they sign, and the deposit and balance
 * invoices. Built from what the MC has set on the screen (the package
 * and price, the deposit, when the balance is due), never from the
 * sample couple, so what they review is what Clara and Felix get.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/ready/ready-docs
 */

/** The couple, the package they are offered, and the event, as the documents name them. */
export interface ReadyFor {
  names: [string, string];
  /** "Clara and Felix", for greetings. */
  greet: string;
  item: string;
  total: number;
  /** "Fri 26 Mar 2027". */
  event: string;
}

/**
 * The contract they are asked to sign, in the MC's wording or the
 * standard one, with the balance falling due when this proposal says:
 * the standard wording's "14 days before" follows the setting, so the
 * contract never contradicts the proposal it comes from.
 */
export const contractFor = (r: ReadyFor, balanceDays: number, clauses?: Contract['clauses'] | null): Contract => ({
  id: 'ready-contract',
  names: r.names,
  title: 'MC services agreement',
  item: r.item,
  total: r.total,
  event: r.event,
  when: 'Not sent',
  group: 'draft',
  signers: [],
  history: [],
  clauses: (clauses ?? CLAUSES).map(([title, words]) => [title, words.replace('balance is due 14 days before', `balance is due ${balanceDays} days before`)]),
  balanceDays,
});

/** One of the invoices saying yes sends: the deposit, or the balance with the deposit already paid. */
export function invoiceFor(r: ReadyFor, label: 'Deposit' | 'Final payment', amount: number, paidBefore: number, dueIn: number): Invoice {
  return finish({
    id: `ready-${label}`,
    number: 1001,
    names: r.names,
    item: r.item,
    total: r.total,
    label,
    amount,
    paidBefore,
    dueOn: addDays(TODAY, dueIn),
    sentOn: TODAY,
    paidOn: null,
    method: null,
    history: [],
    note: label === 'Deposit' ? 'Thank you for booking. This secures your date.' : 'Thank you. See you on the day.',
  });
}

/** Zebri's email to go with a proposal, written to them by name; the MC's signature closes it. */
export const proposalEmail = (r: ReadyFor, business: string): StepEmail => ({
  subject: `Your proposal from ${business}`,
  body: `Hi ${r.greet},\n\nLovely to talk about your day. Here is your proposal: everything we discussed, and the packages to choose from. When you are ready, you can say yes right on the page.`,
});

/** An email's words as plain text, a blank line between paragraphs, for the note the proposal is sent with. */
export function textOf(email: StepEmail): string {
  if (!email.doc) return email.body;
  const line = (n: JSONContent): string => (n.type === 'text' ? (n.text ?? '') : n.type === 'variable' ? String(n.attrs?.['id'] ?? '') : (n.content ?? []).map(line).join(''));
  return (email.doc.content ?? [])
    .map(line)
    .filter((t) => t.trim())
    .join('\n\n');
}
