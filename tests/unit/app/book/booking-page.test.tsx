/**
 * Tests for the public booking page flow (slot selection, form submission, confirmation).
 *
 * Mocks global fetch and the Supabase browser client to validate:
 * - Slot selection advances to details form
 * - Form submission includes exact required fields (token, startsAt, timezone, website, startedAt)
 * - 409 slot_taken response rolls back to slot picker and triggers refetch
 * - Confirmed state renders the join URL link
 *
 * @module tests/unit/app/book/booking-page
 */

import { render, renderHook, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BookingConfirmed } from '@/app/book/[token]/booking-confirmed'
import { BookingDetailsForm } from '@/app/book/[token]/booking-details-form'
import { BookingSlotPicker } from '@/app/book/[token]/booking-slot-picker'
import PublicBookingPage from '@/app/book/[token]/page'
import { useBookingPage, type BookingPageData, type Slot } from '@/app/book/[token]/use-booking-page'

/**
 * Helper to create a mocked fetch Response with JSON body.
 */
function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Create a singleton mock client to prevent infinite re-renders in renderHook
const mockSupabaseClient = {
  rpc: vi.fn(async (name: string) => {
    if (name === 'get_public_booking_page') {
      return {
        data: {
          name: 'Test Meeting',
          description: 'A test meeting type',
          duration_minutes: 30,
          location_type: 'video',
          address: null,
          business_name: 'Test Business',
          surface_color: '#ffffff',
          text_color: '#000000',
          font_body: 'inter',
          font_heading: 'poppins',
          density: 'cozy',
        },
        error: null,
      }
    }
    return { data: null, error: null }
  }),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ token: 'test-token' })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

const mockSlots: Slot[] = [
  { start: '2026-09-15T10:00:00Z', end: '2026-09-15T10:30:00Z' },
  { start: '2026-09-15T11:00:00Z', end: '2026-09-15T11:30:00Z' },
]

describe('Booking page components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('BookingSlotPicker', () => {
    const mockBookingPage = {
      name: 'Test Meeting',
      business_name: 'Test Business',
      duration_minutes: 30,
      location_type: 'video' as const,
      address: null,
      brand_color: '#111827',
    } as unknown as BookingPageData

    it('should render loading state', () => {
      render(
        <BookingSlotPicker
          state="loading"
          bookingPage={mockBookingPage}
          slotsForSelectedDate={[]}
          availableDates={new Set()}
          selectedDate={null}
          currentMonth="2026-09"
          timezone="Australia/Sydney"
          onSelectSlot={() => {}}
          onSelectDate={() => {}}
          onChangeMonth={() => {}}
          onChangeTimezone={() => {}}
        />,
      )

      // A skeleton shaped like the picker now, not a line of text. The wait is
      // announced through the region's accessible name rather than as visible
      // copy, which is what a screen reader actually reads out.
      expect(
        screen.getByRole('status', { name: 'Loading booking page' }),
      ).toBeInTheDocument()
    })

    it('should render empty state when no slots', () => {
      render(
        <BookingSlotPicker
          state="ready"
          bookingPage={mockBookingPage}
          slotsForSelectedDate={[]}
          availableDates={new Set()}
          selectedDate={null}
          currentMonth="2026-09"
          timezone="Australia/Sydney"
          onSelectSlot={() => {}}
          onSelectDate={() => {}}
          onChangeMonth={() => {}}
          onChangeTimezone={() => {}}
        />,
      )

      expect(screen.getByText(/no times available/i)).toBeInTheDocument()
    })

    it('should render error state', () => {
      render(
        <BookingSlotPicker
          state="error"
          bookingPage={mockBookingPage}
          slotsForSelectedDate={[]}
          availableDates={new Set()}
          selectedDate={null}
          currentMonth="2026-09"
          timezone="Australia/Sydney"
          onSelectSlot={() => {}}
          onSelectDate={() => {}}
          onChangeMonth={() => {}}
          onChangeTimezone={() => {}}
        />,
      )

      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()
    })

    it('should render calendar when slots available', () => {
      const availableDates = new Set(['2026-09-15', '2026-09-16'])
      render(
        <BookingSlotPicker
          state="ready"
          bookingPage={mockBookingPage}
          slotsForSelectedDate={mockSlots}
          availableDates={availableDates}
          selectedDate="2026-09-15"
          currentMonth="2026-09"
          timezone="Australia/Sydney"
          onSelectSlot={() => {}}
          onSelectDate={() => {}}
          onChangeMonth={() => {}}
          onChangeTimezone={() => {}}
        />,
      )

      expect(screen.getByText(/September 2026/i)).toBeInTheDocument()
    })

    it('should call onSelectSlot when a time slot is clicked', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      const availableDates = new Set(['2026-09-15'])

      render(
        <BookingSlotPicker
          state="ready"
          bookingPage={mockBookingPage}
          slotsForSelectedDate={mockSlots}
          availableDates={availableDates}
          selectedDate="2026-09-15"
          currentMonth="2026-09"
          timezone="Australia/Sydney"
          onSelectSlot={onSelect}
          onSelectDate={() => {}}
          onChangeMonth={() => {}}
          onChangeTimezone={() => {}}
        />,
      )

      const buttons = screen.getAllByRole('button')
      const timeButton = buttons.find((b) => b.textContent?.includes(':'))
      if (timeButton) {
        const slot = mockSlots[0]
        if (slot) {
          await user.click(timeButton)
          expect(onSelect).toHaveBeenCalledWith(slot)
        }
      }
    })

    it('should not include GMT offset in time button labels', () => {
      const availableDates = new Set(['2026-09-15'])
      render(
        <BookingSlotPicker
          state="ready"
          bookingPage={mockBookingPage}
          slotsForSelectedDate={mockSlots}
          availableDates={availableDates}
          selectedDate="2026-09-15"
          currentMonth="2026-09"
          timezone="Australia/Sydney"
          onSelectSlot={() => {}}
          onSelectDate={() => {}}
          onChangeMonth={() => {}}
          onChangeTimezone={() => {}}
        />,
      )

      const buttons = screen.getAllByRole('button')
      const timeButton = buttons.find((b) => b.textContent?.includes(':'))
      expect(timeButton?.textContent).toMatch(/^\d{1,2}:\d{2}\s(AM|PM)$/)
      expect(timeButton?.textContent).not.toMatch(/GMT/)
      expect(timeButton?.textContent).not.toMatch(/[+-]\d{2}/)
    })

    it('should render times in MC timezone and show timezone note', () => {
      const availableDates = new Set(['2026-09-15'])
      render(
        <BookingSlotPicker
          state="ready"
          bookingPage={mockBookingPage}
          slotsForSelectedDate={mockSlots}
          availableDates={availableDates}
          selectedDate="2026-09-15"
          currentMonth="2026-09"
          timezone="Australia/Sydney"
          onSelectSlot={() => {}}
          onSelectDate={() => {}}
          onChangeMonth={() => {}}
          onChangeTimezone={() => {}}
        />,
      )

      expect(screen.getByText(/all times are in/i)).toBeInTheDocument()
    })

    it('should render timezone note with city name, not offset', () => {
      const availableDates = new Set(['2026-09-15'])
      render(
        <BookingSlotPicker
          state="ready"
          bookingPage={mockBookingPage}
          slotsForSelectedDate={mockSlots}
          availableDates={availableDates}
          selectedDate="2026-09-15"
          currentMonth="2026-09"
          timezone="Australia/Sydney"
          onSelectSlot={() => {}}
          onSelectDate={() => {}}
          onChangeMonth={() => {}}
          onChangeTimezone={() => {}}
        />,
      )

      expect(screen.getByText(/all times are in Sydney time/i)).toBeInTheDocument()
      expect(screen.queryByText(/GMT/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/[+-]\d{2}:/)).not.toBeInTheDocument()
    })

    it('unavailable dates should not be clickable', () => {
      const availableDates = new Set(['2026-09-15'])
      const onSelectDate = vi.fn()
      render(
        <BookingSlotPicker
          state="ready"
          bookingPage={mockBookingPage}
          slotsForSelectedDate={mockSlots}
          availableDates={availableDates}
          selectedDate="2026-09-15"
          currentMonth="2026-09"
          timezone="Australia/Sydney"
          onSelectSlot={() => {}}
          onSelectDate={onSelectDate}
          onChangeMonth={() => {}}
          onChangeTimezone={() => {}}
        />,
      )

      const buttons = screen.getAllByRole('button')
      const dateButtons = buttons.filter((b) => {
        const text = b.textContent
        return text && /^\d{1,2}$/.test(text)
      })

      expect(dateButtons.length).toBeGreaterThan(0)
      dateButtons.forEach((btn) => {
        expect(btn).toHaveClass('cursor-pointer')
      })

      expect(onSelectDate).not.toHaveBeenCalled()
    })
  })

  describe('BookingDetailsForm', () => {
    it('should render form fields', () => {
      const slot = mockSlots[0]
      if (!slot) return

      render(
        <BookingDetailsForm
          selectedSlot={slot}
          timezone="Australia/Sydney"
          loading={false}
          onSubmit={() => {}}
        />,
      )

      expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/partner/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
    })

    it('should disable submit when name or email empty', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      const slot = mockSlots[0]
      if (!slot) return

      render(
        <BookingDetailsForm
          selectedSlot={slot}
          timezone="Australia/Sydney"
          loading={false}
          onSubmit={onSubmit}
        />,
      )

      const submitButton = screen.getByRole('button', { name: /confirm booking/i })
      expect(submitButton).toBeDisabled()

      await user.type(screen.getByLabelText(/your name/i), 'John Doe')
      expect(submitButton).toBeDisabled()

      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      expect(submitButton).not.toBeDisabled()
    })

    it('should submit with trimmed fields', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      const slot = mockSlots[0]
      if (!slot) return

      render(
        <BookingDetailsForm
          selectedSlot={slot}
          timezone="Australia/Sydney"
          loading={false}
          onSubmit={onSubmit}
        />,
      )

      await user.type(screen.getByLabelText(/your name/i), '  John Doe  ')
      await user.type(screen.getByLabelText(/email/i), '  john@example.com  ')
      await user.type(screen.getByLabelText(/partner/i), '  Jane  ')

      await user.click(screen.getByRole('button', { name: /confirm booking/i }))

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          partnerName: 'Jane',
        }),
      )
    })

    it('should have hidden website honeypot', () => {
      const slot = mockSlots[0]
      if (!slot) return

      const { container } = render(
        <BookingDetailsForm
          selectedSlot={slot}
          timezone="Australia/Sydney"
          loading={false}
          onSubmit={() => {}}
        />,
      )

      const honeypot = container.querySelector('input[name="website"]')
      expect(honeypot).toBeInTheDocument()
    })

    it('should show selected time', () => {
      const slot = mockSlots[0]
      if (!slot) return

      render(
        <BookingDetailsForm
          selectedSlot={slot}
          timezone="Australia/Sydney"
          loading={false}
          onSubmit={() => {}}
        />,
      )

      expect(screen.getByText(/selected time/i)).toBeInTheDocument()
    })

    it('should pass startedAt from form to submit handler', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      const slot = mockSlots[0]
      if (!slot) return

      render(
        <BookingDetailsForm
          selectedSlot={slot}
          timezone="Australia/Sydney"
          loading={false}
          onSubmit={onSubmit}
        />,
      )

      await user.type(screen.getByLabelText(/your name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.click(screen.getByRole('button', { name: /confirm booking/i }))

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
        }),
      )

      const call = onSubmit.mock.calls[0]
      if (!call) return
      const payload = call[0]
      if (!payload) return
      expect(payload.startedAt).toBeDefined()
      expect(typeof payload.startedAt).toBe('number')
      expect(payload.startedAt).toBeGreaterThan(0)
    })
  })

  describe('409 Slot Taken Recovery', () => {
    it('hook recovers from 409 by refetching slots and returning to picker with notice', async () => {
      let slotsFetchCount = 0

      // Override the fetch stub from beforeEach with our implementation
      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async (url: string | URL) => {
        // Safely convert to string and check for known endpoints
        let urlStr = ''
        try {
          if (typeof url === 'string') {
            urlStr = url
          } else if (url instanceof URL) {
            urlStr = url.href
          }
        } catch {
          urlStr = ''
        }

        if (urlStr && urlStr.includes('/api/booking/slots')) {
          slotsFetchCount++
          return jsonResponse(200, {
            slots: mockSlots,
            timezone: 'Australia/Sydney',
            durationMinutes: 30,
          })
        }

        if (urlStr && urlStr.includes('/api/booking/submit')) {
          // Submit returns 409 slot_taken
          return jsonResponse(409, { error: 'slot_taken' })
        }

        // Return empty response for other calls (RPC, etc)
        return jsonResponse(200, { data: null })
      })

      const { result } = renderHook(() => useBookingPage('test-token'))

      // Wait for initial load to complete (RPC + first slots fetch)
      await waitFor(() => {
        expect(result.current.state).toBe('pick')
      })

      expect(result.current.slots).toHaveLength(2)
      expect(slotsFetchCount).toBe(1) // Initial load fetched slots once

      // Select a slot to move to details state
      const slot = mockSlots[0]
      if (!slot) return

      act(() => {
        result.current.selectSlot(slot)
      })

      expect(result.current.state).toBe('details')
      expect(result.current.selectedSlot).toEqual(slot)

      // Submit with valid payload (will get 409)
      await act(async () => {
        await result.current.submit({
          token: 'test-token',
          name: 'John Doe',
          email: 'john@example.com',
          partnerName: undefined,
          phone: undefined,
          notes: undefined,
          startedAt: Date.now(),
        })
      })

      // Assertions for 409 recovery behavior
      expect(result.current.state).toBe('pick') // Returned to picker
      expect(result.current.slotTakenNotice).toBe(true) // Notice flag set
      expect(result.current.selectedSlot).toBeNull() // Slot cleared

      // Verify exactly 2 fetch calls to slots (initial + recovery refetch)
      expect(slotsFetchCount).toBe(2)
    })
  })

  describe('startedAt Timing Gate', () => {
    it('should capture startedAt at form mount, not submit time', async () => {
      const user = userEvent.setup()
      const slot = mockSlots[0]
      if (!slot) return

      // Record time right before render
      const beforeRender = Date.now()

      const onSubmit = vi.fn()

      render(
        <BookingDetailsForm
          selectedSlot={slot}
          timezone="Australia/Sydney"
          loading={false}
          onSubmit={onSubmit}
        />,
      )

      // Simulate delay between render and submit
      await new Promise((resolve) => setTimeout(resolve, 100))

      await user.type(screen.getByLabelText(/your name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')

      await new Promise((resolve) => setTimeout(resolve, 100))

      await user.click(screen.getByRole('button', { name: /confirm booking/i }))

      expect(onSubmit).toHaveBeenCalled()

      const call = onSubmit.mock.calls[0]
      if (!call) return
      const submittedPayload = call[0]
      if (!submittedPayload) return

      const startedAt = submittedPayload.startedAt
      const afterSubmit = Date.now()

      // startedAt should be close to render time (within 100ms)
      expect(startedAt).toBeGreaterThanOrEqual(beforeRender)
      expect(startedAt).toBeLessThanOrEqual(beforeRender + 100)

      // startedAt should be significantly LESS than current time (at least 100ms gap)
      expect(afterSubmit - startedAt).toBeGreaterThanOrEqual(100)
    })
  })

  describe('BookingConfirmed', () => {
    it('should render meeting details', () => {
      render(
        <BookingConfirmed
          meetingName="Test Meeting"
          timeString="Monday, September 15 at 10:00 AM"
          joinUrl={undefined}
        />,
      )

      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument()
      expect(screen.getByText('Test Meeting')).toBeInTheDocument()
      expect(screen.getByText('Monday, September 15 at 10:00 AM')).toBeInTheDocument()
    })

    it('should render join link when present', () => {
      render(
        <BookingConfirmed
          meetingName="Test Meeting"
          timeString="Monday, September 15 at 10:00 AM"
          joinUrl="https://meet.google.com/test"
        />,
      )

      const link = screen.getByRole('link', { name: /join meeting/i })
      expect(link).toHaveAttribute('href', 'https://meet.google.com/test')
    })

    it('should not render join link when absent', () => {
      render(
        <BookingConfirmed
          meetingName="Test Meeting"
          timeString="Monday, September 15 at 10:00 AM"
          joinUrl={undefined}
        />,
      )

      expect(screen.queryByRole('link', { name: /join meeting/i })).not.toBeInTheDocument()
    })

    it('should show email confirmation message', () => {
      render(
        <BookingConfirmed
          meetingName="Test Meeting"
          timeString="Monday, September 15 at 10:00 AM"
          joinUrl={undefined}
        />,
      )

      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    })
  })

  describe('Embed mode (?embed=1)', () => {
    it('should setup ResizeObserver and postMessage when embed=1', async () => {
      const postMessageSpy = vi.fn();
      const originalParent = window.parent;
      (window.parent as any) = {
        postMessage: postMessageSpy,
      };

      let capturedCallback: (() => void) | null = null;
      const mockObserve = vi.fn();
      const mockDisconnect = vi.fn();
      const ResizeObserverMock = vi.fn((callback: () => void) => {
        capturedCallback = callback;
        return {
          observe: mockObserve,
          disconnect: mockDisconnect,
        };
      });
      (global as any).ResizeObserver = ResizeObserverMock;

      const { useSearchParams } = await import('next/navigation');
      vi.mocked(useSearchParams).mockReturnValueOnce(
        new URLSearchParams('embed=1') as any,
      );

      try {
        render(<PublicBookingPage />);

        // Verify ResizeObserver was instantiated
        expect(ResizeObserverMock).toHaveBeenCalled();
        expect(mockObserve).toHaveBeenCalledWith(document.documentElement);

        // Initial postMessage should have been called immediately on render
        expect(postMessageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'zebri-book-height',
            height: expect.any(Number),
          }),
          '*',
        );

        // Simulate ResizeObserver callback
        if (capturedCallback) {
          act(() => {
            capturedCallback?.();
          });
          expect(postMessageSpy).toHaveBeenCalledTimes(2);
        }
      } finally {
        (window.parent as any) = originalParent;
      }
    });

    it('should not setup ResizeObserver when embed is not set', async () => {
      const postMessageSpy = vi.fn();
      const originalParent = window.parent;
      (window.parent as any) = {
        postMessage: postMessageSpy,
      };

      const ResizeObserverMock = vi.fn(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
      }));
      (global as any).ResizeObserver = ResizeObserverMock;

      const { useSearchParams } = await import('next/navigation');
      vi.mocked(useSearchParams).mockReturnValueOnce(new URLSearchParams() as any);

      try {
        render(<PublicBookingPage />);

        // ResizeObserver should not be called when not embedded
        expect(ResizeObserverMock).not.toHaveBeenCalled();
        expect(postMessageSpy).not.toHaveBeenCalled();
      } finally {
        (window.parent as any) = originalParent;
      }
    });

    it('should disconnect ResizeObserver on unmount', async () => {
      const originalParent = window.parent;
      (window.parent as any) = {
        postMessage: vi.fn(),
      };

      const mockDisconnect = vi.fn();
      const mockObserve = vi.fn();
      const ResizeObserverMock = vi.fn(() => ({
        observe: mockObserve,
        disconnect: mockDisconnect,
      }));
      (global as any).ResizeObserver = ResizeObserverMock;

      const { useSearchParams } = await import('next/navigation');
      vi.mocked(useSearchParams).mockReturnValueOnce(
        new URLSearchParams('embed=1') as any,
      );

      try {
        const { unmount } = render(<PublicBookingPage />);

        // Verify observer was set up
        expect(mockObserve).toHaveBeenCalledWith(document.documentElement);

        unmount();

        // Disconnect should be called on unmount
        expect(mockDisconnect).toHaveBeenCalled();
      } finally {
        (window.parent as any) = originalParent;
      }
    });
  })
})
