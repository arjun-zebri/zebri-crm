/**
 * View components for the public manage booking page.
 *
 * Extracted state-specific renders to keep the orchestrator compact.
 *
 * @module app/book/manage/[manage_token]/manage-views
 */

import { Button } from '@/components/ui/button'

import { LegacySlotPicker } from './legacy-slot-picker'
import type { ManageBooking, Slot } from './use-manage-booking'

interface ViewProps {
  pageBg: string
  textColor: string
  bodyStack: string | undefined
  padPage: string
}

/**
 * Loading state view.
 */
export function LoadingView() {
  return <p className="text-sm text-text-muted py-10 text-center">Loading...</p>
}

/**
 * Error state view with retry button.
 */
export function ErrorView({ error, padPage, pageBg, textColor, bodyStack }: ViewProps & { error: string }) {
  return (
    <div
      className={`min-h-screen ${padPage} px-4`}
      style={{
        background: pageBg,
        color: textColor,
        fontFamily: bodyStack,
      }}
    >
      <div className="max-w-lg mx-auto py-10">
        <div className="bg-surface-muted rounded-control p-6 text-center">
          <p className="text-sm text-danger mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="ghost">
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Not found state view.
 */
export function NotFoundView({ padPage, pageBg, textColor, bodyStack }: ViewProps) {
  return (
    <div
      className={`min-h-screen ${padPage} px-4`}
      style={{
        background: pageBg,
        color: textColor,
        fontFamily: bodyStack,
      }}
    >
      <div className="max-w-lg mx-auto py-10">
        <div className="bg-surface-muted rounded-control p-6 text-center">
          <p className="text-sm text-text-muted">
            This booking link is not available. Please check the URL or contact the business.
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Format a datetime as local time in booking timezone.
 * E.g. "Monday, September 20 at 10:00 AM AEDT"
 */
function formatBookingTime(isoString: string, timezone: string): string {
  const date = new Date(isoString)
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
    timeZoneName: 'short',
  })
  return formatter.format(date)
}

interface ActiveViewProps extends ViewProps {
  booking: ManageBooking
  onReschedule: () => void
  onCancel: () => void
}

/**
 * Active booking view with meeting details and action buttons.
 */
export function ActiveView({
  booking,
  onReschedule,
  onCancel,
  textColor,
  bodyStack,
  padPage,
  pageBg,
}: ActiveViewProps) {
  const timeString = formatBookingTime(booking.starts_at, booking.timezone)

  return (
    <div
      className={`min-h-screen ${padPage} px-4`}
      style={{
        background: pageBg,
        color: textColor,
        fontFamily: bodyStack,
      }}
    >
      <div className="max-w-lg mx-auto py-8">
        <h1 className="text-3xl font-semibold mb-6 text-text">{booking.business_name}</h1>

        <div className="bg-surface-muted rounded-control p-6 mb-6">
          <p className="text-sm text-text-muted mb-2">Meeting Type</p>
          <p className="text-base font-medium text-text mb-6">{booking.meeting_type.name}</p>

          <p className="text-sm text-text-muted mb-2">Scheduled Time</p>
          <p className="text-base font-medium text-text mb-6">{timeString}</p>

          {booking.video_join_url && (
            <>
              <p className="text-sm text-text-muted mb-2">Join Meeting</p>
              <a
                href={booking.video_join_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-fg hover:opacity-80 cursor-pointer mb-6 block"
              >
                Join video call
              </a>
            </>
          )}
        </div>

        <div className="space-y-3">
          <Button onClick={onReschedule} className="w-full">
            Reschedule
          </Button>
          <Button onClick={onCancel} variant="secondary" className="w-full">
            Cancel Booking
          </Button>
        </div>
      </div>
    </div>
  )
}

interface CancelledViewProps extends ViewProps {
  booking?: ManageBooking
}

/**
 * Booking cancelled confirmation view.
 */
export function CancelledView({ textColor, bodyStack, padPage, pageBg }: CancelledViewProps) {
  return (
    <div
      className={`min-h-screen ${padPage} px-4`}
      style={{
        background: pageBg,
        color: textColor,
        fontFamily: bodyStack,
      }}
    >
      <div className="max-w-lg mx-auto py-10">
        <div className="bg-surface-muted rounded-control p-6 text-center">
          <p className="text-sm font-medium text-text mb-2">Booking Cancelled</p>
          <p className="text-sm text-text-muted">
            Your booking has been cancelled. A confirmation email has been sent.
          </p>
        </div>
      </div>
    </div>
  )
}

interface RescheduledViewProps extends ViewProps {
  booking?: ManageBooking
}

/**
 * Booking rescheduled confirmation view.
 */
export function RescheduledView({ textColor, bodyStack, padPage, pageBg }: RescheduledViewProps) {
  return (
    <div
      className={`min-h-screen ${padPage} px-4`}
      style={{
        background: pageBg,
        color: textColor,
        fontFamily: bodyStack,
      }}
    >
      <div className="max-w-lg mx-auto py-10">
        <div className="bg-surface-muted rounded-control p-6 text-center">
          <p className="text-sm font-medium text-text mb-2">Booking Rescheduled</p>
          <p className="text-sm text-text-muted">
            Your booking has been rescheduled. Check your email for the updated confirmation.
          </p>
        </div>
      </div>
    </div>
  )
}

interface PickNewTimeViewProps extends ViewProps {
  booking: ManageBooking
  slots: Array<{ start: string; end: string }>
  timezone: string
  currentFrom: string
  currentTo: string
  slotTakenNotice: boolean
  error: string | null
  onSelectSlot: (slot: Slot) => void
  onLoadPreviousFortnight: () => void
  onLoadNextFortnight: () => void
  onGoBack: () => void
}

/**
 * Slot picker view for rescheduling.
 */
export function PickNewTimeView({
  booking,
  slots,
  timezone,
  currentFrom,
  currentTo,
  slotTakenNotice,
  error,
  onSelectSlot,
  onLoadPreviousFortnight,
  onLoadNextFortnight,
  onGoBack,
  textColor,
  bodyStack,
  padPage,
  pageBg,
}: PickNewTimeViewProps) {
  return (
    <div
      className={`min-h-screen ${padPage} px-4`}
      style={{
        background: pageBg,
        color: textColor,
        fontFamily: bodyStack,
      }}
    >
      <div className="max-w-lg mx-auto py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button onClick={onGoBack} variant="ghost">
            Back
          </Button>
          <h1 className="text-3xl font-semibold text-text">{booking.business_name}</h1>
        </div>

        <p className="text-sm text-text-muted mb-6">Pick a new time for your meeting</p>

        {slotTakenNotice && (
          <div className="mb-4 p-3 bg-warning rounded-control">
            <p className="text-sm text-text">That time was just taken. Please choose another time.</p>
          </div>
        )}

        <LegacySlotPicker
          state={error ? 'error' : 'ready'}
          slots={slots}
          timezone={timezone}
          currentFrom={currentFrom}
          currentTo={currentTo}
          onSelectSlot={onSelectSlot}
          onLoadPreviousFortnight={onLoadPreviousFortnight}
          onLoadNextFortnight={onLoadNextFortnight}
        />
      </div>
    </div>
  )
}
