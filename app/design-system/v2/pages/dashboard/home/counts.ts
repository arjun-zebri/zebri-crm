import { ENQUIRIES } from '../demo-activity';
import { INVOICE_SEEDS, finish as finishInvoice, type Contract } from '../payments/payments-data';
import { finish as finishProposal, type ProposalSeed } from '../proposals/proposals-data';
import type { Sent } from '../questionnaires/questionnaire-data';

/**
 * The counts under Home's Up next panel, worked out from the same demo
 * data the pages they lead to show, so "2 unsigned proposals" is never
 * followed by a list of six. Documents no longer lists sends, so every
 * kind a client can leave hanging is counted here: nothing to chase may
 * be out of sight.
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
  /** Contracts sent and not signed by everyone. */
  unsignedContracts: number;
  /** Questionnaires sent and not finished. */
  openQuestionnaires: number;
}

/** Counts Home's figures afresh (the invoices' groups depend on today), from the account's documents. */
export function homeCounts(seeds: ProposalSeed[], contracts: Contract[], questionnaires: Sent[]): HomeCounts {
  const overdue = INVOICE_SEEDS.map(finishInvoice).filter((i) => i.group === 'overdue');
  const proposals = seeds.map(finishProposal);
  return {
    newEnquiries: ENQUIRIES.length,
    outstanding: overdue.reduce((sum, i) => sum + i.amount, 0),
    unsignedProposals: proposals.filter((p) => p.group === 'opened' || p.group === 'unopened').length,
    unsignedContracts: contracts.filter((c) => c.group === 'waiting').length,
    openQuestionnaires: questionnaires.filter((s) => s.status !== 'completed').length,
  };
}
