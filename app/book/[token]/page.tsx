/**
 * Public booking page - orchestrator.
 *
 * Reached via the share-token URL (`/book/<token>`). Loads the
 * `get_public_booking_page(token)` payload, applies the MC's branding, and
 * renders the three-step flow (pick a time, details, confirmed) inside one
 * shell, or an unavailable card. `?embed=1` drops the page background for
 * iframe use and reports its height to the host.
 *
 * Client component for immediate render then RPC-fetch UX (matches lead page idiom).
 *
 * @module app/book/[token]/page
 */

'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

import {
  bodyFontFamily,
  useBrandingHead,
  type Density,
} from '@/lib/branding/public-surface'


import {
  ConfirmedView,
  DetailsView,
  ErrorView,
  LoadingView,
  NotFoundView,
  PickView,
} from './_views'
import { BookingShell, type BookingStep } from './booking-shell'
import { useBookerLocale } from './use-booker-locale'
import { useBookingPage } from './use-booking-page'

/** Only the three steps render inside the shell. */
function shellStep(state: string): BookingStep | null {
  return state === 'pick' || state === 'details' || state === 'confirmed' ? state : null;
}

/**
 * Top and bottom breathing room around the card, desktop only: on a phone the
 * card runs edge to edge, and padding around it just pushes the calendar down.
 * Written out per density because Tailwind cannot see a prefixed class built
 * from a variable.
 */
const PAGE_PAD_MD: Record<Density, string> = {
  compact: 'md:py-8',
  cozy: 'md:py-12',
  roomy: 'md:py-16',
}

export default function PublicBookingPage() {
  const params = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const embed = searchParams.get('embed') === '1'
  const token = params.token
  const locale = useBookerLocale()

  const {
    state,
    bookingPage,
    slotsForSelectedDate,
    selectedSlot,
    selectedDate,
    currentMonth,
    availableDates,
    timezone,
    mcTimezone,
    questions,
    phoneField,
    slotTakenNotice,
    confirmation,
    error,
    submitting,
    slotsLoading,
    selectSlot,
    selectDate,
    changeMonth,
    changeTimezone,
    goBackToSlots,
    submit,
  } = useBookingPage(token)

  useBrandingHead(bookingPage)

  // Report height to a host page when embedded, so book-embed.js can resize.
  useEffect(() => {
    if (!embed) return;
    const report = () =>
      window.parent?.postMessage(
        { type: 'zebri-book-height', height: document.documentElement.scrollHeight },
        '*',
      );
    report();
    const ro = new ResizeObserver(report);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [embed, state])

  const pageBg = bookingPage?.surface_color || '#fafafa'
  const textColor = bookingPage?.text_color || '#111827'
  const bodyStack = bookingPage ? bodyFontFamily(bookingPage) : undefined
  const density = (bookingPage?.density ?? 'cozy') as Density

  const step = shellStep(state)
  // After confirmation the selected slot is cleared, so the summary reads the
  // confirmed slot and the zone it was booked in instead.
  const when = state === 'confirmed' && confirmation
    ? { start: confirmation.start, end: confirmation.end }
    : selectedSlot
  const whenZone = state === 'confirmed' && confirmation ? confirmation.timezone : timezone

  return (
    <div
      className={embed ? 'md:px-4 md:py-6' : `min-h-screen md:px-4 ${PAGE_PAD_MD[density]}`}
      style={{
        background: embed ? 'transparent' : pageBg,
        color: textColor,
        fontFamily: bodyStack,
      }}
    >
      {state === 'notFound' && <NotFoundView />}

      {state === 'error' && error && <ErrorView error={error} />}

      {state === 'loading' && <div className="mx-auto max-w-5xl"><LoadingView /></div>}

      {step && bookingPage && (
        <BookingShell
          bookingPage={bookingPage}
          step={step}
          when={when}
          timezone={whenZone}
          mcTimezone={mcTimezone}
          locale={locale}
          onChangeTime={goBackToSlots}
        >
          {step === 'pick' && (
            <PickView
              slotsForSelectedDate={slotsForSelectedDate}
              availableDates={availableDates}
              selectedDate={selectedDate}
              currentMonth={currentMonth}
              timezone={timezone}
              locale={locale}
              slotTakenNotice={slotTakenNotice}
              error={error}
              slotsLoading={slotsLoading}
              onSelectSlot={selectSlot}
              onSelectDate={selectDate}
              onChangeMonth={changeMonth}
              onChangeTimezone={changeTimezone}
            />
          )}

          {step === 'details' && selectedSlot && (
            <DetailsView
              questions={questions}
              phoneField={phoneField}
              submitting={submitting}
              onGoBack={goBackToSlots}
              onSubmit={(payload) => submit({ token, ...payload })}
            />
          )}

          {step === 'confirmed' && confirmation && (
            <ConfirmedView bookingPage={bookingPage} confirmation={confirmation} />
          )}
        </BookingShell>
      )}
    </div>
  )
}
