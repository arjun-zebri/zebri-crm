/**
 * Public manage booking page - orchestrator.
 *
 * Reached via the manage-token URL (`/book/manage/<token>`). Loads the
 * `get_booking_by_manage_token(token)` RPC payload, applies the MC's branding, and renders
 * the manage flow (active booking summary with reschedule/cancel actions, or unavailable card).
 *
 * Client component for immediate render then RPC-fetch UX.
 *
 * @module app/book/manage/[manage_token]/page
 */

'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

import {
  bodyFontFamily,
  DENSITY_PAD,
  useBrandingHead,
  type Density,
} from '@/lib/branding/public-surface'

import { ConfirmCancelDialog } from './confirm-cancel-dialog'
import {
  ActiveView,
  CancelledView,
  ErrorView,
  LoadingView,
  NotFoundView,
  PickNewTimeView,
  RescheduledView,
} from './manage-views'
import { useManageBooking } from './use-manage-booking'

export default function PublicManageBookingPage() {
  const params = useParams<{ manage_token: string }>()
  const manageToken = params.manage_token

  const {
    state,
    booking,
    slots,
    timezone,
    slotTakenNotice,
    error,
    currentFrom,
    currentTo,
    submitting,
    openCancelConfirm,
    closeCancelConfirm,
    confirmCancel,
    openReschedule,
    closeReschedule,
    selectNewSlot,
    submitReschedule,
    loadNextFortnight,
    loadPreviousFortnight,
  } = useManageBooking(manageToken)

  useBrandingHead(booking)

  // Trigger reschedule submission when state transitions to rescheduling
  useEffect(() => {
    if (state === 'rescheduling') {
      void submitReschedule()
    }
  }, [state, submitReschedule])

  const pageBg = booking?.surface_color || '#fafafa'
  const textColor = booking?.text_color || '#111827'
  const bodyStack = booking ? bodyFontFamily(booking) : undefined
  const density = (booking?.density ?? 'cozy') as Density
  const pad = DENSITY_PAD[density]
  const viewProps = { pageBg, textColor, bodyStack, padPage: pad.page }

  if (state === 'notFound') {
    return <NotFoundView {...viewProps} />
  }

  if (state === 'error' && error) {
    return <ErrorView {...viewProps} error={error} />
  }

  return (
    <div
      className={`min-h-screen px-4 ${pad.page}`}
      style={{
        background: pageBg,
        color: textColor,
        fontFamily: bodyStack,
      }}
    >
      <div className="max-w-lg mx-auto">
        {state === 'loading' && <LoadingView />}

        {state === 'active' && booking && (
          <ActiveView
            booking={booking}
            onReschedule={openReschedule}
            onCancel={openCancelConfirm}
            {...viewProps}
          />
        )}

        {state === 'cancelled' && <CancelledView {...viewProps} />}

        {state === 'rescheduled' && <RescheduledView {...viewProps} />}

        {(state === 'pickNewTime' || state === 'rescheduling') && booking && (
          <PickNewTimeView
            booking={booking}
            slots={slots}
            timezone={timezone}
            currentFrom={currentFrom}
            currentTo={currentTo}
            slotTakenNotice={slotTakenNotice}
            error={error}
            onSelectSlot={selectNewSlot}
            onLoadPreviousFortnight={loadPreviousFortnight}
            onLoadNextFortnight={loadNextFortnight}
            onGoBack={closeReschedule}
            {...viewProps}
          />
        )}
      </div>

      {booking && (
        <ConfirmCancelDialog
          open={state === 'confirmCancel'}
          booking={booking}
          submitting={submitting}
          error={error}
          onConfirm={confirmCancel}
          onCancel={closeCancelConfirm}
        />
      )}
    </div>
  )
}
