/**
 * The one card every step of the booking page is drawn inside.
 *
 * The left column is the {@link BookingSummary}, rendered once. The right
 * column is whatever step is showing, keyed on the step so it fades and slides
 * in when the step changes while the summary stays where it is. On a phone the
 * columns stack, and the summary can pin to the top as a bar.
 *
 * @module app/book/[token]/booking-shell
 */
'use client'

import type { ReactNode } from 'react'

import { headingFontFamily } from '@/lib/branding/public-surface'

import { bookingCardStyle } from './booking-brand'
import { BookingSummary, type SummaryWhen } from './booking-summary'
import type { BookingPageData } from './use-booking-page'

export type BookingStep = 'pick' | 'details' | 'confirmed';

export interface BookingShellProps {
  bookingPage: BookingPageData;
  step: BookingStep;
  when: SummaryWhen | null;
  timezone: string;
  mcTimezone: string;
  locale: string;
  onChangeTime: () => void;
  children: ReactNode;
}

/** The card: summary on the left, the current step on the right. */
export function BookingShell({
  bookingPage,
  step,
  when,
  timezone,
  mcTimezone,
  locale,
  onChangeTime,
  children,
}: BookingShellProps) {
  // Once a time is chosen the summary is a sticky bar on a phone, so the
  // details form scrolls under a line that says what the booker picked.
  const collapsed = step !== 'pick' && when !== null;
  // The picker needs the width for a calendar beside a column of times; the
  // form and confirmation do not, and in a wide card they leave a dead strip
  // on the right. The card narrows instead, so the form fills its column.

  return (
    <section
      style={bookingCardStyle(bookingPage.brand_color, headingFontFamily(bookingPage))}
      className={`mx-auto w-full bg-card max-md:min-h-screen md:rounded-control md:border md:border-border md:shadow-sm transition-[max-width] duration-300 ease-out ${
        step === 'pick' ? 'max-w-5xl' : 'max-w-4xl'
      }`}
    >
      <div className="grid md:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={`border-b border-border p-5 md:border-b-0 md:border-r md:p-8${
            collapsed ? ' max-md:sticky max-md:top-0 max-md:z-20 max-md:bg-card max-md:py-3' : ''
          }`}
        >
          <BookingSummary
            bookingPage={bookingPage}
            when={when}
            timezone={timezone}
            mcTimezone={mcTimezone}
            locale={locale}
            step={step}
            collapsed={collapsed}
            onChangeTime={onChangeTime}
          />
        </aside>
        <div className="min-w-0 p-5 md:p-8">
          <div
            key={step}
            className="motion-safe:animate-[step-in_300ms_cubic-bezier(0.2,0.7,0.2,1)_both]"
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
