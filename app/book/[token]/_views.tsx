/**
 * View components for the public booking page.
 *
 * Each step's content, plus the loading, error and not-found states. The page
 * owns the outer frame and the card shell; these render what goes inside them.
 *
 * @module app/book/[token]/_views
 */

import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { BookingQuestion, PhoneFieldMode } from '@/lib/booking/questions'

import { HEADING_STYLE } from './booking-brand'
import { BookingConfirmed } from './booking-confirmed'
import { BookingDetailsForm } from './booking-details-form'
import { BookingPageSkeleton } from './booking-skeleton'
import { BookingSlotPicker } from './booking-slot-picker'
import type { SubmitPayload, SubmitResult, Slot } from './use-booking-page'
import type { BookingPageData } from './use-booking-page'

/** The card every non-loading state sits in when there is no shell. */
const STATUS_CARD = 'max-md:m-4 mx-auto max-w-lg rounded-control border border-border bg-card p-6 text-center shadow-sm'

/** Loading state: a skeleton shaped like the picker, so the layout does not jump when data lands. */
export function LoadingView() {
  return <BookingPageSkeleton />
}

/** Error state with a way back. */
export function ErrorView({ error }: { error: string }) {
  return (
    <div className={STATUS_CARD}>
      <p className="text-body text-danger">{error}</p>
      <div className="mt-4 flex justify-center">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    </div>
  )
}

/** The link is dead or was never valid. Says so without blaming the couple. */
export function NotFoundView() {
  return (
    <div className={STATUS_CARD}>
      <p className="text-body text-text-muted">
        This booking link is not available. Please check the URL or contact the business.
      </p>
    </div>
  )
}

interface PickViewProps {
  slotsForSelectedDate: Slot[]
  availableDates: Set<string>
  selectedDate: string | null
  currentMonth: string
  timezone: string
  locale: string
  slotTakenNotice: boolean
  error: string | null
  /** True while a slot query is in flight, including month paging. */
  slotsLoading: boolean
  onSelectSlot: (slot: Slot) => void
  onSelectDate: (date: string) => void
  onChangeMonth: (yearMonth: string) => void
  /** Called with the booker's chosen zone from the timezone control. */
  onChangeTimezone: (timezone: string) => void
}

/** Pick step (content only; the summary is in the shell). */
export function PickView({
  slotsForSelectedDate,
  availableDates,
  selectedDate,
  currentMonth,
  timezone,
  locale,
  slotTakenNotice,
  error,
  slotsLoading,
  onSelectSlot,
  onSelectDate,
  onChangeMonth,
  onChangeTimezone,
}: PickViewProps) {
  return (
    <div className="space-y-6">
      {slotTakenNotice && (
        <div role="status" className="rounded-control bg-warning/15 p-3">
          <p className="text-body text-text">That time was just taken. Please choose another time.</p>
        </div>
      )}
      <BookingSlotPicker
        state={error ? 'error' : 'ready'}
        slotsLoading={slotsLoading}
        slotsForSelectedDate={slotsForSelectedDate}
        availableDates={availableDates}
        selectedDate={selectedDate}
        currentMonth={currentMonth}
        timezone={timezone}
        locale={locale}
        onSelectSlot={onSelectSlot}
        onSelectDate={onSelectDate}
        onChangeMonth={onChangeMonth}
        onChangeTimezone={onChangeTimezone}
      />
    </div>
  )
}

interface DetailsViewProps {
  questions: BookingQuestion[]
  phoneField: PhoneFieldMode
  submitting: boolean
  /** The chosen time in one line, shown under the submit button. */
  onGoBack: () => void
  onSubmit: (payload: Omit<SubmitPayload, 'token'>) => Promise<SubmitResult>
}

/** Details step: a quiet Back, the heading, and the form. */
export function DetailsView({ questions, phoneField, submitting, onGoBack, onSubmit }: DetailsViewProps) {
  return (
    <div>
      <Button variant="ghost" onClick={onGoBack} className="-ml-3">
        <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        Back
      </Button>
      <h2 style={HEADING_STYLE} className="mt-4 text-display font-semibold text-text">
        Almost there
      </h2>
      <p className="mt-1 text-body text-text-muted">Tell us a little about you.</p>
      <BookingDetailsForm
        questions={questions}
        phoneField={phoneField}
        loading={submitting}
        onSubmit={onSubmit}
      />
    </div>
  )
}

interface ConfirmedViewProps {
  bookingPage: BookingPageData
  confirmation: { start: string; end: string; email: string; joinUrl?: string | null }
}

/** Confirmation step (content only). */
export function ConfirmedView({ bookingPage, confirmation }: ConfirmedViewProps) {
  return (
    <BookingConfirmed
      meetingName={bookingPage.name}
      businessName={bookingPage.business_name?.trim() || null}
      start={confirmation.start}
      end={confirmation.end}
      email={confirmation.email}
      locationType={bookingPage.location_type}
      address={bookingPage.address}
      joinUrl={confirmation.joinUrl ?? undefined}
    />
  )
}
