/**
 * Decline confirmation dialog for the public contract surface.
 *
 * Couples can optionally leave a reason; an empty reason is fine
 * (the API treats `''` as "no reason given"). Submitting closes
 * the dialog and triggers a re-load of the contract row.
 *
 * @module app/contract/[token]/_components/contract-decline-dialog
 */
import { Loader2, X } from 'lucide-react';

import { getRgb } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { STATUS_COLORS } from '@/lib/branding/status-colors';
import { roleDefaults } from '@/lib/branding/type-defaults';

/**
 * Confirmation dialog for declining a contract.
 *
 * @param open - Whether the dialog is visible
 * @param onCancel - Callback when user clicks Cancel
 * @param onConfirm - Callback when user confirms decline
 * @param reason - Text in the reason field
 * @param onReasonChange - Callback when reason text changes
 * @param loading - Whether confirmation is in progress
 * @param error - Error message if confirmation failed
 * @param businessName - MC's business name (used in explainer copy)
 * @param textColor - Primary text color (inline style)
 * @param mutedColor - Secondary/muted text color (inline style)
 * @param branding - MC's branding configuration
 */
export interface ContractDeclineDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  reason: string;
  onReasonChange: (next: string) => void;
  loading: boolean;
  error: string | null;
  businessName?: string | null | undefined;
  textColor: string;
  mutedColor: string;
  branding: PublicBranding;
}

export function ContractDeclineDialog({
  open,
  onCancel,
  onConfirm,
  reason,
  onReasonChange,
  loading,
  error,
  businessName,
  textColor,
  mutedColor,
  branding,
}: ContractDeclineDialogProps) {
  if (!open) return null;

  const headingDefaults = roleDefaults(branding, 'sectionHeading');
  const bodyDefaults = roleDefaults(branding, 'body');

  // Faint wash on the Cancel button, composited from the brand text colour
  // rather than a Zebri app-chrome token.
  const textRgb = getRgb(branding.text_color);
  const cancelBackground = textRgb
    ? `rgba(${textRgb[0]}, ${textRgb[1]}, ${textRgb[2]}, 0.02)`
    : 'transparent';

  return (
    <>
      <div
        className="fixed inset-0 z-[70]"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div
          className="border max-w-sm w-full"
          style={{
            backgroundColor: branding.surface_color,
            borderRadius: branding.corner_radius,
            borderColor: branding.border_color,
          }}
        >
          <div className="px-6 py-6">
            <h3
              className="mb-2 font-semibold"
              style={{
                color: textColor,
                fontFamily: FONT_STACKS[headingDefaults.fontFamily as never],
                fontSize: `${headingDefaults.fontSize}px`,
              }}
            >
              Decline this contract?
            </h3>
            <p
              className="mb-4"
              style={{
                color: mutedColor,
                fontSize: `${bodyDefaults.fontSize}px`,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              Let {htmlToPlainText(businessName ?? '') || 'your MC'} know why,
              or leave blank.
            </p>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              placeholder="Reason (optional)"
              className="w-full border px-3 py-2 focus:outline-none mb-4"
              style={{
                color: textColor,
                fontSize: `${bodyDefaults.fontSize}px`,
                borderRadius: branding.corner_radius,
                borderColor: branding.border_color,
              }}
            />
            {error ? (
              <p
                className="mb-3"
                style={{
                  color: STATUS_COLORS.error,
                  fontSize: `${bodyDefaults.fontSize}px`,
                }}
              >
                {error}
              </p>
            ) : null}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 px-4 py-2 border cursor-pointer disabled:opacity-50 hover:opacity-70"
                style={{
                  color: textColor,
                  fontSize: `${bodyDefaults.fontSize}px`,
                  borderRadius: branding.corner_radius,
                  borderColor: branding.border_color,
                  backgroundColor: cancelBackground,
                }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 px-4 py-2 text-white cursor-pointer disabled:opacity-50 hover:opacity-90 inline-flex items-center justify-center gap-1.5"
                style={{
                  fontSize: `${bodyDefaults.fontSize}px`,
                  borderRadius: branding.corner_radius,
                  backgroundColor: STATUS_COLORS.error,
                }}
              >
                {loading ? (
                  <Loader2
                    size={13}
                    className="animate-spin"
                    strokeWidth={1.5}
                  />
                ) : (
                  <X size={13} strokeWidth={2} />
                )}
                Decline
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
