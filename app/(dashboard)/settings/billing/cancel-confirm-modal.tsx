/**
 * Cancel-subscription confirmation modal.
 *
 * Shared by the "Cancel subscription" text link on the current plan
 * card AND the "Cancel" button in the Starter column of the plan
 * comparison modal: both go through the same confirmation step so
 * the user always sees the grace-period end date before committing.
 *
 * Lives in the parent `BillingSection` so both children can trigger
 * it via `onRequestCancel`.
 *
 * @module app/(dashboard)/settings/billing/cancel-confirm-modal
 */
'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

import { formatDate } from './plans';

export interface CancelConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  subscriptionEnd: string | null;
}

export function CancelConfirmModal({
  open,
  onClose,
  onConfirm,
  busy,
  subscriptionEnd,
}: CancelConfirmModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Cancel subscription?"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>
            Keep subscription
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            Yes, cancel
          </Button>
        </div>
      }
    >
      <p className="text-body text-text">
        You&apos;ll keep access to Pro features
        {subscriptionEnd ? (
          <>
            {' '}
            until <strong>{formatDate(subscriptionEnd)}</strong>
          </>
        ) : (
          ' until the end of your current billing period'
        )}
        , then drop to the free Starter plan.
      </p>
      <p className="mt-3 text-body text-text-muted">
        You can resubscribe any time before then to undo the cancellation.
      </p>
    </Modal>
  );
}
