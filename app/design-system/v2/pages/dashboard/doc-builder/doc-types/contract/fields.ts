import { PROPOSAL_VARIABLES } from '@/features/proposals';
import type { DocumentVariable } from '@/lib/branding/document-variables';

import type { Account } from '../../../account';
import { money, type Contract } from '../../../payments/payments-data';

/**
 * The fields a contract's words can hold (`@` in the editor): the
 * couple's and the business's, as a proposal has, and the booking's own
 * (the package, the fee, the deposit and the balance), so the booking
 * details are words the MC lays out and retypes like any other, not a
 * block they cannot touch (founder, 2026-10-21: "the goal is to make the
 * document fully customisable"). The values are worked out from the
 * contract the page is drawn for (`contractValues`).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/contract/fields
 */

/** The proposal's fields a contract keeps: whose it is and whose business, not the proposal's own number or expiry. */
const COUPLE = PROPOSAL_VARIABLES.filter((v) => v.group === 'Couple');
const BUSINESS = PROPOSAL_VARIABLES.filter((v) => v.group === 'Business');

/** The booking's fields, only a contract has. */
const BOOKING: DocumentVariable[] = [
  { id: 'package_name', label: 'Package', group: 'Booking', format: 'text', source: 'The package the couple accepted.' },
  { id: 'fee', label: 'Fee', group: 'Booking', format: 'text', source: 'The package price, including GST.' },
  { id: 'deposit_amount', label: 'Deposit', group: 'Booking', format: 'text', source: 'What is paid on signing, from your deposit percentage.' },
  { id: 'balance_amount', label: 'Balance', group: 'Booking', format: 'text', source: 'The rest of the fee, after the deposit.' },
  { id: 'balance_due', label: 'Balance due', group: 'Booking', format: 'text', source: 'When the balance falls due, e.g. "14 days before".' },
];

/** What `@` offers in a contract. */
export const CONTRACT_FIELDS: readonly DocumentVariable[] = [...COUPLE, ...BOOKING, ...BUSINESS];

/** The booking's field values for `contract`, from `account`'s deposit. */
export function contractValues(contract: Contract, account: Account): Record<string, string> {
  const held = Math.min(contract.total, Math.round((contract.total * account.deposit) / 100));
  return {
    // The account's own contact details, over the brand settings', which may not have them.
    ...(account.contact ? { abn: account.contact.abn, business_email: account.contact.email, business_phone: account.contact.phone } : {}),
    package_name: contract.item,
    fee: `${money(contract.total)} incl. GST`,
    deposit_amount: money(held),
    balance_amount: money(contract.total - held),
    balance_due: `${contract.balanceDays ?? 14} days before`,
  };
}

/** The wedding date and venue from a contract's "Saturday 12 March 2027 · Stones" line. */
export function eventOf(contract: Contract): { date: string; venue: string } {
  const [date = '', venue = ''] = contract.event.split(' · ');
  return { date, venue };
}
