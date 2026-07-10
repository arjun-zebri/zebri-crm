/**
 * Accept / Decline row for the public proposal. Two-step confirm
 * (mirrors the quote page) with the chosen option + live total in the
 * confirm copy, so the couple sees exactly what they're agreeing to
 * before the final tap.
 *
 * @module app/proposal/[token]/_components/proposal-accept-actions
 */
'use client';

import { useState } from 'react';

import { getTextColor } from '@/lib/branding/contrast';

export interface ProposalAcceptActionsProps {
  /** Null while a multi-option proposal has no choice yet. */
  chosenOptionTitle: string | null;
  totalLabel: string;
  onAccept: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
  actionLoading: boolean;
  actionError: string | null;
  brand: string;
  radius: number;
  textColor: string;
  mutedColor: string;
}

export function ProposalAcceptActions({
  chosenOptionTitle,
  totalLabel,
  onAccept,
  onDecline,
  actionLoading,
  actionError,
  brand,
  radius,
  textColor,
  mutedColor,
}: ProposalAcceptActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const canAccept = !!chosenOptionTitle;

  return (
    <div className="px-8 py-6 bg-surface-muted border-t border-border">
      {actionError ? <p className="text-sm text-danger mb-4">{actionError}</p> : null}

      {confirming && canAccept ? (
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: textColor }}>
            Accept “{chosenOptionTitle}” for {totalLabel}?
          </p>
          <p className="text-xs mb-4" style={{ color: mutedColor }}>
            By accepting you confirm your package choice and the extras selected above.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void onAccept()}
              disabled={actionLoading}
              style={{ backgroundColor: brand, color: getTextColor(brand), borderRadius: radius }}
              className="flex-1 py-3 text-sm font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Processing…' : 'Yes, accept'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={actionLoading}
              style={{ borderRadius: radius, color: textColor }}
              className="flex-1 py-3 border border-border text-sm font-medium hover:bg-surface-muted transition cursor-pointer disabled:opacity-50"
            >
              Go back
            </button>
          </div>
        </div>
      ) : (
        <div>
          {!canAccept ? (
            <p className="text-xs mb-3" style={{ color: mutedColor }}>
              Choose a package above to accept.
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={actionLoading || !canAccept}
              style={{ backgroundColor: brand, color: getTextColor(brand), borderRadius: radius }}
              className="flex-1 py-3 text-sm font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Accept Proposal
            </button>
            <button
              type="button"
              onClick={() => void onDecline()}
              disabled={actionLoading}
              style={{ borderRadius: radius, color: textColor }}
              className="flex-1 py-3 border border-border text-sm font-medium hover:bg-surface-muted transition cursor-pointer disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
