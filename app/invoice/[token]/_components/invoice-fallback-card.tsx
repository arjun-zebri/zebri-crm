/**
 * Hardcoded fallback rendering of the public invoice — used when
 * the MC hasn't customised their branding block tree
 * (`invoice.branding_blocks` is empty). Renders a standard
 * "minimal" invoice using inline-style branding (still respects
 * brand colour, font, density, radius) so MCs without a finished
 * brand kit still get a serviceable layout.
 *
 * This is the largest single component in the public-invoice
 * surface. It mirrors the layout of the in-product builder modal's
 * preview pane.
 *
 * @module app/invoice/[token]/_components/invoice-fallback-card
 */
import { Html } from '@/lib/branding/public-blocks/html';
import { DENSITY_PAD } from '@/lib/branding/public-surface';
import { htmlToPlainText } from '@/lib/branding/sanitize';

import { PayWithCardButton } from '../pay-with-card-button';

import { InvoicePaymentSchedule } from './invoice-payment-schedule';
import { formatCurrency, formatDate, type PublicInvoice } from './public-invoice';

export interface InvoiceFallbackCardProps {
  invoice: PublicInvoice;
  pageState: 'active' | 'overdue' | 'paid';
  hasSchedule: boolean;
  taxAmount: number;
  total: number;
  depositAmount: number;
  finalAmount: number;
  showFullButton: boolean;
  showDepositButton: boolean;
  showFinalButton: boolean;
  buttonColor: string;
  buttonRadius: number;
  /** Inline-style branding values from the invoice payload. */
  textColor: string;
  mutedColor: string;
  headingColor: string;
  subheadingColor: string;
  radius: number;
  headingStack: string | undefined;
  headingWeight: number;
}

export function InvoiceFallbackCard({
  invoice,
  pageState,
  hasSchedule,
  taxAmount,
  total,
  depositAmount,
  finalAmount,
  showFullButton,
  showDepositButton,
  showFinalButton,
  buttonColor,
  buttonRadius,
  textColor,
  mutedColor,
  headingColor,
  subheadingColor,
  radius,
  headingStack,
  headingWeight,
}: InvoiceFallbackCardProps) {
  const pad = DENSITY_PAD[invoice.density ?? 'cozy'];

  return (
    <div
      className="bg-surface shadow-sm border border-border overflow-hidden"
      style={{ borderRadius: radius }}
    >
      {/* Header */}
      <div className={`${pad.cardHeader} border-b border-border`}>
        {invoice.logo_url ? (
          // User-uploaded brand asset hosted on Supabase storage —
          // no next/image since we don't have the domain allow-listed
          // and each MC has a different storage path.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={invoice.logo_url}
            alt={htmlToPlainText(invoice.business_name) || 'Logo'}
            className="max-h-12 object-contain mb-3"
          />
        ) : invoice.business_name ? (
          <p
            className="text-xs font-medium uppercase tracking-wider mb-3"
            style={{ color: mutedColor }}
          >
            <Html value={invoice.business_name} allowLists={false} />
          </p>
        ) : null}
        {invoice.tagline ? (
          <p className="text-xs mb-3" style={{ color: mutedColor }}>
            <Html value={invoice.tagline} allowLists={false} />
          </p>
        ) : null}
        <h1
          className="text-2xl mb-1"
          style={{
            color: headingColor,
            fontFamily: headingStack,
            fontWeight: headingWeight,
          }}
        >
          {invoice.title}
        </h1>
        <p className="text-sm" style={{ color: mutedColor }}>
          {invoice.couple_name}
        </p>
        {invoice.abn ? (
          <p className="text-xs mt-1" style={{ color: mutedColor }}>
            ABN: {invoice.abn}
          </p>
        ) : null}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="text-xs" style={{ color: mutedColor }}>
            {invoice.invoice_number}
          </span>
          {invoice.due_date && !hasSchedule ? (
            <span
              className={`text-xs font-medium ${
                pageState === 'overdue' ? 'text-danger' : ''
              }`}
              style={pageState === 'overdue' ? undefined : { color: mutedColor }}
            >
              {pageState === 'overdue' ? 'Overdue · ' : 'Due '}
              {formatDate(invoice.due_date)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Line items */}
      <div className={pad.cardSection}>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: mutedColor }}
          >
            Description
          </span>
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: mutedColor }}
          >
            Amount
          </span>
        </div>

        {!invoice.items || invoice.items.length === 0 ? (
          <p className="text-sm py-4" style={{ color: mutedColor }}>
            No line items.
          </p>
        ) : (
          invoice.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between py-3 border-b border-border/50 gap-4"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm" style={{ color: textColor }}>
                  {item.description}
                </span>
                {item.quantity !== 1 ? (
                  <span className="text-xs block" style={{ color: mutedColor }}>
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </span>
                ) : null}
              </div>
              <span
                className="text-sm font-medium tabular-nums shrink-0"
                style={{ color: textColor }}
              >
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))
        )}

        {/* Subtotal + GST + Total */}
        <div className="pt-4 space-y-2">
          {(invoice.tax_rate || 0) > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: mutedColor }}>
                  Subtotal
                </span>
                <span className="text-sm tabular-nums" style={{ color: textColor }}>
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: mutedColor }}>
                  GST ({invoice.tax_rate}%)
                </span>
                <span className="text-sm tabular-nums" style={{ color: textColor }}>
                  {formatCurrency(taxAmount)}
                </span>
              </div>
            </>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: headingColor }}>
              Total
            </span>
            <span
              className="text-lg tabular-nums"
              style={{
                color: textColor,
                fontFamily: headingStack,
                fontWeight: headingWeight,
              }}
            >
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment schedule */}
      {hasSchedule ? (
        <div className="px-8 pb-6">
          <p
            className="text-xs font-medium uppercase tracking-wider mb-3"
            style={{ color: subheadingColor }}
          >
            Payment schedule
          </p>
          <InvoicePaymentSchedule
            invoice={invoice}
            depositAmount={depositAmount}
            finalAmount={finalAmount}
            showDepositButton={showDepositButton}
            showFinalButton={showFinalButton}
            textColor={textColor}
            mutedColor={mutedColor}
            buttonColor={buttonColor}
            buttonRadius={buttonRadius}
          />
        </div>
      ) : null}

      {/* Payment notes & bank details */}
      {invoice.notes ||
      invoice.bank_account_name ||
      invoice.bank_bsb ||
      invoice.bank_account_number ? (
        <div className="px-8 pb-8">
          <p
            className="text-xs font-medium uppercase tracking-wider mb-3"
            style={{ color: subheadingColor }}
          >
            Payment instructions
          </p>
          <div className="space-y-3">
            {invoice.notes ? (
              <p
                className="text-sm whitespace-pre-wrap"
                style={{ color: mutedColor }}
              >
                {invoice.notes}
              </p>
            ) : null}
            {invoice.bank_account_name ||
            invoice.bank_bsb ||
            invoice.bank_account_number ? (
              <div className="bg-surface-muted rounded-control p-3 space-y-1.5 text-sm">
                {invoice.bank_account_name ? (
                  <div>
                    <span style={{ color: mutedColor }}>Account name:</span>
                    <span className="ml-2" style={{ color: textColor }}>
                      {invoice.bank_account_name}
                    </span>
                  </div>
                ) : null}
                {invoice.bank_bsb ? (
                  <div>
                    <span style={{ color: mutedColor }}>BSB:</span>
                    <span
                      className="ml-2 font-mono"
                      style={{ color: textColor }}
                    >
                      {invoice.bank_bsb}
                    </span>
                  </div>
                ) : null}
                {invoice.bank_account_number ? (
                  <div>
                    <span style={{ color: mutedColor }}>Account:</span>
                    <span
                      className="ml-2 font-mono"
                      style={{ color: textColor }}
                    >
                      {invoice.bank_account_number}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Contact footer */}
      {invoice.show_contact_on_documents &&
      (invoice.phone ||
        invoice.website ||
        invoice.instagram_url ||
        invoice.facebook_url) ? (
        <div
          className="px-8 py-6 border-t border-border flex flex-wrap gap-4 text-xs"
          style={{ color: mutedColor }}
        >
          {invoice.phone ? <span>{invoice.phone}</span> : null}
          {invoice.website ? (
            <a
              href={invoice.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70"
            >
              {invoice.website}
            </a>
          ) : null}
          {invoice.instagram_url ? (
            <a
              href={invoice.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70"
            >
              Instagram
            </a>
          ) : null}
          {invoice.facebook_url ? (
            <a
              href={invoice.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70"
            >
              Facebook
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Pay with card (full - no schedule) */}
      {showFullButton ? (
        <div className="px-8 pb-8">
          <PayWithCardButton
            invoiceId={invoice.id}
            shareToken={invoice.share_token}
            brandColor={buttonColor}
            radius={buttonRadius}
          />
        </div>
      ) : null}
    </div>
  );
}
