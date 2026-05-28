/**
 * Accept / Decline button row for the quote fallback card. Includes
 * the two-step confirm flow ("Accept this quote?" → "Yes, accept" /
 * "Go back") so a one-handed mobile tap doesn't accept a $15k quote
 * by accident.
 *
 * Branded buttons: the primary button uses the MC's brand colour;
 * the secondary uses a border-only style. The text colour on the
 * primary is computed via `getTextColor()` for legibility against
 * whatever brand colour the MC picked.
 *
 * @module app/quote/[token]/_components/quote-accept-actions
 */
'use client';

import { useState } from 'react';

import { getTextColor } from '@/lib/branding/contrast';

export interface QuoteAcceptActionsProps {
  onAccept: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
  actionLoading: boolean;
  actionError: string | null;
  /** Brand colour for the accept button. */
  brand: string;
  /** Corner radius for both buttons. */
  radius: number;
  /** Inline-style text + muted colours for the confirm copy. */
  textColor: string;
  mutedColor: string;
}

export function QuoteAcceptActions({
  onAccept,
  onDecline,
  actionLoading,
  actionError,
  brand,
  radius,
  textColor,
  mutedColor,
}: QuoteAcceptActionsProps) {
  const [confirmingAccept, setConfirmingAccept] = useState(false);

  return (
    <div className="px-8 py-6 bg-surface-muted border-t border-border">
      {actionError ? (
        <p className="text-sm text-danger mb-4">{actionError}</p>
      ) : null}

      {confirmingAccept ? (
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: textColor }}>
            Accept this quote?
          </p>
          <p className="text-xs mb-4" style={{ color: mutedColor }}>
            By accepting you confirm you have reviewed the details above.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void onAccept()}
              disabled={actionLoading}
              style={{
                backgroundColor: brand,
                color: getTextColor(brand),
                borderRadius: radius,
              }}
              className="flex-1 py-3 text-sm font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? 'Processing…' : 'Yes, accept'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingAccept(false)}
              disabled={actionLoading}
              style={{ borderRadius: radius, color: textColor }}
              className="flex-1 py-3 border border-border text-sm font-medium hover:bg-surface-muted transition cursor-pointer disabled:opacity-50"
            >
              Go back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirmingAccept(true)}
            disabled={actionLoading}
            style={{
              backgroundColor: brand,
              color: getTextColor(brand),
              borderRadius: radius,
            }}
            className="flex-1 py-3 text-sm font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-50"
          >
            Accept Quote
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
      )}
    </div>
  );
}
