/**
 * Read-only "signature" panel for contracts in a terminal state
 * (signed / declined). Surfaces what the couple did + when + from
 * where, so the MC has the audit trail visible at a glance.
 *
 * Phase 3.1: extracted from the inline blocks in
 * `contract-builder-modal.tsx`. Token-compliant — was `bg-emerald-50`
 * / `bg-red-50` raw classes; now `bg-success/10` / `bg-danger/10`.
 *
 * @module components/builders/parts/contract-signature-display
 */
'use client';

import { CheckCircle2, XCircle } from 'lucide-react';

export interface ContractSignatureDisplayProps {
  kind: 'signed' | 'declined';
  /** Signer name on `signed`; null when missing. */
  signerName: string | null;
  /** ISO timestamp on `signed`; null when missing. */
  signedAt: string | null;
  /** IP captured at sign time. Surfaced in the audit trail. */
  signerIp: string | null;
  /** Free-text reason on `declined`; null when missing. */
  declinedReason: string | null;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ContractSignatureDisplay({
  kind,
  signerName,
  signedAt,
  signerIp,
  declinedReason,
}: ContractSignatureDisplayProps) {
  if (kind === 'signed') {
    return (
      <div className="rounded-control border border-success/30 bg-success/10 p-4 space-y-1.5">
        <div className="flex items-center gap-2 text-body text-success">
          <CheckCircle2 size={16} strokeWidth={1.5} />
          <span className="font-medium">
            Signed by {signerName || 'the couple'} on {formatDate(signedAt)}
          </span>
        </div>
        {signerIp ? (
          <p className="text-body text-text-muted pl-6">
            From IP <span className="font-mono">{signerIp}</span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-control border border-danger/30 bg-danger/10 p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-body text-danger">
        <XCircle size={16} strokeWidth={1.5} />
        <span className="font-medium">Declined</span>
      </div>
      {declinedReason ? (
        <p className="text-body text-text-muted pl-6">
          Reason: {declinedReason}
        </p>
      ) : null}
    </div>
  );
}
