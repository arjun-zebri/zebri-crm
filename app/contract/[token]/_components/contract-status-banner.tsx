/**
 * Inline banner at the top of the contract card body — `signed`,
 * `declined`, or `expired`. Tokens replace the raw
 * `bg-emerald-50` / `bg-red-50` / `bg-amber-50` classes from the
 * prior single-file page.
 *
 * The signed banner doubles as the "Download PDF" affordance.
 *
 * @module app/contract/[token]/_components/contract-status-banner
 */
import { Download, ShieldCheck } from 'lucide-react';

import { htmlToPlainText } from '@/lib/branding/sanitize';

import { formatDate, formatDateTime } from './public-contract';

export interface ContractStatusBannerProps {
  kind: 'signed' | 'declined' | 'expired';
  /** Signed-variant fields. */
  signerName?: string | null;
  signedAt?: string | null;
  signerIp?: string | null;
  onDownloadPdf?: () => void;
  /** Declined-variant fields. */
  declinedAt?: string | null;
  declinedReason?: string | null;
  /** Expired-variant fields. */
  expiresAt?: string | null;
  /** Used in expired + signed for the "contact …" sentence. */
  businessName?: string | null;
}

export function ContractStatusBanner({
  kind,
  signerName,
  signedAt,
  signerIp,
  onDownloadPdf,
  declinedAt,
  declinedReason,
  expiresAt,
  businessName,
}: ContractStatusBannerProps) {
  if (kind === 'signed') {
    return (
      <div className="rounded-card border border-success/20 bg-success/10 p-4 flex items-start gap-3">
        <ShieldCheck
          size={20}
          strokeWidth={1.5}
          className="text-success shrink-0 mt-0.5"
        />
        <div className="text-sm text-success flex-1">
          Signed by <strong>{signerName ?? 'the couple'}</strong>
          {signedAt ? ` on ${formatDateTime(signedAt)}` : ''}.
          {signerIp ? (
            <span className="block text-xs text-success/80 mt-1">
              IP {signerIp}
            </span>
          ) : null}
        </div>
        {onDownloadPdf ? (
          <button
            onClick={onDownloadPdf}
            className="shrink-0 text-xs font-medium text-success border border-success/30 hover:bg-success/15 rounded-control px-2.5 py-1.5 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} strokeWidth={1.5} /> PDF
          </button>
        ) : null}
      </div>
    );
  }

  if (kind === 'declined') {
    return (
      <div className="rounded-card border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
        This contract was declined
        {declinedAt ? ` on ${formatDateTime(declinedAt)}` : ''}.
        {declinedReason ? (
          <span className="block mt-1">Reason: {declinedReason}</span>
        ) : null}
      </div>
    );
  }

  // expired
  return (
    <div className="rounded-card border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
      This contract has expired
      {expiresAt ? ` on ${formatDate(expiresAt)}` : ''}.
      {businessName ? (
        <> Please contact {htmlToPlainText(businessName)} for a new link.</>
      ) : (
        <> Please contact your MC for a new link.</>
      )}
    </div>
  );
}
