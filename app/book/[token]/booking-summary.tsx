/**
 * The persistent left-hand summary of the booking card.
 *
 * It renders once, in the shell, and never remounts between steps, so the MC's
 * logo and the meeting details stay put while the right column changes. Once a
 * time is chosen it also carries that time in large type. On a phone during the
 * details and confirmation steps the whole block collapses to one sticky line.
 *
 * @module app/book/[token]/booking-summary
 */
'use client'

import { Clock, MapPin, Phone, Video } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatBookingDate, formatMcHint, formatSummaryWhen, formatTimeRange } from '@/lib/booking/format-time'

import { HEADING_STYLE } from './booking-brand'
import type { BookingPageData } from './use-booking-page'

/** The slot the summary describes. */
export interface SummaryWhen {
  start: string;
  end: string;
}

export interface BookingSummaryProps {
  bookingPage: BookingPageData;
  /** The chosen or confirmed slot. Null on the pick step before a time is chosen. */
  when: SummaryWhen | null;
  /** The zone the times are shown in. */
  timezone: string;
  /** The MC's zone, for the "that's 9:30am in Sydney" hint. */
  mcTimezone: string;
  locale: string;
  /** Which step the card is on. Drives the label and the Change link. */
  step: 'pick' | 'details' | 'confirmed';
  /** Collapse to the sticky bar on phones. True once a time is chosen. */
  collapsed: boolean;
  /** Returns the booker to the calendar to pick a different time. */
  onChangeTime: () => void;
}

/** Location line for the meeting type: an address for in person, else the call type. */
function locationLine(bookingPage: BookingPageData): { icon: 'video' | 'phone' | 'pin'; text: string } {
  if (bookingPage.location_type === 'video') return { icon: 'video', text: 'Video call' };
  if (bookingPage.location_type === 'phone') return { icon: 'phone', text: 'Phone call' };
  return { icon: 'pin', text: bookingPage.address?.trim() || 'In person' };
}

/** The summary column. See the module docs for the collapse behaviour. */
export function BookingSummary({
  bookingPage,
  when,
  timezone,
  mcTimezone,
  locale,
  step,
  collapsed,
  onChangeTime,
}: BookingSummaryProps) {
  const location = locationLine(bookingPage);
  const LocationIcon = location.icon === 'video' ? Video : location.icon === 'phone' ? Phone : MapPin;
  const hint = when ? formatMcHint(when.start, timezone, mcTimezone, locale) : null;
  const businessName = bookingPage.business_name?.trim() || null;

  return (
    <>
      <div className={collapsed ? 'space-y-4 max-md:hidden md:space-y-6' : 'space-y-4 md:space-y-6'}>
        <div className="space-y-2 md:space-y-3">
          {/* Logo and business name share a line on a phone, so the meeting
              name and the calendar are not pushed below the fold. */}
          <div className="flex items-center gap-3 md:block md:space-y-3">
          {bookingPage.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- MC-uploaded logo on a public page; no optimiser loader is configured for arbitrary hosts.
            <img
              src={bookingPage.logo_url}
              alt={businessName ?? ''}
              className="h-8 w-auto max-w-32 object-contain object-left md:h-10 md:max-w-40"
            />
          ) : null}
          {businessName ? <p className="text-body text-text-muted">{businessName}</p> : null}
          </div>
          <h1 style={HEADING_STYLE} className="text-section font-semibold text-text">
            {bookingPage.name}
          </h1>
          {bookingPage.description ? (
            <p className="whitespace-pre-line text-body text-text-muted">{bookingPage.description}</p>
          ) : null}
        </div>

        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-body text-text md:block md:space-y-2">
          <li className="flex items-center gap-2">
            <Clock size={16} strokeWidth={1.5} className="shrink-0 text-text-muted" aria-hidden="true" />
            <span>{bookingPage.duration_minutes} min</span>
          </li>
          <li className="flex items-start gap-2">
            <LocationIcon size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
            <span>{location.text}</span>
          </li>
        </ul>

        {when ? (
          <div className="space-y-2 border-t border-border pt-5">
            <p className="text-body text-text-muted">
              {step === 'confirmed' ? 'Scheduled for' : 'Selected time'}
            </p>
            <p className="text-body font-semibold text-text">
              {formatBookingDate(when.start, timezone, locale)}
            </p>
            <p className="text-body text-text">
              {formatTimeRange(when.start, when.end, timezone, locale)}
            </p>
            {hint ? <p className="text-body text-text-muted">{hint}</p> : null}
            {step === 'details' ? (
              <Button variant="ghost" onClick={onChangeTime} className="-ml-3">
                Change
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {collapsed && when ? (
        <div className="hidden items-center justify-between gap-3 max-md:flex">
          <p className="text-body font-semibold text-text">{formatSummaryWhen(when.start, timezone, locale)}</p>
          <Button variant="ghost" onClick={onChangeTime} aria-label="Change time">
            Change
          </Button>
        </div>
      ) : null}
    </>
  );
}
