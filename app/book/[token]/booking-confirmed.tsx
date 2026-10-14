/**
 * The confirmation step's content: a drawn tick, the booker's email, where the
 * meeting happens, and add-to-calendar. The time itself lives in the summary
 * column, so it is not repeated here.
 *
 * @module app/book/[token]/booking-confirmed
 */
'use client'

import { buttonClassName } from '@/components/ui/button'
import type { CalendarEvent } from '@/lib/booking/calendar-links'

import { BookingAddToCalendar } from './booking-add-to-calendar'
import { HEADING_STYLE } from './booking-brand'

export interface BookingConfirmedProps {
  meetingName: string;
  businessName: string | null;
  start: string;
  end: string;
  email: string;
  locationType: 'video' | 'phone' | 'in_person';
  address: string | null;
  /** The join link, when the meeting type is video and one was issued. */
  joinUrl: string | undefined;
}

/** Where the meeting happens, in the words the booker needs next. */
function WhereLine({ locationType, address, joinUrl }: Pick<BookingConfirmedProps, 'locationType' | 'address' | 'joinUrl'>) {
  if (locationType === 'video') {
    if (joinUrl) {
      return (
        <a href={joinUrl} rel="noopener noreferrer" target="_blank" className={buttonClassName({ variant: 'primary' })}>
          Join meeting
        </a>
      );
    }
    return <p className="text-body text-text-muted">Your video link is in the confirmation email.</p>;
  }
  if (locationType === 'phone') {
    return <p className="text-body text-text-muted">We&apos;ll call you at the number you gave us.</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-body font-medium text-text">Where</p>
      <p className="text-body text-text-muted">{address?.trim() || 'We will confirm the address by email.'}</p>
    </div>
  );
}

/** The confirmed state's content, drawn into the shell's right column. */
export function BookingConfirmed(props: BookingConfirmedProps) {
  const { meetingName, businessName, start, end, email, locationType, address, joinUrl } = props;

  const event: CalendarEvent = {
    title: businessName ? `${meetingName} with ${businessName}` : meetingName,
    start,
    end,
    location: locationType === 'in_person' ? (address ?? undefined) : (joinUrl ?? undefined),
    url: joinUrl ?? undefined,
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <span className="flex size-10 items-center justify-center rounded-pill bg-brand-fg/10 text-brand-fg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray={24} className="motion-safe:animate-[tick-draw_400ms_cubic-bezier(0.65,0,0.35,1)_150ms_both]" />
          </svg>
        </span>
        <h2 style={HEADING_STYLE} className="text-display font-semibold text-text">
          You&apos;re booked
        </h2>
        <p className="text-body text-text-muted">We&apos;ve sent the details to {email}.</p>
      </div>

      <WhereLine locationType={locationType} address={address} joinUrl={joinUrl} />

      <BookingAddToCalendar event={event} />
    </div>
  )
}
