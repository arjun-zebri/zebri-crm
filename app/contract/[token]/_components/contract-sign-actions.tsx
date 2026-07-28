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

import { getRgb, getTextColor } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { STATUS_COLORS } from '@/lib/branding/status-colors';
import { roleDefaults } from '@/lib/branding/type-defaults';

/**
 * Sign / Decline action form rendered on active contracts.
 *
 * @param signerName - The name entered by the signer
 * @param onSignerNameChange - Callback when signer name changes
 * @param agreed - Whether the agreement checkbox is checked
 * @param onAgreedChange - Callback when agreement checkbox changes
 * @param onSign - Callback when Sign button is clicked
 * @param onDecline - Callback when Decline button is clicked
 * @param actionLoading - Whether an action is in progress
 * @param actionError - Error message if an action failed
 * @param coupleName - Placeholder text for the name input
 * @param textColor - Primary text color (inline style)
 * @param mutedColor - Secondary/muted text color (inline style)
 * @param radius - Border radius for inputs (inline style)
 * @param branding - MC's branding configuration
 * @param actionStyle - Brand-derived button styling (color, radius, custom labels)
 */
export interface ContractSignActionsProps {
  signerName: string;
  onSignerNameChange: (next: string) => void;
  agreed: boolean;
  onAgreedChange: (next: boolean) => void;
  onSign: () => void;
  onDecline: () => void;
  actionLoading: boolean;
  actionError: string | null;
  coupleName: string;
  textColor: string;
  mutedColor: string;
  radius: number;
  branding: PublicBranding;
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
  branding,
  actionStyle,
}: ContractSignActionsProps) {
  const canSign = signerName.trim().length > 0 && agreed && !actionLoading;
  const bodyDefaults = roleDefaults(branding, 'body');
  const finePrintDefaults = roleDefaults(branding, 'finePrint');

  // Faint wash behind the signature preview, composited from the brand text
  // colour rather than a Zebri app-chrome token.
  const textRgb = getRgb(branding.text_color);
  const previewBackground = textRgb
    ? `rgba(${textRgb[0]}, ${textRgb[1]}, ${textRgb[2]}, 0.02)`
    : 'transparent';

  return (
    <div className="border-t pt-6 space-y-4" style={{ borderTopColor: branding.border_color }}>
      <p
        style={{
          color: mutedColor,
          fontSize: `${finePrintDefaults.fontSize}px`,
          fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
          fontWeight: finePrintDefaults.fontWeight,
        }}
      >
        Sign to accept
      </p>
      <div>
        <label
          className="block mb-1.5"
          style={{
            color: mutedColor,
            fontSize: `${finePrintDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
            fontWeight: finePrintDefaults.fontWeight,
          }}
        >
          Your full legal name
        </label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => onSignerNameChange(e.target.value)}
          placeholder={coupleName}
          className="w-full border px-3 py-2.5 focus:outline-none"
          style={{
            borderRadius: radius,
            color: textColor,
            fontSize: `${bodyDefaults.fontSize}px`,
            borderColor: branding.border_color,
          }}
        />
      </div>
      {signerName.trim().length > 0 ? (
        <div
          className="border p-4"
          style={{
            borderRadius: radius,
            borderColor: branding.border_color,
            backgroundColor: previewBackground,
          }}
        >
          <p
            className="mb-1"
            style={{
              color: mutedColor,
              fontSize: `${finePrintDefaults.fontSize}px`,
              fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
            }}
          >
            Your signature will appear as
          </p>
          <p
            style={{
              color: textColor,
              fontSize: `${roleDefaults(branding, 'sectionHeading').fontSize}px`,
              fontFamily: 'Caveat, "Brush Script MT", cursive',
              lineHeight: roleDefaults(branding, 'sectionHeading').lineHeight,
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
        <span
          style={{
            color: textColor,
            fontSize: `${bodyDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            lineHeight: bodyDefaults.lineHeight,
          }}
        >
          I agree to the terms above and intend my typed name to serve as my
          legal signature.
        </span>
      </label>
      {actionError ? (
        <p
          style={{
            color: STATUS_COLORS.error,
            fontSize: `${bodyDefaults.fontSize}px`,
          }}
        >
          {actionError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          onClick={onSign}
          disabled={!canSign}
          style={{
            backgroundColor: actionStyle.color,
            color: getTextColor(actionStyle.color),
            borderRadius: actionStyle.radius,
            fontSize: `${bodyDefaults.fontSize}px`,
            fontWeight: 600,
          }}
          className="px-5 py-2.5 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-default hover:opacity-90 transition"
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
          className="border px-4 py-2.5 cursor-pointer hover:opacity-70"
          style={{
            color: mutedColor,
            borderRadius: actionStyle.radius,
            fontSize: `${bodyDefaults.fontSize}px`,
            fontWeight: 500,
            borderColor: branding.border_color,
          }}
        >
          {actionStyle.secondaryLabel ?? 'Decline'}
        </button>
      </div>
    </div>
  );
}
