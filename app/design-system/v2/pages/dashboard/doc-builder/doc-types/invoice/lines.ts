import { doc, newSectionId, paragraph, text, variable, type RichDoc } from '@/features/proposals';

import { gstOf } from '../../../payments/payments-data';
import type { DocSection, LineItem, LineItemsData, LineItemsWord } from '../../model/types';

/**
 * An invoice's lines block, read: whether the GST is broken out under the
 * lines and whether each line shows its detail line (both shown unless
 * the MC has turned them off, the bar's Show menu), the lines themselves
 * (this payment's, then any the MC added), and the headings' and totals'
 * words, Zebri's until the MC types their own. The totals are worked out
 * from the lines (`lineTotals`), so a line added is a line charged.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/invoice/lines
 */

/** A lines block with every choice made. */
export interface Lines {
  gst: boolean;
  detail: boolean;
  words: Record<LineItemsWord, RichDoc>;
  items: LineItem[];
}

const say = (...content: RichDoc[]) => doc(paragraph(...content));

/** Zebri's wording for the headings and totals. */
export const LINE_WORDS: Record<LineItemsWord, RichDoc> = {
  description: say(text('Description')),
  amount: say(text('Amount')),
  subtotal: say(text('Subtotal (excl. GST)')),
  gst: say(text('GST (10%)')),
  total: say(text('Amount due')),
};

/** This payment's line: which payment for which package, and its share of the fee. */
const PAYMENT_LINE: LineItem = {
  id: 'payment',
  text: say(variable('payment_label'), text(', '), variable('package_name')),
  detail: say(variable('payment_share')),
  amount: null,
};

/** A line the MC adds: words to type over and an amount of its own. */
export const newLine = (): LineItem => ({ id: `line-${newSectionId()}`, text: say(text('Travel')), amount: 0 });

/** The raw data of a lines block, or none. */
export const lineItemsData = (section: DocSection): LineItemsData => (section.data?.kind === 'lineItems' ? (section.data.lineItems as LineItemsData) : {});

/** A lines block's choices, lines and words, read safely. */
export function lineItemsOf(section: DocSection): Lines {
  const raw = lineItemsData(section);
  return { gst: raw.gst ?? true, detail: raw.detail ?? true, words: { ...LINE_WORDS, ...raw.words }, items: raw.items ?? [PAYMENT_LINE] };
}

/** One line's amount: its own, or this payment's (`payment`, in dollars). */
export const lineAmount = (item: LineItem, payment: number) => item.amount ?? payment;

/** The lines' total, and the GST in it (one eleventh, amounts including GST), in dollars. */
export function lineTotals(items: LineItem[], payment: number) {
  const total = items.reduce((sum, i) => sum + lineAmount(i, payment), 0);
  const gst = gstOf(total);
  return { total, gst, subtotal: total - gst };
}
