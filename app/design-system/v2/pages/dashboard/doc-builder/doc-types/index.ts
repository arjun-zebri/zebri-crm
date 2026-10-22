import type { DocType } from '../model/types';

import type { DocTypeConfig } from './spec';

/**
 * Every kind of document the engine builds, and what makes each one
 * itself. Grows a type at a time as each moves onto the engine.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/index
 */

const WEB = { width: 960, maxColumns: 3, printable: false } as const;
/** A contract or invoice: a web page first, and a PDF for the couple's records. */
const PAPER = { ...WEB, printable: true } as const;

export const DOC_TYPES: Partial<Record<DocType, DocTypeConfig>> = {
  proposal: { type: 'proposal', label: 'Proposal', output: WEB, ripple: 'proposal' },
  questionnaire: { type: 'questionnaire', label: 'Questionnaire', output: WEB, ripple: 'questionnaire' },
  contract: { type: 'contract', label: 'Contract', output: PAPER, ripple: 'contract' },
  invoice: { type: 'invoice', label: 'Invoice', output: PAPER, ripple: 'invoice' },
};

/** The config for `type`; a proposal's until a type has its own. */
export const docTypeOf = (type: DocType): DocTypeConfig => DOC_TYPES[type] ?? DOC_TYPES.proposal!;
