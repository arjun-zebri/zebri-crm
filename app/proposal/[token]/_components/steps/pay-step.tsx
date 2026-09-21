'use client';

/**
 * The stepper's third pane: the booking's first payment stage, a card
 * payment when Stripe Connect is wired up, and bank transfer details as
 * the always-available fallback.
 *
 * @module app/proposal/[token]/_components/steps/pay-step
 */
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import { PayWithCardButton } from '@/app/invoice/[token]/pay-with-card-button';
import { fmt, fmtDate } from '@/lib/branding/public-blocks/shared';
import { roleDefaults } from '@/lib/branding/type-defaults';
import type { AcceptResponse, PublicProposalInvoice } from '@/lib/proposals/close-types';
import type { PublicProposal } from '@/lib/proposals/public-types';

/** Props for {@link PayStep}: the generated invoice, the signed contract for its number, and the skip callback for bank transfer. */
export interface PayStepProps {
  proposal: PublicProposal;
  invoice: PublicProposalInvoice;
  /** The signed contract, for the contract-number subheading. Null on a resumed session (already signed on a prior visit). */
  contract: AcceptResponse | null;
  /** "Pay by bank transfer later" -> move straight to done. */
  onSkip: () => void;
}

/** See {@link PayStepProps}. */
export function PayStep({ proposal, invoice, contract, onSkip }: PayStepProps) {
  const headingStyle = resolveTextStyle(undefined, roleDefaults(proposal, 'sectionHeading'));
  const bodyStyle = resolveTextStyle(undefined, roleDefaults(proposal, 'body'));
  const labelStyle = resolveTextStyle(undefined, roleDefaults(proposal, 'sectionLabel'));
  const stage = invoice.first_stage;
  const hasBankDetails = Boolean(proposal.bank_account_name || proposal.bank_bsb || proposal.bank_account_number);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="m-0" style={headingStyle}>
          You&apos;re booked
        </h3>
        {contract ? (
          <p className="m-0" style={{ ...bodyStyle, color: proposal.muted_color }}>
            Contract {contract.contract.contract_number}
          </p>
        ) : null}
      </div>
      {stage ? (
        <p className="m-0" style={bodyStyle}>
          {stage.label}: {fmt(stage.amount_cents / 100)}
          {stage.due_date ? ` (due ${fmtDate(stage.due_date)})` : ''}
        </p>
      ) : null}
      {stage && invoice.stripe_payment_enabled && proposal.stripe_connect_enabled ? (
        <PayWithCardButton
          invoiceId={invoice.id}
          shareToken={invoice.share_token}
          branding={proposal}
          actionStyle={{ color: proposal.brand_color, radius: proposal.button_radius }}
          paymentType="stage"
          stageId={stage.id}
          label="Pay with card"
        />
      ) : null}
      {hasBankDetails ? (
        <div className="space-y-1">
          <p className="m-0" style={labelStyle}>
            Bank transfer
          </p>
          {proposal.bank_account_name ? (
            <p className="m-0" style={bodyStyle}>
              Account name: {proposal.bank_account_name}
            </p>
          ) : null}
          {proposal.bank_bsb ? (
            <p className="m-0" style={bodyStyle}>
              BSB: {proposal.bank_bsb}
            </p>
          ) : null}
          {proposal.bank_account_number ? (
            <p className="m-0" style={bodyStyle}>
              Account number: {proposal.bank_account_number}
            </p>
          ) : null}
          {invoice.invoice_number ? (
            <p className="m-0" style={{ ...bodyStyle, color: proposal.muted_color }}>
              Reference: {invoice.invoice_number}
            </p>
          ) : null}
        </div>
      ) : null}
      <button type="button" onClick={onSkip} className="underline" style={{ color: proposal.brand_color }}>
        Pay by bank transfer later
      </button>
    </div>
  );
}
