/**
 * Vertical deposit + final-balance schedule, used by both rendering
 * paths (branded block-tree + hardcoded fallback). Previously
 * duplicated in two places inside page.tsx; extracted here so
 * there's one truth.
 *
 * The "Paid" check next to a stage uses STATUS_COLORS.success;
 * brand colours flow through the PayWithCardButton via brandColor
 * and radius props.
 *
 * @module app/invoice/[token]/_components/invoice-payment-schedule
 */
import { CheckCircle } from 'lucide-react';

import { getRgb } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { STATUS_COLORS } from '@/lib/branding/status-colors';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { PayWithCardButton } from '../pay-with-card-button';

import { formatCurrency, formatDate, type PublicInvoice } from './public-invoice';

export interface InvoicePaymentScheduleProps {
  invoice: PublicInvoice;
  depositAmount: number;
  finalAmount: number;
  showDepositButton: boolean;
  showFinalButton: boolean;
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding;
  /** Brand colour for the Pay-with-card button. */
  buttonColor: string;
  buttonRadius: number;
}

export function InvoicePaymentSchedule({
  invoice,
  depositAmount,
  finalAmount,
  showDepositButton,
  showFinalButton,
  branding,
  buttonColor,
  buttonRadius,
}: InvoicePaymentScheduleProps) {
  const bodyDefaults = roleDefaults(branding, 'body');
  const finePrintDefaults = roleDefaults(branding, 'finePrint');

  // Compute soft-opacity border for deposit/final schedule rows.
  // Composited from branding colour to avoid Zebri app-chrome tokens.
  const borderRgb = getRgb(branding.border_color);
  const borderColorHalf = borderRgb
    ? `rgba(${borderRgb[0]}, ${borderRgb[1]}, ${borderRgb[2]}, 0.5)`
    : branding.border_color;

  return (
    <div className="space-y-2">
      {/* Deposit */}
      <div className="py-2.5 border-b" style={{ borderBottomColor: borderColorHalf }}>
        <div className="flex items-center justify-between">
          <div>
            <span
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: bodyDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              Deposit ({invoice.deposit_percent}%)
            </span>
            {invoice.deposit_due_date ? (
              <span
                className="block"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: finePrintDefaults.color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
              >
                Due {formatDate(invoice.deposit_due_date)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="font-medium tabular-nums"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: bodyDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              {formatCurrency(depositAmount)}
            </span>
            {invoice.deposit_paid_at ? (
              <span
                className="flex items-center gap-1"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: STATUS_COLORS.success,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
              >
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
            <span
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: bodyDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              Final balance ({100 - (invoice.deposit_percent ?? 0)}%)
            </span>
            {invoice.final_due_date ? (
              <span
                className="block"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: finePrintDefaults.color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
              >
                Due {formatDate(invoice.final_due_date)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="font-medium tabular-nums"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: bodyDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              {formatCurrency(finalAmount)}
            </span>
            {invoice.final_paid_at ? (
              <span
                className="flex items-center gap-1"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: STATUS_COLORS.success,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
              >
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
