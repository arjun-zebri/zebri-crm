/**
 * The "they declined" notice shown on a contract in the builder.
 *
 * There used to be a matching green panel for the signed state, repeating the
 * signer, the timestamp and the IP. It is gone: the Activity panel directly
 * above already lists that event with the same three facts, and a tinted box
 * restating them read as a second, louder source of truth. A decline has no
 * equivalent, because the reason the couple gave is not an audit event and
 * appears nowhere else.
 *
 * @module components/builders/parts/contract-decline-notice
 */
'use client';

import { XCircle } from 'lucide-react';

export interface ContractDeclineNoticeProps {
  /** Free-text reason the couple gave; null when they gave none. */
  declinedReason: string | null;
}

export function ContractDeclineNotice({ declinedReason }: ContractDeclineNoticeProps) {
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
