'use client';

import { Button } from './button';
import { OVERLAY_Z, useBackdropDismiss, useOverlay } from './use-overlay';

/**
 * Destructive-action confirmation.
 *
 * Deliberately headerless: no title bar and no close X, so the only ways
 * out are the two explicit choices or Escape. A confirmation should make
 * you answer the question rather than offer a third, ambiguous exit.
 *
 * Behaviour (Escape, body-scroll lock, backdrop dismissal) comes from
 * {@link useOverlay}, the same hook Modal and SidePanel use, so the three
 * surfaces cannot drift apart again.
 *
 * Renders on the `top` layer: a confirmation raised from a modal must sit
 * above it, including above a nested modal.
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   open={confirming}
 *   title="Delete this couple?"
 *   description="This removes the couple, their events and their tasks."
 *   onConfirm={remove}
 *   onCancel={() => setConfirming(false)}
 *   loading={deleting}
 * />
 * ```
 *
 * @module components/ui/confirm-dialog
 */

export interface ConfirmDialogProps {
  /** Whether the dialog is showing. */
  open: boolean;
  /** The question, phrased so the confirm button answers it. */
  title: string;
  /** What will actually happen. Spell out anything irreversible. */
  description: string;
  /** Runs the destructive action. */
  onConfirm: () => void;
  /** Dismisses without acting. Also fired by Escape and backdrop click. */
  onCancel: () => void;
  /** Disables both buttons and swaps the confirm label while in flight. */
  loading?: boolean;
  /** Confirm button label. Defaults to `'Delete'`. */
  confirmLabel?: string;
  /** Confirm label while `loading`. Defaults to `'Deleting...'`. */
  loadingLabel?: string;
}

export function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  loading,
  confirmLabel = 'Delete',
  loadingLabel = 'Deleting...',
}: ConfirmDialogProps) {
  useOverlay({ isOpen: open, onClose: onCancel });
  const backdropHandlers = useBackdropDismiss(onCancel);

  if (!open) return null;

  // `aria-labelledby`/`describedby` rather than a visible heading element
  // being announced twice: the h2 below IS the accessible name.
  const titleId = 'confirm-dialog-title';
  const descId = 'confirm-dialog-description';

  return (
    <>
      <div
        className={`fixed inset-0 h-screen bg-black/40 animate-fade-in ${OVERLAY_Z.top.backdrop}`}
        {...backdropHandlers}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`fixed inset-0 flex items-center justify-center p-4 ${OVERLAY_Z.top.panel}`}
        {...backdropHandlers}
      >
        <div className="w-full max-w-sm rounded-control border border-border bg-surface shadow-xl animate-modal-in">
          <div className="px-6 py-6">
            <h2 id={titleId} className="mb-2 text-body font-semibold text-text">
              {title}
            </h2>
            <p id={descId} className="mb-6 text-body text-text-muted">
              {description}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={onConfirm}
                loading={loading ?? false}
                className="flex-1"
              >
                {loading ? loadingLabel : confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
