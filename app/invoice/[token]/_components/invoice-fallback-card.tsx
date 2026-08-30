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
import { getRgb } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import { Html } from '@/lib/branding/public-blocks/html';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { DENSITY_PAD } from '@/lib/branding/public-surface';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { STATUS_COLORS } from '@/lib/branding/status-colors';
import { applyCase, cssTextTransform } from '@/lib/branding/text-case';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { PayWithCardButton } from '../pay-with-card-button';

import { InvoicePaymentSchedule } from './invoice-payment-schedule';
import { formatCurrency, formatDate, type PublicInvoice } from './public-invoice';

export interface InvoiceFallbackCardProps {
  invoice: PublicInvoice;
  pageState: 'active' | 'overdue' | 'paid';
  hasSchedule: boolean;
  taxAmount: number;
  total: number;
  /** Id of the earliest unpaid stage, the only one with a live Pay button. */
  nextPayableStageId: string | null;
  showPayButtons: boolean;
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding;
  radius: number;
  /** Action block overrides for button color and radius. Required. */
  actionStyle: { color: string; radius: number } | null;
}

export function InvoiceFallbackCard({
  invoice,
  pageState,
  hasSchedule,
  taxAmount,
  total,
  nextPayableStageId,
  showPayButtons,
  branding,
  radius,
  actionStyle,
}: InvoiceFallbackCardProps) {
  const pad = DENSITY_PAD[invoice.density ?? 'cozy'];

  // Resolve type styles for all text roles.
  const docTitleDefaults = roleDefaults(branding, 'docTitle');
  const sectionLabelDefaults = roleDefaults(branding, 'sectionLabel');
  const bodyDefaults = roleDefaults(branding, 'body');
  const finePrintDefaults = roleDefaults(branding, 'finePrint');
  const totalDefaults = roleDefaults(branding, 'total');

  // Compute border colours from the brand's border_color setting.
  // Soft opacity is achieved by compositing rgba rather than
  // reintroducing Zebri app-chrome tokens.
  const borderRgb = getRgb(branding.border_color);
  const borderColor = borderRgb
    ? `rgba(${borderRgb[0]}, ${borderRgb[1]}, ${borderRgb[2]}, 1)`
    : branding.border_color;
  const borderColorHalf = borderRgb
    ? `rgba(${borderRgb[0]}, ${borderRgb[1]}, ${borderRgb[2]}, 0.5)`
    : branding.border_color;

  return (
    <div
      className="overflow-hidden"
      style={{ borderRadius: radius, backgroundColor: branding.surface_color, borderColor }}
    >
      {/* Header */}
      <div className={`${pad.cardHeader} border-b`} style={{ borderBottomColor: borderColor }}>
        {invoice.logo_url ? (
          // User-uploaded brand asset hosted on Supabase storage—
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
            className="mb-3"
            style={{
              fontSize: `${sectionLabelDefaults.fontSize}px`,
              color: sectionLabelDefaults.color,
              fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
              fontWeight: sectionLabelDefaults.fontWeight,
              lineHeight: sectionLabelDefaults.lineHeight,
              letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
              textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
            }}
          >
            <Html value={invoice.business_name} allowLists={false} />
          </p>
        ) : null}
        {invoice.tagline ? (
          <p
            className="mb-3"
            style={{
              fontSize: `${finePrintDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
              fontWeight: finePrintDefaults.fontWeight,
              lineHeight: finePrintDefaults.lineHeight,
            }}
          >
            <Html value={invoice.tagline} allowLists={false} />
          </p>
        ) : null}
        <h1
          className="mb-1"
          style={{
            fontSize: `${docTitleDefaults.fontSize}px`,
            color: docTitleDefaults.color,
            fontFamily: FONT_STACKS[docTitleDefaults.fontFamily as never],
            fontWeight: docTitleDefaults.fontWeight,
            lineHeight: docTitleDefaults.lineHeight,
            letterSpacing: `${docTitleDefaults.letterSpacing}px`,
            textTransform: cssTextTransform(docTitleDefaults.textTransform),
          }}
        >
          {applyCase(invoice.title, docTitleDefaults.textTransform)}
        </h1>
        <p
          style={{
            fontSize: `${bodyDefaults.fontSize}px`,
            color: bodyDefaults.color,
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            fontWeight: bodyDefaults.fontWeight,
            lineHeight: bodyDefaults.lineHeight,
          }}
        >
          {invoice.couple_name}
        </p>
        {invoice.abn ? (
          <p
            className="mt-1"
            style={{
              fontSize: `${finePrintDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
              fontWeight: finePrintDefaults.fontWeight,
              lineHeight: finePrintDefaults.lineHeight,
            }}
          >
            ABN: {invoice.abn}
          </p>
        ) : null}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span
            style={{
              fontSize: `${finePrintDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
              fontWeight: finePrintDefaults.fontWeight,
              lineHeight: finePrintDefaults.lineHeight,
            }}
          >
            {invoice.invoice_number}
          </span>
          {invoice.due_date && !hasSchedule ? (
            <span
              className="font-medium"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: pageState === 'overdue' ? STATUS_COLORS.error : finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: finePrintDefaults.fontWeight,
                lineHeight: finePrintDefaults.lineHeight,
              }}
            >
              {pageState === 'overdue' ? 'Overdue · ' : 'Due '}
              {formatDate(invoice.due_date)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Line items */}
      <div className={pad.cardSection}>
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderBottomColor: borderColor }}>
          <span
            style={{
              fontSize: `${sectionLabelDefaults.fontSize}px`,
              color: sectionLabelDefaults.color,
              fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
              fontWeight: sectionLabelDefaults.fontWeight,
              lineHeight: sectionLabelDefaults.lineHeight,
              letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
              textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
            }}
          >
            {applyCase('Description', sectionLabelDefaults.textTransform)}
          </span>
          <span
            style={{
              fontSize: `${sectionLabelDefaults.fontSize}px`,
              color: sectionLabelDefaults.color,
              fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
              fontWeight: sectionLabelDefaults.fontWeight,
              lineHeight: sectionLabelDefaults.lineHeight,
              letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
              textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
            }}
          >
            {applyCase('Amount', sectionLabelDefaults.textTransform)}
          </span>
        </div>

        {!invoice.items || invoice.items.length === 0 ? (
          <p
            className="py-4"
            style={{
              fontSize: `${bodyDefaults.fontSize}px`,
              color: bodyDefaults.color,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              fontWeight: bodyDefaults.fontWeight,
              lineHeight: bodyDefaults.lineHeight,
            }}
          >
            No line items.
          </p>
        ) : (
          invoice.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between py-3 border-b gap-4"
              style={{ borderBottomColor: borderColorHalf }}
            >
              <div className="flex-1 min-w-0">
                <span
                  style={{
                    fontSize: `${bodyDefaults.fontSize}px`,
                    color: bodyDefaults.color,
                    fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                    fontWeight: bodyDefaults.fontWeight,
                    lineHeight: bodyDefaults.lineHeight,
                  }}
                >
                  {item.description}
                </span>
                {item.quantity !== 1 ? (
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
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </span>
                ) : null}
              </div>
              <span
                className="font-medium tabular-nums shrink-0"
                style={{
                  fontSize: `${bodyDefaults.fontSize}px`,
                  color: bodyDefaults.color,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: bodyDefaults.fontWeight,
                  lineHeight: bodyDefaults.lineHeight,
                }}
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
                <span
                  style={{
                    fontSize: `${bodyDefaults.fontSize}px`,
                    color: bodyDefaults.color,
                    fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                    fontWeight: bodyDefaults.fontWeight,
                    lineHeight: bodyDefaults.lineHeight,
                  }}
                >
                  Subtotal
                </span>
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: `${bodyDefaults.fontSize}px`,
                    color: bodyDefaults.color,
                    fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                    fontWeight: bodyDefaults.fontWeight,
                    lineHeight: bodyDefaults.lineHeight,
                  }}
                >
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  style={{
                    fontSize: `${bodyDefaults.fontSize}px`,
                    color: bodyDefaults.color,
                    fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                    fontWeight: bodyDefaults.fontWeight,
                    lineHeight: bodyDefaults.lineHeight,
                  }}
                >
                  GST ({invoice.tax_rate}%)
                </span>
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: `${bodyDefaults.fontSize}px`,
                    color: bodyDefaults.color,
                    fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                    fontWeight: bodyDefaults.fontWeight,
                    lineHeight: bodyDefaults.lineHeight,
                  }}
                >
                  {formatCurrency(taxAmount)}
                </span>
              </div>
            </>
          ) : null}
          <div className="flex items-center justify-between">
            <span
              className="font-semibold"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: docTitleDefaults.color,
                fontFamily: FONT_STACKS[docTitleDefaults.fontFamily as never],
                fontWeight: docTitleDefaults.fontWeight,
                lineHeight: docTitleDefaults.lineHeight,
              }}
            >
              Total
            </span>
            <span
              className="font-semibold tabular-nums"
              style={{
                fontSize: `${totalDefaults.fontSize}px`,
                color: totalDefaults.color,
                fontFamily: FONT_STACKS[totalDefaults.fontFamily as never],
                fontWeight: totalDefaults.fontWeight,
                lineHeight: totalDefaults.lineHeight,
              }}
            >
              {formatCurrency(total)}
            </span>
          </div>
          {/* Tax disclosure, not a money row: it sits under the total so
              nothing in the tally above it changes. */}
          {invoice.gst_inclusive ? (
            <p
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: bodyDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              Prices include GST
            </p>
          ) : null}
        </div>
      </div>

      {/* Payment schedule */}
      {hasSchedule ? (
        <div className="px-8 pb-6">
          <p
            className="mb-3"
            style={{
              fontSize: `${sectionLabelDefaults.fontSize}px`,
              color: sectionLabelDefaults.color,
              fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
              fontWeight: sectionLabelDefaults.fontWeight,
              lineHeight: sectionLabelDefaults.lineHeight,
              letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
              textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
            }}
          >
            {applyCase('Payment schedule', sectionLabelDefaults.textTransform)}
          </p>
          <InvoicePaymentSchedule
            invoice={invoice}
            nextPayableStageId={nextPayableStageId}
            showPayButtons={showPayButtons}
            branding={branding}
            actionStyle={actionStyle}
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
            className="mb-3"
            style={{
              fontSize: `${sectionLabelDefaults.fontSize}px`,
              color: sectionLabelDefaults.color,
              fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
              fontWeight: sectionLabelDefaults.fontWeight,
              lineHeight: sectionLabelDefaults.lineHeight,
              letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
              textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
            }}
          >
            {applyCase('Payment instructions', sectionLabelDefaults.textTransform)}
          </p>
          <div className="space-y-3">
            {invoice.notes ? (
              <p
                className="whitespace-pre-wrap"
                style={{
                  fontSize: `${bodyDefaults.fontSize}px`,
                  color: bodyDefaults.color,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: bodyDefaults.fontWeight,
                  lineHeight: bodyDefaults.lineHeight,
                }}
              >
                {invoice.notes}
              </p>
            ) : null}
            {invoice.bank_account_name ||
            invoice.bank_bsb ||
            invoice.bank_account_number ? (
              <div
                className="rounded-control p-3 space-y-1.5"
                style={{
                  backgroundColor: branding.surface_color,
                }}
              >
                {invoice.bank_account_name ? (
                  <div>
                    <span
                      style={{
                        fontSize: `${sectionLabelDefaults.fontSize}px`,
                        color: sectionLabelDefaults.color,
                        fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
                        fontWeight: sectionLabelDefaults.fontWeight,
                        lineHeight: sectionLabelDefaults.lineHeight,
                        letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
                        textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
                      }}
                    >
                      {applyCase('Account name:', sectionLabelDefaults.textTransform)}
                    </span>
                    <span
                      className="ml-2"
                      style={{
                        fontSize: `${bodyDefaults.fontSize}px`,
                        color: bodyDefaults.color,
                        fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                        fontWeight: bodyDefaults.fontWeight,
                        lineHeight: bodyDefaults.lineHeight,
                      }}
                    >
                      {invoice.bank_account_name}
                    </span>
                  </div>
                ) : null}
                {invoice.bank_bsb ? (
                  <div>
                    <span
                      style={{
                        fontSize: `${sectionLabelDefaults.fontSize}px`,
                        color: sectionLabelDefaults.color,
                        fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
                        fontWeight: sectionLabelDefaults.fontWeight,
                        lineHeight: sectionLabelDefaults.lineHeight,
                        letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
                        textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
                      }}
                    >
                      {applyCase('BSB:', sectionLabelDefaults.textTransform)}
                    </span>
                    <span
                      className="ml-2 font-mono"
                      style={{
                        fontSize: `${bodyDefaults.fontSize}px`,
                        color: bodyDefaults.color,
                        fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                        fontWeight: bodyDefaults.fontWeight,
                        lineHeight: bodyDefaults.lineHeight,
                      }}
                    >
                      {invoice.bank_bsb}
                    </span>
                  </div>
                ) : null}
                {invoice.bank_account_number ? (
                  <div>
                    <span
                      style={{
                        fontSize: `${sectionLabelDefaults.fontSize}px`,
                        color: sectionLabelDefaults.color,
                        fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
                        fontWeight: sectionLabelDefaults.fontWeight,
                        lineHeight: sectionLabelDefaults.lineHeight,
                        letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
                        textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
                      }}
                    >
                      {applyCase('Account:', sectionLabelDefaults.textTransform)}
                    </span>
                    <span
                      className="ml-2 font-mono"
                      style={{
                        fontSize: `${bodyDefaults.fontSize}px`,
                        color: bodyDefaults.color,
                        fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                        fontWeight: bodyDefaults.fontWeight,
                        lineHeight: bodyDefaults.lineHeight,
                      }}
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
          className="px-8 py-6 border-t flex flex-wrap gap-4"
          style={{
            borderTopColor: borderColor,
            fontSize: `${finePrintDefaults.fontSize}px`,
            color: finePrintDefaults.color,
            fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
            fontWeight: finePrintDefaults.fontWeight,
            lineHeight: finePrintDefaults.lineHeight,
          }}
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

      {/* Pay with card (stageless invoice) */}
      {!hasSchedule && showPayButtons && actionStyle ? (
        <div className="px-8 pb-8">
          <PayWithCardButton
            invoiceId={invoice.id}
            shareToken={invoice.share_token}
            branding={branding}
            actionStyle={actionStyle}
          />
        </div>
      ) : null}
    </div>
  );
}
