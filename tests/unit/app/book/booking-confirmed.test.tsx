/**
 * The confirmation step: where the meeting happens, the booker's email, and
 * the add-to-calendar options.
 *
 * @module tests/unit/app/book/booking-confirmed
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BookingConfirmed, type BookingConfirmedProps } from '@/app/book/[token]/booking-confirmed'

const base: BookingConfirmedProps = {
  meetingName: 'Consultation',
  businessName: 'Lemon Weddings',
  start: '2026-10-14T01:00:00Z',
  end: '2026-10-14T01:30:00Z',
  email: 'alice@example.com',
  locationType: 'video',
  address: null,
  joinUrl: 'https://meet.example.test/abc',
}

describe('BookingConfirmed', () => {
  it('confirms the booking and names the email the details went to', () => {
    render(<BookingConfirmed {...base} />)

    expect(screen.getByRole('heading', { name: "You're booked" })).toBeInTheDocument()
    expect(screen.getByText(/sent the details to alice@example.com/i)).toBeInTheDocument()
  })

  it('links the join meeting button when a join URL exists', () => {
    render(<BookingConfirmed {...base} />)

    expect(screen.getByRole('link', { name: 'Join meeting' })).toHaveAttribute('href', base.joinUrl)
  })

  it('says the link is in the email when a video booking has no join URL', () => {
    render(<BookingConfirmed {...base} joinUrl={undefined} />)

    expect(screen.queryByRole('link', { name: 'Join meeting' })).not.toBeInTheDocument()
    expect(screen.getByText(/video link is in the confirmation email/i)).toBeInTheDocument()
  })

  it('shows the address for an in-person meeting', () => {
    render(
      <BookingConfirmed
        {...base}
        locationType="in_person"
        address="12 Harbour St, Sydney"
        joinUrl={undefined}
      />,
    )

    expect(screen.getByText('12 Harbour St, Sydney')).toBeInTheDocument()
  })

  it('says it will call for a phone meeting', () => {
    render(<BookingConfirmed {...base} locationType="phone" joinUrl={undefined} />)

    expect(screen.getByText(/we'll call you/i)).toBeInTheDocument()
  })

  it('offers Google, Outlook and an .ics download', () => {
    render(<BookingConfirmed {...base} />)

    const google = screen.getByRole('link', { name: 'Google' })
    expect(google.getAttribute('href')).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/)
    const outlook = screen.getByRole('link', { name: 'Outlook' })
    expect(outlook.getAttribute('href')).toMatch(/^https:\/\/outlook\.live\.com\//)
    expect(screen.getByRole('button', { name: /apple or other/i })).toBeInTheDocument()
  })
})
