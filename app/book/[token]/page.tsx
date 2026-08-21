/**
 * Public booking page - orchestrator.
 *
 * Reached via the share-token URL (`/book/<token>`). Loads the
 * `get_public_booking_page(token)` RPC payload, applies the MC's branding, and renders
 * the 3-step booking flow (slot picker, details form, confirmation), or an unavailable card.
 * `?embed=1` strips the page chrome for iframe use (Task 9).
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
  DENSITY_PAD,
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
import { useBookingPage } from './use-booking-page'

export default function PublicBookingPage() {
  const params = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const embed = searchParams.get('embed') === '1'
  const token = params.token

  const {
    state,
    bookingPage,
    slotsForSelectedDate,
    selectedSlot,
    selectedDate,
    currentMonth,
    availableDates,
    timezone,
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
      className={embed ? 'px-4 py-6' : `min-h-screen ${pad.page} px-4`}
      style={{
        background: embed ? 'transparent' : pageBg,
        color: textColor,
        fontFamily: bodyStack,
      }}
    >
      <div className="max-w-6xl mx-auto">
        {state === 'loading' && <LoadingView />}

        {state === 'pick' && bookingPage && (
          <PickView
            bookingPage={bookingPage}
            slotsForSelectedDate={slotsForSelectedDate}
            availableDates={availableDates}
            selectedDate={selectedDate}
            currentMonth={currentMonth}
            timezone={timezone}
            slotTakenNotice={slotTakenNotice}
            error={error}
            slotsLoading={slotsLoading}
            onSelectSlot={selectSlot}
            onSelectDate={selectDate}
            onChangeMonth={changeMonth}
            onChangeTimezone={changeTimezone}
            {...viewProps}
          />
        )}

        {state === 'details' && bookingPage && selectedSlot && (
          <DetailsView
            bookingPage={bookingPage}
            selectedSlot={selectedSlot}
            timezone={timezone}
            submitting={submitting}
            onGoBack={goBackToSlots}
            onSubmit={(payload) =>
              submit({
                token,
                ...payload,
              })
            }
          />
        )}

        {state === 'confirmed' && bookingPage && confirmation && (
          <ConfirmedView bookingPage={bookingPage} confirmation={confirmation} />
        )}
      </div>
    </div>
  )
}
