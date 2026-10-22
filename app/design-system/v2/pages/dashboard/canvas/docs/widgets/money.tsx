'use client';

import { cents, gstOf } from '../../../payments/payments-data';
import { KitText, useRule } from '../kit-text';

/**
 * The money parts of an invoice, drawn in the kit: the lines it charges,
 * the totals with GST broken out (an Australian tax invoice has to show
 * it), and how to pay. Their figures come from the invoice itself and are
 * never typed on the page: these are required parts, styled and moved,
 * never edited or deleted.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/widgets/money
 */

/** One charged line. */
export interface LineItem {
  label: string;
  detail?: string | undefined;
  amount: number;
}

/** The charged lines, under a ruled header. */
export function LineItems({ items }: { items: LineItem[] }) {
  const strong = useRule(0.9);
  const faint = useRule();
  return (
    <div className="w-full tabular-nums">
      {/* Rules in the kit's ink: runtime colours, set inline. */}
      <div style={{ borderBottom: `1px solid ${strong}` }} className="flex justify-between pb-2">
        <KitText role="caption">Description</KitText>
        <KitText role="caption">Amount</KitText>
      </div>
      {items.map((it) => (
        <div key={it.label} style={{ borderBottom: `1px solid ${faint}` }} className="flex justify-between gap-6 py-4">
          <div>
            <KitText>{it.label}</KitText>
            {it.detail ? <KitText tone="muted">{it.detail}</KitText> : null}
          </div>
          <KitText>{cents(it.amount)}</KitText>
        </div>
      ))}
    </div>
  );
}

/** Subtotal, GST and the amount due (or paid). */
export function Totals({ amount, paid = false }: { amount: number; paid?: boolean }) {
  const gst = gstOf(amount);
  const strong = useRule(0.9);
  return (
    <div className="w-full space-y-2 tabular-nums">
      <div className="flex justify-between gap-6">
        <KitText tone="muted">Subtotal (excl. GST)</KitText>
        <KitText>{cents(amount - gst)}</KitText>
      </div>
      <div className="flex justify-between gap-6">
        <KitText tone="muted">GST (10%)</KitText>
        <KitText>{cents(gst)}</KitText>
      </div>
      <div style={{ borderTop: `1px solid ${strong}` }} className="flex justify-between gap-6 pt-3">
        <KitText role="subheading">{paid ? 'Paid' : 'Amount due'}</KitText>
        <KitText role="subheading">{cents(amount)}</KitText>
      </div>
    </div>
  );
}

/** How to pay: the pay link, and a bank transfer when the business has one. */
export function PayBox({ link, bank, reference }: { link: string; bank?: string | undefined; reference: string }) {
  return (
    <div className="grid w-full grid-cols-2 gap-8">
      <div className="space-y-1">
        <KitText role="caption">Pay online</KitText>
        <KitText tone="muted">Card or Apple Pay at</KitText>
        <KitText className="underline">{link}</KitText>
      </div>
      {bank ? (
        <div className="space-y-1">
          <KitText role="caption">Bank transfer</KitText>
          <KitText tone="muted">{bank}</KitText>
          <KitText tone="muted">Reference {reference}</KitText>
        </div>
      ) : null}
    </div>
  );
}
