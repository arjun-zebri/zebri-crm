/**
 * Vertical deposit + final-balance schedule, used by both rendering
 * paths (branded block-tree + hardcoded fallback). Previously
 * duplicated in two places inside `page.tsx`; extracted here so
 * there's one truth.
 *
 * The "Paid" check next to a stage uses the `text-success` token
 * (was `text-green-600`); brand colours flow through the
 * `PayWithCardButton` via `brandColor` + `radius` props.
 *
 * @module app/invoice/[token]/_components/invoice-payment-schedule
 */
import { CheckCircle } from 'lucide-react';

import { PayWithCardButton } from '../pay-with-card-button';

import { formatCurrency, formatDate, type PublicInvoice } from './public-invoice';

export interface InvoicePaymentScheduleProps {
  invoice: PublicInvoice;
  depositAmount: number;
  finalAmount: number;
  showDepositButton: boolean;
  showFinalButton: boolean;
  /** Inline-style branding for the rows. */
  textColor: string;
  mutedColor: string;
  /** Brand colour + corner radius for the Pay-with-card button. */
  buttonColor: string;
  buttonRadius: number;
}

export function InvoicePaymentSchedule({
  invoice,
  depositAmount,
  finalAmount,
  showDepositButton,
  showFinalButton,
  textColor,
  mutedColor,
  buttonColor,
  buttonRadius,
}: InvoicePaymentScheduleProps) {
  return (
    <div className="space-y-2">
      {/* Deposit */}
      <div className="py-2.5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm" style={{ color: textColor }}>
              Deposit ({invoice.deposit_percent}%)
            </span>
            {invoice.deposit_due_date ? (
              <span className="text-xs block" style={{ color: mutedColor }}>
                Due {formatDate(invoice.deposit_due_date)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium tabular-nums"
              style={{ color: textColor }}
            >
              {formatCurrency(depositAmount)}
            </span>
            {invoice.deposit_paid_at ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                Paid
              </span>
            ) : null}
          </div>
        </div>
        {showDepositButton ? (
          <div className="mt-2">
            <PayWithCardButton
              invoiceId={invoice.id}
              shareToken={invoice.share_token}
              brandColor={buttonColor}
              radius={buttonRadius}
              paymentType="deposit"
              label="Pay deposit"
            />
          </div>
        ) : null}
      </div>

      {/* Final balance */}
      <div className="py-2.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm" style={{ color: textColor }}>
              Final balance ({100 - (invoice.deposit_percent ?? 0)}%)
            </span>
            {invoice.final_due_date ? (
              <span className="text-xs block" style={{ color: mutedColor }}>
                Due {formatDate(invoice.final_due_date)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium tabular-nums"
              style={{ color: textColor }}
            >
              {formatCurrency(finalAmount)}
            </span>
            {invoice.final_paid_at ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                Paid
              </span>
            ) : null}
          </div>
        </div>
        {showFinalButton ? (
          <div className="mt-2">
            <PayWithCardButton
              invoiceId={invoice.id}
              shareToken={invoice.share_token}
              brandColor={buttonColor}
              radius={buttonRadius}
              paymentType="final"
              label="Pay balance"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
