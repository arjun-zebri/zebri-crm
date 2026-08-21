/**
 * Confirmation dialog for cancelling a booking.
 *
 * Hand-rolled branded dialog for public surfaces (mirrors Phase C idiom).
 * Requires explicit confirmation before irreversible cancel action.
 *
 * @module app/book/manage/[manage_token]/confirm-cancel-dialog
 */

import { Button } from '@/components/ui/button'

import type { ManageBooking } from './use-manage-booking'

interface ConfirmCancelDialogProps {
  open: boolean
  booking: ManageBooking
  submitting: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation dialog for cancelling a booking.
 * Shows the booker's email to confirm cancellation intent.
 */
export function ConfirmCancelDialog({
  open,
  booking,
  submitting,
  error,
  onConfirm,
  onCancel,
}: ConfirmCancelDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50">
      <div className="bg-surface rounded-control p-6 max-w-sm w-full">
        <h2 className="text-xl font-semibold text-text mb-2">Cancel Booking?</h2>
        <p className="text-sm text-text-muted mb-6">
          This action cannot be undone. A cancellation email will be sent to {booking.email}.
        </p>

        {error && <p className="text-sm text-danger mb-4">{error}</p>}

        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            disabled={submitting}
            variant="secondary"
            className="flex-1"
          >
            Keep Booking
          </Button>
          <Button
            onClick={onConfirm}
            disabled={submitting}
            variant="danger"
            className="flex-1"
          >
            {submitting ? 'Cancelling...' : 'Cancel Booking'}
          </Button>
        </div>
      </div>
    </div>
  )
}
