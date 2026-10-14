/**
 * Tests for the public booking page flow (slot selection, form submission, confirmation).
 *
 * Mocks global fetch and the Supabase browser client to validate:
 * - 409 slot_taken response rolls back to slot picker and triggers refetch
 * - The picker's loading, empty, error and listing states
 * - Embed mode reports height to the host
 *
 * The details form and the confirmation are covered in their own files:
 * booking-details-form.test.tsx and booking-confirmed.test.tsx.
 *
 * @module tests/unit/app/book/booking-page
 */

import { render, renderHook, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

    const base = {
      bookingPage: mockBookingPage,
      slotsForSelectedDate: [] as Slot[],
      availableDates: new Set<string>(),
      selectedDate: null as string | null,
      currentMonth: '2026-09',
      timezone: 'Australia/Sydney',
      locale: 'en-AU',
      onSelectSlot: () => {},
      onSelectDate: () => {},
      onChangeMonth: () => {},
      onChangeTimezone: () => {},
    }

    it('should render loading state', () => {
      render(<BookingSlotPicker {...base} state="loading" />)

      // A skeleton shaped like the picker now, not a line of text.
      expect(screen.getByRole('status', { name: 'Loading booking page' })).toBeInTheDocument()
    })

    it('should render empty state when no slots', () => {
      render(<BookingSlotPicker {...base} state="ready" />)

      expect(screen.getByText(/no times available/i)).toBeInTheDocument()
    })

    it('should render error state', () => {
      render(<BookingSlotPicker {...base} state="error" />)

      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()
    })

    it('does not claim the period is empty while slots are still loading', () => {
      render(<BookingSlotPicker {...base} state="ready" slotsLoading />)

      expect(screen.queryByText(/no times available/i)).not.toBeInTheDocument()
      expect(screen.getByRole('status', { name: 'Loading booking page' })).toBeInTheDocument()
    })

    it('should render the calendar and the day\'s times when slots are available', () => {
      render(
        <BookingSlotPicker
          {...base}
          state="ready"
          availableDates={new Set(['2026-09-15'])}
          selectedDate="2026-09-15"
          slotsForSelectedDate={mockSlots}
        />,
      )

      expect(screen.getByText(/September 2026/i)).toBeInTheDocument()
      // 20:00 and 21:00 in Sydney on this date, the mock slots' instants.
      expect(screen.getByRole('button', { name: '8:00pm' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '9:00pm' })).toBeInTheDocument()
    })

    it('should call onSelectSlot when a time is clicked', async () => {
      const user = userEvent.setup()
      const onSelectSlot = vi.fn()
      render(
        <BookingSlotPicker
          {...base}
          state="ready"
          availableDates={new Set(['2026-09-15'])}
          selectedDate="2026-09-15"
          slotsForSelectedDate={mockSlots}
          onSelectSlot={onSelectSlot}
        />,
      )

      await user.click(screen.getByRole('button', { name: '9:00pm' }))

      expect(onSelectSlot).toHaveBeenCalledWith(mockSlots[1])
    })

    it('shows the day in full with the zone the times belong to', () => {
      render(
        <BookingSlotPicker
          {...base}
          state="ready"
          availableDates={new Set(['2026-09-15'])}
          selectedDate="2026-09-15"
          slotsForSelectedDate={mockSlots}
        />,
      )

      expect(screen.getByText('Tuesday 15 September')).toBeInTheDocument()
      expect(screen.getByText(/all times are in sydney time/i)).toBeInTheDocument()
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
          phone: undefined,
          notes: undefined,
          answers: [],
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
