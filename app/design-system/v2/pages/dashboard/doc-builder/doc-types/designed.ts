import type { Account } from '../../account';
import type { QuestionnaireData } from '../../canvas/docs/questionnaire';
import { SPECS as CANVAS_SPECS } from '../../canvas/docs/registry';
import { coupleName, type Invoice } from '../../payments/payments-data';
import type { DocLayout, DocType } from '../model/types';
import { headerSection } from '../sections/header/data';
import { partSection, type DocFields, type DocParts } from '../sections/parts/parts';
import type { DocFor } from '../state/options';

import { CONTRACT_FIELDS, contractValues, eventOf } from './contract/fields';
import { contractParts, type ContractPartsData } from './contract/parts';
import { contractStarter } from './contract/starter';
import { INVOICE_FIELDS, invoiceValues } from './invoice/fields';
import { invoiceParts } from './invoice/parts';
import { invoiceStarter } from './invoice/starter';
import { questionnaireParts } from './questionnaire/parts';

/**
 * The documents whose design is built on the engine rather than the old
 * canvas (founder, 2026-10-20: style them like the proposal editor):
 * the questionnaire, the contract and the invoice. One design per kind,
 * shared by every document of it, as the canvas design was. Each starts
 * as the MC's logo over the parts Zebri fills in (`sections/parts/`),
 * with a quiet line at the foot; the MC adds words, photos and the rest
 * around them as in a proposal. A contract's wording is the MC's own
 * text on the page (`contract/starter.ts`).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/designed
 */

/** The kinds designed on the engine. */
export type EngineDesignKind = Extract<DocType, 'questionnaire' | 'contract' | 'invoice'>;

/** Whether `kind` (a canvas design kind) is designed on the engine. */
export const isEngineDesign = (kind: string): kind is EngineDesignKind => kind === 'questionnaire' || kind === 'contract' || kind === 'invoice';

/** What each kind's design is opened with: the data the Design button hands over. */
export interface EngineDesignData {
  questionnaire: QuestionnaireData;
  contract: ContractPartsData;
  invoice: { invoice: Invoice };
}

/**
 * One kind of designed document. Methods, not function properties, so
 * one kind's entry reads as any kind's (`engineDesignOf`): its data comes from
 * the Design button that opened it, which hands over that kind's own.
 */
export interface EngineDesign<K extends EngineDesignKind> {
  /** "Questionnaire", as the editor's title reads. */
  label: string;
  /** Zebri's own page for it, for the MC's business. */
  starter(account: Account): DocLayout;
  /** Something to design against before there is a real one. */
  sample(account: Account): EngineDesignData[K];
  /** Its working parts, drawn from its data. */
  parts(data: EngineDesignData[K], account: Account): DocParts;
  /** Whose details the page's `@` fields show. */
  who(data: EngineDesignData[K], account: Account): DocFor;
  /** Its own `@` fields beyond a proposal's, with their values; null when it has none. */
  fields(data: EngineDesignData[K], account: Account): DocFields | null;
}

/** The couple a design without a real document shows: the account's first client, else the sample couple. */
const sampleWho = (account: Account): DocFor => {
  const c = account.clients[0];
  return { couple: c ? c.names.filter(Boolean).join(' & ') : 'Sarah & Tom', date: c?.date ?? 'Saturday 12 March 2027', venue: c?.venue ?? '' };
};

export const ENGINE_DESIGNS: { [K in EngineDesignKind]: EngineDesign<K> } = {
  questionnaire: {
    label: 'Questionnaire',
    starter: () => ({ version: 2, sections: [headerSection(), partSection('questions', 'Questions')] }),
    sample: (account) => CANVAS_SPECS.questionnaire.sample(account) as QuestionnaireData,
    parts: ({ template }) => questionnaireParts(template),
    who: (_data, account) => sampleWho(account),
    fields: () => null,
  },
  contract: {
    label: 'Contract',
    starter: contractStarter,
    sample: (account) => CANVAS_SPECS.contract.sample(account) as ContractPartsData,
    parts: contractParts,
    who: ({ contract }) => ({ couple: coupleName(contract.names), ...eventOf(contract) }),
    fields: ({ contract }, account) => ({ list: CONTRACT_FIELDS, values: contractValues(contract, account) }),
  },
  invoice: {
    label: 'Invoice',
    starter: invoiceStarter,
    sample: (account) => CANVAS_SPECS.invoice.sample(account) as { invoice: Invoice },
    parts: ({ invoice }, account) => invoiceParts(invoice, account),
    who: ({ invoice }, account) => {
      const client = account.clients.find((c) => c.names.filter(Boolean).join(' & ') === coupleName(invoice.names));
      return { couple: coupleName(invoice.names), date: client?.date ?? '', venue: client?.venue ?? '' };
    },
    fields: ({ invoice }, account) => ({ list: INVOICE_FIELDS, values: invoiceValues(invoice, account) }),
  },
};

/** The design for `kind`, read with whatever data its Design button handed over. */
export const engineDesignOf = (kind: EngineDesignKind): EngineDesign<EngineDesignKind> => ENGINE_DESIGNS[kind];
