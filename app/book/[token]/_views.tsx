/**
 * View components for the public booking page.
 *
 * Extracted state-specific renders to keep the orchestrator compact.
 *
 * @module app/book/[token]/_views
 */

import { BookingConfirmed } from './booking-confirmed'
import { BookingDetailsForm } from './booking-details-form'
import { BookingPageSkeleton } from './booking-skeleton'
import { BookingSlotPicker } from './booking-slot-picker'
import type { BookingPageData } from './use-booking-page'

interface ViewProps {
  pageBg: string
  textColor: string
  bodyStack: string | undefined
  padPage: string
}

/**
 * Loading state view.
 *
 * A skeleton shaped like the picker rather than a line of text: this is a
 * couple's first impression of the MC, and a centred "Loading..." both reads
 * as unfinished and reflows the entire page when the data lands.
 */
export function LoadingView() {
  return <BookingPageSkeleton />
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
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-brand-fg hover:opacity-80 cursor-pointer"
          >
            Try again
          </button>
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

interface PickViewProps extends ViewProps {
  bookingPage: BookingPageData
  slotsForSelectedDate: Array<{ start: string; end: string }>
  availableDates: Set<string>
  selectedDate: string | null
  currentMonth: string
  timezone: string
  slotTakenNotice: boolean
  error: string | null
  /** True while a slot query is in flight, including month paging. */
  slotsLoading: boolean
  onSelectSlot: (slot: { start: string; end: string }) => void
  onSelectDate: (date: string) => void
  onChangeMonth: (yearMonth: string) => void
  /** Called with the booker's chosen zone from the timezone control. */
  onChangeTimezone: (timezone: string) => void
}

/**
 * Slot picker view (step 1).
 */
export function PickView({
  bookingPage,
  slotsForSelectedDate,
  availableDates,
  selectedDate,
  currentMonth,
  timezone,
  slotTakenNotice,
  error,
  slotsLoading,
  onSelectSlot,
  onSelectDate,
  onChangeMonth,
  onChangeTimezone,
}: PickViewProps) {
  return (
    <div className="py-8">
      {slotTakenNotice && (
        <div className="mb-4 p-3 bg-warning rounded-control">
          <p className="text-sm text-text">That time was just taken. Please choose another time.</p>
        </div>
      )}

      <BookingSlotPicker
        state={error ? 'error' : 'ready'}
        slotsLoading={slotsLoading}
        bookingPage={bookingPage}
        slotsForSelectedDate={slotsForSelectedDate}
        availableDates={availableDates}
        selectedDate={selectedDate}
        currentMonth={currentMonth}
        timezone={timezone}
        onSelectSlot={onSelectSlot}
        onSelectDate={onSelectDate}
        onChangeMonth={onChangeMonth}
        onChangeTimezone={onChangeTimezone}
      />
    </div>
  )
}

interface DetailsViewProps {
  bookingPage: BookingPageData
  selectedSlot: { start: string; end: string }
  timezone: string
  submitting: boolean
  onGoBack: () => void
  onSubmit: (payload: {
    name: string
    partnerName: string | undefined
    email: string
    phone: string | undefined
    notes: string | undefined
    startedAt: number
  }) => void
}

/**
 * Details form view (step 2).
 */
export function DetailsView({
  bookingPage,
  selectedSlot,
  timezone,
  submitting,
  onGoBack,
  onSubmit,
}: DetailsViewProps) {
  return (
    <div className="py-8">
      <div className="mb-6 flex items-center">
        <button onClick={onGoBack} className="mr-3 text-text hover:text-text-muted cursor-pointer">
          ← Back
        </button>
        <h1 className="text-2xl font-semibold text-text">{bookingPage.business_name}</h1>
      </div>

      <p className="text-sm text-text-muted mb-6">Confirm your booking details</p>

      <BookingDetailsForm
        selectedSlot={selectedSlot}
        timezone={timezone}
        loading={submitting}
        onSubmit={onSubmit}
      />
    </div>
  )
}

interface ConfirmedViewProps {
  bookingPage: BookingPageData
  confirmation: { start: string; timezone: string; joinUrl?: string | null }
}

/**
 * Format a datetime as local time string for display.
 */
function formatConfirmationTime(isoString: string, timezone: string): string {
  const date = new Date(isoString)
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  })
  return formatter.format(date)
}

/**
 * Confirmation view (step 3).
 */
export function ConfirmedView({ bookingPage, confirmation }: ConfirmedViewProps) {
  return (
    <div className="py-8">
      <BookingConfirmed
        meetingName={bookingPage.name}
        timeString={formatConfirmationTime(confirmation.start, confirmation.timezone)}
        joinUrl={confirmation.joinUrl === null ? undefined : (confirmation.joinUrl ?? undefined)}
      />
    </div>
  )
}
