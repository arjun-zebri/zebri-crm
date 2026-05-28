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

import { htmlToPlainText } from '@/lib/branding/sanitize';

export interface ContractDeclineDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  reason: string;
  onReasonChange: (next: string) => void;
  loading: boolean;
  error: string | null;
  /** Used in the explainer line. */
  businessName?: string | null | undefined;
  /** Inline-style branding values. */
  textColor: string;
  mutedColor: string;
  headingStack?: string | undefined;
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
  headingStack,
}: ContractDeclineDialogProps) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[70]"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="bg-surface rounded-card border border-border max-w-sm w-full">
          <div className="px-6 py-6">
            <h3
              className="text-base font-semibold mb-2"
              style={{ color: textColor, fontFamily: headingStack }}
            >
              Decline this contract?
            </h3>
            <p className="text-sm mb-4" style={{ color: mutedColor }}>
              Let {htmlToPlainText(businessName ?? '') || 'your MC'} know why,
              or leave blank.
            </p>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              placeholder="Reason (optional)"
              className="w-full text-sm border border-border rounded-control px-3 py-2 focus:outline-none focus:border-border-strong mb-4"
              style={{ color: textColor }}
            />
            {error ? (
              <p className="text-sm text-danger mb-3">{error}</p>
            ) : null}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-control hover:bg-surface-muted cursor-pointer disabled:opacity-50"
                style={{ color: textColor }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm bg-danger text-white rounded-control hover:opacity-90 cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
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
