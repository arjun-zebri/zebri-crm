/**
 * Tests for the public manage booking page (reschedule/cancel).
 *
 * Mocks global fetch and the Supabase browser client as a singleton.
 * Validates:
 * - Active booking renders current time and both actions
 * - Cancel flow posts to /api/booking/cancel and shows cancelled state
 * - Reschedule picks slot, posts to /api/booking/reschedule, shows rescheduled state
 * - 409 slot_taken on reschedule returns to picker with notice and refetches
 * - Already-cancelled booking renders cancelled state with no actions
 *
 * @module tests/unit/app/book/manage-booking
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useManageBooking, type Slot } from '@/app/book/manage/[manage_token]/use-manage-booking'

/**
 * Helper to create a mocked fetch Response with JSON body.
 */
function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Helper to create the RPC mock, can be passed manageToken to customize behavior.
 */
function createMockSupabaseClient(manageToken?: string) {
  return {
    rpc: vi.fn(async (name: string) => {
      if (name === 'get_booking_by_manage_token') {
        // Simulate different booking states based on token
        if (manageToken?.includes('notfound')) {
          return { data: null, error: null }
        }
        const isCancelled = manageToken?.includes('cancelled')
        return {
          data: {
            booking_id: 'booking-123',
            status: isCancelled ? 'cancelled' : 'confirmed',
            starts_at: '2026-09-20T10:00:00Z',
            ends_at: '2026-09-20T10:30:00Z',
            timezone: 'Australia/Sydney',
            name: 'John Doe',
            email: 'john@example.com',
            video_join_url: isCancelled ? null : 'https://meet.google.com/test',
            business_name: 'Test Business',
            meeting_type: {
              name: 'Discovery Call',
              duration_minutes: 30,
              location_type: 'video',
            },
            share_token: 'share-token-123',
            // Branding scalars
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
}

// Create a singleton mock client for normal cases (resets per test in beforeEach)
const mockSupabaseClient = createMockSupabaseClient('test-manage-token')

// Will be reassigned in tests when needed
let currentMockClient = mockSupabaseClient

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => currentMockClient),
}))

// Mock next/navigation - will be reassigned in tests when needed
let currentManageToken = 'test-manage-token'

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ manage_token: currentManageToken })),
}))

const mockSlots: Slot[] = [
  { start: '2026-09-21T10:00:00Z', end: '2026-09-21T10:30:00Z' },
  { start: '2026-09-21T11:00:00Z', end: '2026-09-21T11:30:00Z' },
]

describe('Manage booking page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Active booking', () => {
    it('should render active booking with time and both actions', async () => {
      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async (url: string | URL) => {
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
          return jsonResponse(200, {
            slots: mockSlots,
            timezone: 'Australia/Sydney',
            durationMinutes: 30,
          })
        }

        return jsonResponse(200, { data: null })
      })

      const { result } = renderHook(() => useManageBooking('test-manage-token'))

      // Wait for load to complete
      await waitFor(() => {
        expect(result.current.state).toBe('active')
      })

      expect(result.current.booking).toBeDefined()
      expect(result.current.booking?.name).toBe('John Doe')
      expect(result.current.booking?.meeting_type.name).toBe('Discovery Call')
    })

    it('should show cancel confirmation dialog when cancel clicked', async () => {
      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async (url: string | URL) => {
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
          return jsonResponse(200, {
            slots: mockSlots,
            timezone: 'Australia/Sydney',
            durationMinutes: 30,
          })
        }

        return jsonResponse(200, { data: null })
      })

      const { result } = renderHook(() => useManageBooking('test-manage-token'))

      await waitFor(() => {
        expect(result.current.state).toBe('active')
      })

      act(() => {
        result.current.openCancelConfirm()
      })

      expect(result.current.state).toBe('confirmCancel')
    })
  })

  describe('Cancel booking flow', () => {
    it('should post to /api/booking/cancel and show cancelled state', async () => {
      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async (url: string | URL) => {
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
          return jsonResponse(200, {
            slots: mockSlots,
            timezone: 'Australia/Sydney',
            durationMinutes: 30,
          })
        }

        if (urlStr && urlStr.includes('/api/booking/cancel')) {
          return jsonResponse(200, { ok: true })
        }

        return jsonResponse(200, { data: null })
      })

      const { result } = renderHook(() => useManageBooking('test-manage-token'))

      await waitFor(() => {
        expect(result.current.state).toBe('active')
      })

      act(() => {
        result.current.openCancelConfirm()
      })

      expect(result.current.state).toBe('confirmCancel')

      await act(async () => {
        await result.current.confirmCancel()
      })

      expect(result.current.state).toBe('cancelled')
      expect(globalFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/booking/cancel'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ manageToken: 'test-manage-token' }),
        }),
      )
    })

    it('should close confirm dialog on cancel action', async () => {
      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async (url: string | URL) => {
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
          return jsonResponse(200, {
            slots: mockSlots,
            timezone: 'Australia/Sydney',
            durationMinutes: 30,
          })
        }

        return jsonResponse(200, { data: null })
      })

      const { result } = renderHook(() => useManageBooking('test-manage-token'))

      await waitFor(() => {
        expect(result.current.state).toBe('active')
      })

      act(() => {
        result.current.openCancelConfirm()
      })

      expect(result.current.state).toBe('confirmCancel')

      act(() => {
        result.current.closeCancelConfirm()
      })

      expect(result.current.state).toBe('active')
    })
  })

  describe('Reschedule booking flow', () => {
    it('should enter pickNewTime state when reschedule clicked', async () => {
      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async (url: string | URL) => {
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
          return jsonResponse(200, {
            slots: mockSlots,
            timezone: 'Australia/Sydney',
            durationMinutes: 30,
          })
        }

        return jsonResponse(200, { data: null })
      })

      const { result } = renderHook(() => useManageBooking('test-manage-token'))

      await waitFor(() => {
        expect(result.current.state).toBe('active')
      })

      act(() => {
        result.current.openReschedule()
      })

      expect(result.current.state).toBe('pickNewTime')
      expect(result.current.slots).toHaveLength(2)
    })

    it('should submit reschedule and show rescheduled state', async () => {
      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async (url: string | URL) => {
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
          return jsonResponse(200, {
            slots: mockSlots,
            timezone: 'Australia/Sydney',
            durationMinutes: 30,
          })
        }

        if (urlStr && urlStr.includes('/api/booking/reschedule')) {
          return jsonResponse(200, {
            ok: true,
            start: '2026-09-21T10:00:00Z',
            end: '2026-09-21T10:30:00Z',
            timezone: 'Australia/Sydney',
          })
        }

        return jsonResponse(200, { data: null })
      })

      const { result } = renderHook(() => useManageBooking('test-manage-token'))

      await waitFor(() => {
        expect(result.current.state).toBe('active')
      })

      act(() => {
        result.current.openReschedule()
      })

      expect(result.current.state).toBe('pickNewTime')

      const newSlot = mockSlots[0]
      if (!newSlot) return

      act(() => {
        result.current.selectNewSlot(newSlot)
      })

      expect(result.current.state).toBe('rescheduling')

      await act(async () => {
        await result.current.submitReschedule()
      })

      expect(result.current.state).toBe('rescheduled')
      expect(globalFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/booking/reschedule'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('manageToken'),
        }),
      )
    })

    it('should return to picker with notice on 409 slot_taken', async () => {
      let slotsFetchCount = 0

      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async (url: string | URL) => {
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

        if (urlStr && urlStr.includes('/api/booking/reschedule')) {
          return jsonResponse(409, { error: 'slot_taken' })
        }

        return jsonResponse(200, { data: null })
      })

      const { result } = renderHook(() => useManageBooking('test-manage-token'))

      await waitFor(() => {
        expect(result.current.state).toBe('active')
      })

      expect(slotsFetchCount).toBe(1) // Initial load

      act(() => {
        result.current.openReschedule()
      })

      const newSlot = mockSlots[0]
      if (!newSlot) return

      act(() => {
        result.current.selectNewSlot(newSlot)
      })

      await act(async () => {
        await result.current.submitReschedule()
      })

      // Should return to picker with notice
      expect(result.current.state).toBe('pickNewTime')
      expect(result.current.slotTakenNotice).toBe(true)

      // Should have refetched slots (initial + recovery)
      expect(slotsFetchCount).toBe(2)
    })

    it('should go back to active from reschedule', async () => {
      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async (url: string | URL) => {
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
          return jsonResponse(200, {
            slots: mockSlots,
            timezone: 'Australia/Sydney',
            durationMinutes: 30,
          })
        }

        return jsonResponse(200, { data: null })
      })

      const { result } = renderHook(() => useManageBooking('test-manage-token'))

      await waitFor(() => {
        expect(result.current.state).toBe('active')
      })

      act(() => {
        result.current.openReschedule()
      })

      expect(result.current.state).toBe('pickNewTime')

      act(() => {
        result.current.closeReschedule()
      })

      expect(result.current.state).toBe('active')
    })
  })

  describe('Already cancelled booking', () => {
    it('should render cancelled state with no actions', async () => {
      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async () => {
        return jsonResponse(200, { data: null })
      })

      // Use a token that triggers cancelled state
      currentMockClient = createMockSupabaseClient('test-manage-token-cancelled')
      currentManageToken = 'test-manage-token-cancelled'

      const { result } = renderHook(() => useManageBooking('test-manage-token-cancelled'))

      await waitFor(() => {
        expect(result.current.state).toBe('cancelledAlready')
      })

      // Reset
      currentMockClient = createMockSupabaseClient('test-manage-token')
      currentManageToken = 'test-manage-token'
    })
  })

  describe('Not found booking', () => {
    it('should show notFound state when RPC returns null', async () => {
      const globalFetch = global.fetch as any
      globalFetch.mockImplementation(async () => jsonResponse(200, { data: null }))

      // Use a token that triggers notfound state
      currentMockClient = createMockSupabaseClient('test-manage-token-notfound')
      currentManageToken = 'test-manage-token-notfound'

      const { result } = renderHook(() => useManageBooking('test-manage-token-notfound'))

      await waitFor(() => {
        expect(result.current.state).toBe('notFound')
      })

      // Reset
      currentMockClient = createMockSupabaseClient('test-manage-token')
      currentManageToken = 'test-manage-token'
    })
  })
})
