/**
 * Sign / Decline action row that shows on `active` contracts.
 *
 * The signing form is intentionally simple — typed name + intent
 * checkbox + a live preview of the rendered signature in a cursive
 * font. Australian common law accepts a typed-name signature with
 * affirmative intent; the checkbox + audit row are what actually
 * carry weight.
 *
 * @module app/contract/[token]/_components/contract-sign-actions
 */
import { Check, Loader2 } from 'lucide-react';

import { getTextColor } from '@/lib/branding/contrast';

export interface ContractSignActionsProps {
  signerName: string;
  onSignerNameChange: (next: string) => void;
  agreed: boolean;
  onAgreedChange: (next: boolean) => void;
  onSign: () => void;
  onDecline: () => void;
  actionLoading: boolean;
  actionError: string | null;
  /** Placeholder text for the name input — usually the couple name. */
  coupleName: string;
  /** Inline-style branding values. */
  textColor: string;
  mutedColor: string;
  radius: number;
  /** Brand-derived action styling (color + radius + custom labels).
   *  Labels are nullable to match `findActionStyle`'s return shape. */
  actionStyle: {
    color: string;
    radius: number;
    primaryLabel?: string | null;
    secondaryLabel?: string | null;
  };
}

export function ContractSignActions({
  signerName,
  onSignerNameChange,
  agreed,
  onAgreedChange,
  onSign,
  onDecline,
  actionLoading,
  actionError,
  coupleName,
  textColor,
  mutedColor,
  radius,
  actionStyle,
}: ContractSignActionsProps) {
  const canSign = signerName.trim().length > 0 && agreed && !actionLoading;
  return (
    <div className="border-t border-border pt-6 space-y-4">
      <p className="text-xs font-medium" style={{ color: mutedColor }}>
        Sign to accept
      </p>
      <div>
        <label
          className="block text-xs font-medium mb-1.5"
          style={{ color: mutedColor }}
        >
          Your full legal name
        </label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => onSignerNameChange(e.target.value)}
          placeholder={coupleName}
          className="w-full text-sm border border-border px-3 py-2.5 focus:outline-none focus:border-border-strong"
          style={{ borderRadius: radius, color: textColor }}
        />
      </div>
      {signerName.trim().length > 0 ? (
        <div
          className="border border-border bg-surface-muted p-4"
          style={{ borderRadius: radius }}
        >
          <p className="text-xs mb-1" style={{ color: mutedColor }}>
            Your signature will appear as
          </p>
          <p
            className="text-2xl"
            style={{
              color: textColor,
              fontFamily: 'Caveat, "Brush Script MT", cursive',
            }}
          >
            {signerName}
          </p>
        </div>
      ) : null}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgreedChange(e.target.checked)}
          className="mt-0.5 accent-black w-4 h-4"
        />
        <span className="text-sm" style={{ color: textColor }}>
          I agree to the terms above and intend my typed name to serve as my
          legal signature.
        </span>
      </label>
      {actionError ? (
        <p className="text-sm text-danger">{actionError}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          onClick={onSign}
          disabled={!canSign}
          style={{
            backgroundColor: actionStyle.color,
            color: getTextColor(actionStyle.color),
            borderRadius: actionStyle.radius,
          }}
          className="text-sm font-semibold px-5 py-2.5 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-default hover:opacity-90 transition"
        >
          {actionLoading ? (
            <Loader2 size={14} className="animate-spin" strokeWidth={1.5} />
          ) : (
            <Check size={14} strokeWidth={2} />
          )}
          {actionLoading
            ? 'Signing…'
            : (actionStyle.primaryLabel ?? 'Sign contract')}
        </button>
        <button
          onClick={onDecline}
          className="text-sm font-medium border border-border px-4 py-2.5 cursor-pointer hover:opacity-70"
          style={{ color: mutedColor, borderRadius: actionStyle.radius }}
        >
          {actionStyle.secondaryLabel ?? 'Decline'}
        </button>
      </div>
    </div>
  );
}
