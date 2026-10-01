import { ENQUIRIES } from '../demo-activity';
import { INVOICE_SEEDS, finish as finishInvoice } from '../payments/payments-data';
import { generatedProposals } from '../proposals/generated-proposals';
import { NAMED } from '../proposals/named-proposals';
import { finish as finishProposal } from '../proposals/proposals-data';

/**
 * The counts under Home's Up next panel, worked out from the same demo
 * data the pages they lead to show, so "2 unsigned proposals" is never
 * followed by a list of six.
 *
 * @module app/design-system/v2/pages/dashboard/home/counts
 */

/** Home's counts. */
export interface HomeCounts {
  /** Every enquiry in the Enquiries panel. */
  newEnquiries: number;
  /** What overdue invoices add up to, in dollars: the top of the Invoices tab. */
  outstanding: number;
  /** Proposals sent and not accepted, opened or not: the top of the Proposals tab. */
  unsignedProposals: number;
}

/** Counts Home's figures afresh (the invoices' groups depend on today). */
export function homeCounts(): HomeCounts {
  const overdue = INVOICE_SEEDS.map(finishInvoice).filter((i) => i.group === 'overdue');
  const proposals = [...NAMED, ...generatedProposals()].map(finishProposal);
  return {
    newEnquiries: ENQUIRIES.length,
    outstanding: overdue.reduce((sum, i) => sum + i.amount, 0),
    unsignedProposals: proposals.filter((p) => p.group === 'opened' || p.group === 'unopened').length,
  };
}
