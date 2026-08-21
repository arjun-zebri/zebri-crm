/**
 * Booking confirmation screen for the public booking page.
 *
 * Shows meeting name, local time, join URL (when present), and "check your email" message.
 *
 * @module app/book/[token]/booking-confirmed
 */

'use client'

interface BookingConfirmedProps {
  meetingName: string
  timeString: string
  joinUrl: string | undefined
}

/**
 * Renders the success state after a booking is confirmed. Shows the
 * meeting details and a link to join (if video meeting with a join URL).
 */
export function BookingConfirmed({ meetingName, timeString, joinUrl }: BookingConfirmedProps) {
  return (
    <div className="text-center py-10 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text mb-2">Booking confirmed</h2>
        <p className="text-sm text-text-muted">
          Thank you for booking a consultation with us.
        </p>
      </div>

      <div className="bg-surface-muted rounded-control p-4 space-y-3">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Meeting type</p>
          <p className="text-sm font-semibold text-text">{meetingName}</p>
        </div>

        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Scheduled for</p>
          <p className="text-sm font-semibold text-text">{timeString}</p>
        </div>

        {joinUrl && (
          <div className="pt-2">
            <a
              href={joinUrl}
              rel="noopener noreferrer"
              target="_blank"
              className="inline-block px-4 py-2 rounded-control bg-brand-fg text-brand-bg text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Join meeting
            </a>
          </div>
        )}
      </div>

      <p className="text-sm text-text-muted">
        A confirmation email has been sent to your inbox. Check your email for all the details.
      </p>
    </div>
  )
}
