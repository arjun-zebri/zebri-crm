'use client';

/**
 * The stepper's final pane: confirmation copy, an optional PDF keepsake,
 * and a link to the invoice once one exists.
 *
 * @module app/proposal/[token]/_components/steps/done-step
 */
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { roleDefaults } from '@/lib/branding/type-defaults';
import type { PublicProposalInvoice } from '@/lib/proposals/close-types';

/** Props for {@link DoneStep}: the confirmation pane's branding, the MC's name, and the invoice (null when payment was skipped or finalize failed). */
export interface DoneStepProps {
  branding: PublicBranding;
  /** The MC's business name, for the reassurance copy. Falls back to "Your host". */
  businessName: string | null;
  invoice: PublicProposalInvoice | null;
  /** When given, renders a "Download PDF" text button that calls this. */
  onDownloadPdf?: (() => void) | undefined;
}

/** See {@link DoneStepProps}. */
export function DoneStep({ branding, businessName, invoice, onDownloadPdf }: DoneStepProps) {
  const headingStyle = resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading'));
  const bodyStyle = resolveTextStyle(undefined, roleDefaults(branding, 'body'));

  return (
    <div className="space-y-4">
      <h3 className="m-0" style={headingStyle}>
        Thank you
      </h3>
      <p className="m-0" style={{ ...bodyStyle, color: branding.muted_color }}>
        Your date is confirmed. {businessName || 'Your host'} will be in touch.
      </p>
      <div className="flex items-center gap-4">
        {onDownloadPdf ? (
          <button type="button" onClick={onDownloadPdf} className="underline" style={{ color: branding.brand_color }}>
            Download PDF
          </button>
        ) : null}
        {invoice ? (
          <a href={`/invoice/${invoice.share_token}`} className="underline" style={{ color: branding.brand_color }}>
            View your invoice
          </a>
        ) : null}
      </div>
    </div>
  );
}
