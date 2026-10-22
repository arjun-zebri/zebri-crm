import { BdmIcon, ContractIcon, EmailIcon, PaymentsIcon, ProposalIcon, QuestionnaireIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';


/**
 * The kinds of document the Documents page holds, in the order its type
 * filter lists them, each with the block that adds it. A kind shows only once
 * its block is added (invoices with the Payments block), except Emails,
 * which every account has: journeys, reminders and replies all send
 * email, so it is not a block of its own (2026-10-20). A Custom kind (a free page the MC writes and
 * sends) joins this list later.
 *
 * @module app/design-system/v2/pages/dashboard/documents/kinds
 */

export type DocumentKind = 'proposals' | 'contracts' | 'invoices' | 'questionnaires' | 'emails' | 'paperwork';

export interface KindInfo {
  id: DocumentKind;
  label: string;
  /** One of them, on a row: "Proposal". */
  one: string;
  /** The block that adds it, in `blocks/catalog.ts`; null for one every account has. */
  block: string | null;
  icon: ZebriIcon;
}

export const KINDS: KindInfo[] = [
  { id: 'proposals', label: 'Proposals', one: 'Proposal', block: 'proposals', icon: ProposalIcon },
  { id: 'contracts', label: 'Contracts', one: 'Contract', block: 'contracts', icon: ContractIcon },
  // Invoices come with Payments: their templates and sent copies live here, the money stays on Payments.
  { id: 'invoices', label: 'Invoices', one: 'Invoice', block: 'payments', icon: PaymentsIcon },
  { id: 'questionnaires', label: 'Questionnaires', one: 'Questionnaire', block: 'questionnaires', icon: QuestionnaireIcon },
  { id: 'emails', label: 'Emails', one: 'Email', block: null, icon: EmailIcon },
  // A celebrant's: the Lodge with BDM block. No template, since the law sets the form.
  { id: 'paperwork', label: 'Marriage paperwork', one: 'Marriage paperwork', block: 'bdm', icon: BdmIcon },
];

/** A kind's entry. */
export const kindOf = (id: DocumentKind) => KINDS.find((k) => k.id === id)!;

/** The kinds an MC with these blocks sees. */
export const kindsFor = (added: ReadonlySet<string>) => KINDS.filter((k) => k.block === null || added.has(k.block));

/** Whether any document kind is added, so the sidebar shows Documents. */
export const hasDocuments = (added: ReadonlySet<string>) => kindsFor(added).length > 0;
