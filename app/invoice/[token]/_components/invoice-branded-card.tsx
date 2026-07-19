/**
 * Branded-card variant of the public invoice — rendered when the
 * MC has a customised block tree in their branding kit
 * (invoice.branding_blocks is non-empty).
 *
 * The block tree is split at the paymentSchedule marker:
 *   - blocks BEFORE the marker render the invoice header, items,
 *     and totals (via PublicBlockRenderer)
 *   - then we insert the Zebri-rendered payment schedule (deposit
 *     and final) OR the single "Pay with card" button
 *   - blocks AFTER the marker render the footer, contact, and extras
 *
 * The renderer is told hideAction because invoices have their
 * own multi-step payment UX (deposit/final/full); the block tree's
 * action block (a single primary CTA) wouldn't fit.
 *
 * @module app/invoice/[token]/_components/invoice-branded-card
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import { getRgb } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { PublicBlockRenderer } from '@/lib/branding/public-renderer';
import { DENSITY_PAD } from '@/lib/branding/public-surface';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { PayWithCardButton } from '../pay-with-card-button';

import { InvoicePaymentSchedule } from './invoice-payment-schedule';
import type { PublicInvoice } from './public-invoice';

export interface InvoiceBrandedCardProps {
  invoice: PublicInvoice;
  preBlocks: Block[];
  postBlocks: Block[];
  hasSchedule: boolean;
  depositAmount: number;
  finalAmount: number;
  showFullButton: boolean;
  showDepositButton: boolean;
  showFinalButton: boolean;
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding;
  radius: number;
}

export function InvoiceBrandedCard({
  invoice,
  preBlocks,
  postBlocks,
  hasSchedule,
  depositAmount,
  finalAmount,
  showFullButton,
  showDepositButton,
  showFinalButton,
  branding,
  radius,
}: InvoiceBrandedCardProps) {
  const pad = DENSITY_PAD[invoice.density ?? 'cozy'];
  const sectionLabelDefaults = roleDefaults(branding, 'sectionLabel');

  // Compute border colours from the brand's border_color setting.
  // Hairlines follow the MC's brand setting rather than Zebri's app-chrome tokens.
  const borderRgb = getRgb(branding.border_color);
  const borderColor = borderRgb
    ? `rgba(${borderRgb[0]}, ${borderRgb[1]}, ${borderRgb[2]}, 1)`
    : branding.border_color;

  const doc = {
    title: invoice.title,
    refNumber: invoice.invoice_number,
    expiresAt: invoice.due_date,
    items: invoice.items,
    subtotal: invoice.subtotal,
    taxRate: invoice.tax_rate ?? 0,
  };

  return (
    <div
      className="overflow-hidden shadow-sm border"
      style={{ borderRadius: radius, backgroundColor: branding.surface_color, borderColor }}
    >
      <PublicBlockRenderer
        blocks={preBlocks}
        branding={invoice}
        doc={doc}
        hideAction
      />

      {hasSchedule ? (
        <div className={`${pad.cardSection} border-t`} style={{ borderTopColor: borderColor }}>
          <p
            className="mb-3"
            style={{
              fontSize: `${sectionLabelDefaults.fontSize}px`,
              color: sectionLabelDefaults.color,
              fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
              fontWeight: sectionLabelDefaults.fontWeight,
              lineHeight: sectionLabelDefaults.lineHeight,
              letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
              textTransform: sectionLabelDefaults.textTransform === 'uppercase' ? 'uppercase' : undefined,
            }}
          >
            Payment schedule
          </p>
          <InvoicePaymentSchedule
            invoice={invoice}
            depositAmount={depositAmount}
            finalAmount={finalAmount}
            showDepositButton={showDepositButton}
            showFinalButton={showFinalButton}
            branding={branding}
          />
        </div>
      ) : null}

      {showFullButton ? (
        <div className={`${pad.cardSection} border-t`} style={{ borderTopColor: borderColor }}>
          <PayWithCardButton
            invoiceId={invoice.id}
            shareToken={invoice.share_token}
            branding={branding}
          />
        </div>
      ) : null}

      {postBlocks.length > 0 ? (
        <PublicBlockRenderer
          blocks={postBlocks}
          branding={invoice}
          doc={doc}
          hideAction
        />
      ) : null}
    </div>
  );
}
