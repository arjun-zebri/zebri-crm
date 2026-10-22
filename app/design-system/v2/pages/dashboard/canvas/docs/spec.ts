import type { Account } from '../../account';
import type { CanvasData } from '../canvas-context';
import type { CanvasDoc } from '../model';

/**
 * What every designable document is to the canvas: its starting layout
 * (Zebri's default, which the MC then makes their own), sample data to
 * design against before there is a real one, and how real data fills its
 * fields (the couple's names, the invoice number) and draws its working
 * parts (line items, clauses, packages). Required parts are locked in the
 * layout: styled and moved, never deleted, their figures never typed.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/spec
 */

/** The documents that open in the canvas. */
export type DesignKind = 'proposal' | 'invoice' | 'contract' | 'questionnaire' | 'run-sheet' | 'script' | 'email';

/** What real data gives the canvas. */
export type Fills = Required<Pick<CanvasData, 'fields' | 'widgets'>> & { fieldNames: Record<string, string> };

/** One designable document. `D` is the data it is filled from. */
export interface DesignSpec<D> {
  kind: DesignKind;
  /** "Invoice", as the design's title reads. */
  label: string;
  layout: () => CanvasDoc;
  sample: (account: Account) => D;
  fill: (data: D, account: Account) => Fills;
}

/** The business fields every document can carry, from the account. */
export function businessFields(account: Account): Pick<Fills, 'fields' | 'fieldNames'> {
  const c = account.contact;
  return {
    fields: {
      business: account.business,
      'business.contact': c ? `ABN ${c.abn}\n${c.email} · ${c.phone}` : '',
      'business.footer': c ? `${account.business} · ABN ${c.abn}` : account.business,
      mc: account.mc?.name ?? account.business,
    },
    fieldNames: { business: 'Business name', 'business.contact': 'ABN and contact', 'business.footer': 'Business footer', mc: 'Your name' },
  };
}
