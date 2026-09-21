'use client';

/**
 * "Not the right fit?" dialog: a reason radio group, an optional message,
 * and a Send button posting `/api/proposal/decline`. On success calls
 * `onDeclined`, which the page wires to `router.refresh()` so the server
 * component picks up the now-declined state.
 *
 * @module app/proposal/[token]/_components/decline-form
 */
import { useState } from 'react';

import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import { BusyLabel } from '@/components/ui/busy-label';
import { getTextColor } from '@/lib/branding/contrast';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { roleDefaults } from '@/lib/branding/type-defaults';
import { DECLINE_REASONS, DECLINE_REASON_LABELS, type DeclineReason } from '@/lib/proposals/close-types';

import { emitEngagement } from './engagement-bus';
import { ProposalSheet } from './proposal-sheet';

/** Props for {@link DeclineForm}: the decline dialog's open state, the share token it posts, and the branding it styles from. */
export interface DeclineFormProps {
  open: boolean;
  onClose: () => void;
  token: string;
  branding: PublicBranding;
  /** Called once the decline has been recorded. */
  onDeclined: () => void;
}

/** Copy for the `decline_proposal` errors the route can return. */
const DECLINE_ERROR_COPY: Record<string, string> = {
  not_found: 'This proposal is no longer available.',
  already_accepted: 'This proposal has already been accepted.',
  invalid_reason: 'Please choose a reason.',
};

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** See {@link DeclineFormProps}. */
export function DeclineForm({ open, onClose, token, branding, onDeclined }: DeclineFormProps) {
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyStyle = resolveTextStyle(undefined, roleDefaults(branding, 'body'));

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = message.trim();
      const res = await fetch('/api/proposal/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason, ...(trimmed ? { message: trimmed } : {}) }),
      });
      const json = (await res.json()) as { error?: string };
      if (res.ok) {
        emitEngagement({ type: 'declined', payload: { reason } });
        onDeclined();
      } else {
        setError(DECLINE_ERROR_COPY[json.error ?? ''] ?? GENERIC_ERROR);
      }
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProposalSheet
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Not the right fit?"
      branding={branding}
    >
      <div className="space-y-4">
        <fieldset className="m-0 space-y-2 border-0 p-0">
          <legend className="sr-only">Reason</legend>
          {DECLINE_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2" style={bodyStyle}>
              <input type="radio" name="decline-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
              {DECLINE_REASON_LABELS[r]}
            </label>
          ))}
        </fieldset>
        <label className="block space-y-1" style={bodyStyle}>
          <span>Anything you&apos;d like to tell {branding.business_name || 'us'}?</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
            className="w-full"
            style={{ borderColor: branding.border_color, borderWidth: 1, borderRadius: branding.corner_radius, color: branding.text_color }}
          />
        </label>
        {/* Public pages style only from PublicBranding, which carries no
            danger colour: an inline error reads as the muted body text,
            announced through role="alert" for assistive tech. */}
        {error ? (
          <p className="m-0" role="alert" style={{ ...bodyStyle, color: branding.muted_color }}>
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={send}
          disabled={busy || !reason}
          aria-busy={busy || undefined}
          className="px-4 py-2 disabled:opacity-50"
          style={{ background: branding.brand_color, color: getTextColor(branding.brand_color), borderRadius: branding.corner_radius }}
        >
          <BusyLabel busy={busy}>Send</BusyLabel>
        </button>
      </div>
    </ProposalSheet>
  );
}
