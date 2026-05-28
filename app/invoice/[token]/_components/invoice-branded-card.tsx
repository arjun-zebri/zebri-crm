/**
 * Branded-card variant of the public invoice — rendered when the
 * MC has a customised block tree in their branding kit
 * (`invoice.branding_blocks` is non-empty).
 *
 * The block tree is split at the `paymentSchedule` marker:
 *   - blocks BEFORE the marker render the invoice header + items
 *     + totals (via `PublicBlockRenderer`)
 *   - then we insert the Zebri-rendered payment schedule (deposit
 *     + final) OR the single "Pay with card" button
 *   - blocks AFTER the marker render the footer / contact / extras
 *
 * The renderer is told `hideAction` because invoices have their
 * own multi-step payment UX (deposit/final/full); the block tree's
 * action block (a single primary CTA) wouldn't fit.
 *
 * @module app/invoice/[token]/_components/invoice-branded-card
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import { PublicBlockRenderer } from '@/lib/branding/public-renderer';
import { DENSITY_PAD } from '@/lib/branding/public-surface';

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
  buttonColor: string;
  buttonRadius: number;
  textColor: string;
  mutedColor: string;
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
  buttonColor,
  buttonRadius,
  textColor,
  mutedColor,
  radius,
}: InvoiceBrandedCardProps) {
  const pad = DENSITY_PAD[invoice.density ?? 'cozy'];
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
      className="bg-surface shadow-sm border border-border overflow-hidden"
      style={{ borderRadius: radius }}
    >
      <PublicBlockRenderer
        blocks={preBlocks}
        branding={invoice}
        doc={doc}
        hideAction
      />

      {hasSchedule ? (
        <div className={`${pad.cardSection} border-t border-border`}>
          <p
            className="text-xs font-medium uppercase tracking-wider mb-3"
            style={{ color: mutedColor }}
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

      {showFullButton ? (
        <div className={`${pad.cardSection} border-t border-border`}>
          <PayWithCardButton
            invoiceId={invoice.id}
            shareToken={invoice.share_token}
            brandColor={buttonColor}
            radius={buttonRadius}
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
