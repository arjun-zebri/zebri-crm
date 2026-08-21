import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import * as bookingActions from '@/app/(dashboard)/calendar/booking-actions'
import { BookingDetailPanel } from '@/app/(dashboard)/calendar/booking-detail-panel'
import type { Booking } from '@/app/(dashboard)/calendar/use-bookings'

// Mock booking actions
vi.mock('@/app/(dashboard)/calendar/booking-actions')

// Mock toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock React Query's useQueryClient
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  }
})

const mockBooking: Booking = {
  id: 'booking-123',
  name: 'John Smith',
  email: 'john@example.com',
  partner_name: null,
  phone: '0412345678',
  starts_at: '2026-08-20T14:00:00Z',
  ends_at: '2026-08-20T14:30:00Z',
  status: 'confirmed',
  notes: 'Looking forward to the consultation',
  video_join_url: null,
  external_event_ids: null,
  created_at: '2026-08-01T00:00:00Z',
  timezone: 'Australia/Melbourne',
  couple: { id: 'couple-1', name: 'John & Jane Smith' },
  meeting_type: { id: 'mt-1', name: 'Initial Consultation', location_type: 'in_person', duration_minutes: 30 },
}

const mockCancelledBooking: Booking = {
  ...mockBooking,
  status: 'cancelled',
}

describe('BookingDetailPanel', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  it('renders booking details including name, meeting type, and time', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    expect(screen.getByTestId('booking-name')).toHaveTextContent('John Smith')
    expect(screen.getByTestId('booking-meeting-type')).toHaveTextContent('Initial Consultation')
    expect(screen.getByTestId('booking-time')).toHaveTextContent('Aug 2026')
  })

  it('offers the video join link when the booking has one', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={{ ...mockBooking, video_join_url: 'https://meet.google.com/abc-defg-hij' }}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    const link = screen.getByTestId('booking-join-link')
    expect(link).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij')
    // Opening a third-party call in a new tab must not hand it a window
    // reference or a referrer back into the CRM.
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('shows no join link for a booking without one', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    expect(screen.queryByTestId('booking-join-link')).not.toBeInTheDocument()
  })

  it('hides the join link once the booking is cancelled', () => {
    // The Meet room is torn down with the calendar event, so offering the link
    // would send the MC to a dead call.
    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={{
            ...mockCancelledBooking,
            video_join_url: 'https://meet.google.com/abc-defg-hij',
          }}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    expect(screen.queryByTestId('booking-join-link')).not.toBeInTheDocument()
  })

  it('requires confirmation before cancelling', async () => {
    ;(bookingActions.cancelBookingAction as any).mockResolvedValue({ ok: true, data: {} })

    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={onClose}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    // Click Cancel button (the action button at footer)
    const cancelButton = screen.getByRole('button', { name: /cancel booking/i })
    await user.click(cancelButton)

    // Confirm dialog should appear
    expect(screen.getByText(/booker will be notified/)).toBeInTheDocument()

    // Confirm the action - find the "Cancel" button in the dialog (last one)
    const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i })
    const confirmButton = cancelButtons[cancelButtons.length - 1]
    if (!confirmButton) throw new Error('Confirm button not found')
    await user.click(confirmButton)

    await waitFor(() => {
      expect(bookingActions.cancelBookingAction).toHaveBeenCalledWith('booking-123')
    })
  })

  it('keeps panel open and shows error on failed cancel', async () => {
    const errorMsg = 'Cannot cancel past booking'
    ;(bookingActions.cancelBookingAction as any).mockResolvedValue({
      ok: false,
      error: errorMsg,
    })

    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={onClose}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    const cancelButton = screen.getByRole('button', { name: /cancel booking/i })
    await user.click(cancelButton)

    const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i })
    const confirmButton = cancelButtons[cancelButtons.length - 1]
    if (!confirmButton) throw new Error('Confirm button not found')
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders reschedule form with date and time controls', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    const rescheduleButton = screen.getByRole('button', { name: /reschedule/i })
    await user.click(rescheduleButton)

    expect(screen.getByLabelText('Date')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-08-21')).toBeInTheDocument()
  })

  it('composes correct ISO instant from date and time in MC timezone', async () => {
    ;(bookingActions.rescheduleBookingAction as any).mockResolvedValue({
      ok: true,
      data: { start: '2026-08-25T05:00:00Z', end: '2026-08-25T05:30:00Z', timezone: 'Australia/Melbourne' },
    })

    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    const rescheduleButton = screen.getByRole('button', { name: /reschedule/i })
    await user.click(rescheduleButton)

    const dateInput = screen.getByLabelText('Date') as HTMLInputElement
    await user.clear(dateInput)
    await user.type(dateInput, '2026-08-25')

    const confirmButton = screen.getByRole('button', { name: /confirm reschedule/i })
    await user.click(confirmButton)

    await waitFor(() => {
      const calls = (bookingActions.rescheduleBookingAction as any).mock.calls
      expect(calls[0][0]).toBe('booking-123')
      const passedInstant = calls[0][1]
      const passedTimezone = calls[0][2]
      expect(passedTimezone).toBe('Australia/Melbourne')
      // Verify it's a valid ISO string
      expect(new Date(passedInstant).toISOString()).toBe(passedInstant)
    })
  })

  it('renders no action buttons for cancelled booking', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={mockCancelledBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    expect(screen.queryByText('Cancel Booking')).not.toBeInTheDocument()
    expect(screen.queryByText('Reschedule')).not.toBeInTheDocument()
  })


  it('leads with the meeting title, its full span, and the countdown', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    expect(screen.getByTestId('booking-meeting-type')).toHaveTextContent(
      'Initial Consultation with John Smith'
    )
    // Melbourne is UTC+10 in August: 14:00Z is midnight on the 21st. Date,
    // span and meeting shape are one muted meta line under the title.
    expect(screen.getByTestId('booking-time')).toHaveTextContent(
      'Fri 21 Aug 2026 · 12:00am–12:30am AEST · 30 min · in person'
    )
    expect(screen.getByText(/^(Starts|Ended|Happening)/)).toBeInTheDocument()
  })

  it('shows when the booking came in and where from', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    expect(screen.getByText('1 Aug, via booking link')).toBeInTheDocument()
  })

  it('opens the couple profile from the couple name when a handler is given', async () => {
    const onSelectCouple = vi.fn()
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
          onSelectCouple={onSelectCouple}
        />
      </QueryClientProvider>
    )

    await user.click(screen.getByRole('button', { name: 'John & Jane Smith' }))
    expect(onSelectCouple).toHaveBeenCalledWith('couple-1')
  })

  it('does not offer an add-to-calendar action, since the booking is already pushed', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    expect(screen.queryByRole('button', { name: 'Add to calendar' })).not.toBeInTheDocument()
  })

  it('renders the booker note under its own heading', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BookingDetailPanel
          isOpen={true}
          onClose={vi.fn()}
          booking={mockBooking}
          mcTimezone="Australia/Melbourne"
        />
      </QueryClientProvider>
    )

    expect(screen.getByText('Their note')).toBeInTheDocument()
    expect(screen.getByText('Looking forward to the consultation')).toBeInTheDocument()
  })
})
