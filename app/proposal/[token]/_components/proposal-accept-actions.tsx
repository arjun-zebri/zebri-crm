/**
 * Accept / Decline block for the public proposal. Two-step confirm
 * (mirrors the invoice/contract surfaces) with the chosen option +
 * live total in the confirm copy, so the couple sees exactly what
 * they're agreeing to before the final tap.
 *
 * Styled per the proposal-page mock: a single full-width brand CTA
 * ("Accept & reserve our date"), a "held for you until" caption when
 * the proposal has an expiry, and decline demoted to a quiet text
 * link underneath.
 *
 * @module app/proposal/[token]/_components/proposal-accept-actions
 */
'use client';

import { useState } from 'react';

import { getTextColor } from '@/lib/branding/contrast';
import { PROPOSAL_LABEL_DEFAULTS, type ProposalLabels } from '@/lib/branding/proposal-labels';
import { STATUS_COLORS } from '@/lib/branding/status-colors';

import { formatDate } from './public-proposal';

export interface ProposalAcceptActionsProps {
  /** Null while a multi-option proposal has no choice yet. */
  chosenOptionTitle: string | null;
  totalLabel: string;
  expiresAt: string | null;
  onAccept: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
  actionLoading: boolean;
  actionError: string | null;
  brand: string;
  radius: number;
  textColor: string;
  mutedColor: string;
  /** MC's border color from branding. */
  borderColor: string;
  /** MC's surface color from branding. */
  surfaceColor: string;
  /** The MC's editable accept/decline wording. */
  labels?: ProposalLabels;
}

export function ProposalAcceptActions({
  chosenOptionTitle,
  totalLabel,
  expiresAt,
  onAccept,
  onDecline,
  actionLoading,
  actionError,
  brand,
  radius,
  textColor,
  mutedColor,
  borderColor,
  surfaceColor,
  labels = PROPOSAL_LABEL_DEFAULTS,
}: ProposalAcceptActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const canAccept = !!chosenOptionTitle;
  const buttonRadius = Math.min(radius, 14);

  return (
    <div>
      {actionError ? (
        <p className="mb-4" style={{ fontSize: '14px', color: STATUS_COLORS.error }}>
          {actionError}
        </p>
      ) : null}

      {confirming && canAccept ? (
        <div>
          <p className="mb-1 font-medium" style={{ fontSize: '14px', color: textColor }}>
            Accept “{chosenOptionTitle}” for {totalLabel}?
          </p>
          <p className="mb-4" style={{ fontSize: '12px', color: mutedColor }}>
            By accepting you confirm your package choice and the extras selected above.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void onAccept()}
              disabled={actionLoading}
              style={{
                fontSize: '14px',
                fontWeight: 500,
                backgroundColor: brand,
                color: getTextColor(brand),
                borderRadius: buttonRadius,
              }}
              className="flex-1 py-3 hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Processing…' : 'Yes, accept'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={actionLoading}
              style={{
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: buttonRadius,
                color: textColor,
                border: `1px solid ${borderColor}`,
                backgroundColor: 'transparent',
              }}
              className="flex-1 py-3 hover:opacity-80 transition cursor-pointer disabled:opacity-50"
              onMouseEnter={(e) => {
                if (!actionLoading) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = surfaceColor;
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              Go back
            </button>
          </div>
        </div>
      ) : (
        <div>
          {!canAccept ? (
            <p className="mb-3 text-center" style={{ fontSize: '12px', color: mutedColor }}>
              Choose a package above to accept.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={actionLoading || !canAccept}
            style={{ fontSize: '15px', fontWeight: 500, backgroundColor: brand, color: getTextColor(brand), borderRadius: buttonRadius }}
            className="w-full py-3.5 hover:opacity-90 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {labels.accept.text}
          </button>
          {expiresAt ? (
            <p className="mt-2.5 text-center" style={{ fontSize: '12px', color: mutedColor }}>
              This proposal is held for you until {formatDate(expiresAt)}
            </p>
          ) : null}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => void onDecline()}
              disabled={actionLoading}
              style={{ fontSize: '12px', color: mutedColor, textDecoration: 'underline', textUnderlineOffset: '2px' }}
              className="hover:opacity-80 transition cursor-pointer disabled:opacity-50"
            >
              {labels.decline.text}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
