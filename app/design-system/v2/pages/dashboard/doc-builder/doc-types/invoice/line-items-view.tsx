'use client';

import type { ReactNode } from 'react';

import { plainText, type ProposalTheme, type RichDoc, type RichDocContext } from '@/features/proposals';

import { cents } from '../../../payments/payments-data';
import { resolveDoc } from '../../model/resolve-variables';
import type { LineItem, LineItemsWord } from '../../model/types';
import { eyebrowCss, roleCss, RULE } from '../../sections/parts/parts';

import { lineAmount, lineTotals, type Lines } from './lines';

/**
 * An invoice's lines and totals: the column headings, a row per line
 * (what it is, a quieter detail line, its amount), then the subtotal and
 * GST when shown, and the total, all worked out from the lines, so a line
 * the MC adds is a line charged. Every word is the MC's (`./lines.ts`),
 * drawn with its fields filled in; while editing each is typed in place,
 * amounts too, with a way to add and remove lines (`edit`). This
 * payment's own figure comes from the invoice's field values
 * (`./fields.ts`), and a paid invoice reads "Paid" in place of the MC's
 * total label. Shared by the sent page (`./parts.tsx`) and the editor
 * (`editor/line-items-edit.tsx`).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/invoice/line-items-view
 */

/** The editor's forms of each piece, typed in place, and its add and remove controls. */
export interface LineItemsEditing {
  word: (key: LineItemsWord) => ReactNode;
  text: (item: LineItem) => ReactNode;
  detail: (item: LineItem) => ReactNode;
  /** A line's amount: this payment's, worked out (`figure`), or one the MC types. */
  amount: (item: LineItem, figure: string) => ReactNode;
  /** Removes a line the MC added; this payment's line stays. */
  remove: (item: LineItem) => ReactNode;
  /** Under the lines: adds one. */
  add: ReactNode;
}

export interface LineItemsViewProps {
  lines: Lines;
  theme: ProposalTheme;
  /** What the words draw with; its `values` hold this payment's figure. */
  ctx: RichDocContext;
  /** The editor's forms; the drawn words when left out. */
  edit?: LineItemsEditing | undefined;
}

/** The lines block. See {@link LineItemsViewProps}. */
export function LineItemsView({ lines, theme, ctx, edit }: LineItemsViewProps) {
  const v = ctx.values;
  const payment = Number(v.payment_amount ?? 0) || 0;
  const totals = lineTotals(lines.items, payment);
  // Drawn as plain words in the block's own type: the rich renderer's paragraph type would override the headings' small capitals and the total's weight.
  const words = (doc: RichDoc) => plainText(resolveDoc(doc, v));
  const say = (key: LineItemsWord) => (edit ? edit.word(key) : words(lines.words[key]));
  // The page's type, for words and figures alike; while editing, each field's paragraph drops its own gap (`[&_p]:m-0`).
  const body = roleCss(theme, 'paragraph');
  const figure = (amount: number, strong = false) => (
    <p style={{ ...body, ...(strong ? { fontWeight: 600 } : {}) }} className="shrink-0">
      {cents(amount)}
    </p>
  );
  return (
    <div className="space-y-6 tabular-nums [&_p]:m-0">
      <div>
        <div className={`flex justify-between gap-6 border-b pb-2 opacity-70 ${RULE}`}>
          <div style={eyebrowCss(theme)}>{say('description')}</div>
          <div style={eyebrowCss(theme)} className="text-right">
            {say('amount')}
          </div>
        </div>
        {lines.items.map((item) => {
          const amount = lineAmount(item, payment);
          return (
            <div key={item.id} className={`group/line relative flex justify-between gap-6 border-b py-4 ${RULE}`}>
              <div className="min-w-0 flex-1">
                <div style={body}>{edit ? edit.text(item) : words(item.text)}</div>
                {lines.detail && (edit || item.detail) ? (
                  <div style={body} className="opacity-70">
                    {edit ? edit.detail(item) : item.detail ? words(item.detail) : null}
                  </div>
                ) : null}
              </div>
              {edit ? (
                <div style={body} className="shrink-0 text-right">
                  {edit.amount(item, cents(amount))}
                </div>
              ) : (
                figure(amount)
              )}
              {edit ? edit.remove(item) : null}
            </div>
          );
        })}
        {edit?.add}
      </div>
      <div className="ml-auto max-w-xs space-y-2">
        {lines.gst ? (
          <>
            <div className="flex justify-between gap-6">
              <div style={body} className="opacity-70">
                {say('subtotal')}
              </div>
              {figure(totals.subtotal)}
            </div>
            <div className="flex justify-between gap-6">
              <div style={body} className="opacity-70">
                {say('gst')}
              </div>
              {figure(totals.gst)}
            </div>
          </>
        ) : null}
        <div className={`flex justify-between gap-6 ${lines.gst ? `border-t pt-3 ${RULE}` : ''}`}>
          {/* Bold body type, not a heading: figures in a display face read badly. */}
          <div style={{ ...body, fontWeight: 600 }}>{v.paid_on && !edit ? 'Paid' : say('total')}</div>
          {figure(totals.total, true)}
        </div>
      </div>
    </div>
  );
}
