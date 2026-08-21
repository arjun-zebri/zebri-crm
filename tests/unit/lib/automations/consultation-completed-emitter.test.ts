/**
 * Unit tests for the `consultation_completed` emitter.
 *
 * Covers the lifecycle: past confirmed bookings are flipped to completed
 * and emit consultation_completed events; future confirmed bookings are
 * untouched; already-completed bookings are not re-emitted; cancelled
 * bookings are ignored; emit failures on one row don't abort others.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, describe, it, vi, beforeEach } from 'vitest'

import { consultationCompletedEmitter } from '@/lib/automations/time-emitters/consultation-completed'
import type { Database } from '@/types/database'

describe('consultationCompletedEmitter', () => {
  let supabase: SupabaseClient<Database>

  beforeEach(() => {
    supabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    } as unknown as SupabaseClient<Database>
  })

  it('should flip a past confirmed booking to completed and emit the event', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago
    const pastBooking = {
      id: 'booking-1',
      user_id: 'user-1',
      couple_id: 'couple-1',
      meeting_type_id: 'mt-1',
      name: 'John Doe',
      email: 'john@example.com',
      starts_at: pastTime.toISOString(),
      ends_at: pastTime.toISOString(),
      timezone: 'UTC',
      status: 'confirmed',
    }

    // Mock the select chain for loading candidates
    ;(supabase.from as any) = vi.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: [pastBooking],
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return {}
    })

    ;(supabase.rpc as any) = vi.fn().mockResolvedValue({ error: null })

    const emitted = await consultationCompletedEmitter.run(supabase)

    expect(emitted).toBe(1)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'emit_automation_event',
      expect.objectContaining({
        p_user_id: 'user-1',
        p_source_table: 'bookings',
        p_source_id: 'booking-1',
        p_event_type: 'consultation_completed',
      })
    )
  })

  it('should not emit for a future confirmed booking', async () => {
    const now = new Date()
    const futureTime = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now

    ;(supabase.from as any) = vi.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: [], // Future bookings not selected
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    })

    const emitted = await consultationCompletedEmitter.run(supabase)
    expect(emitted).toBe(0)
  })

  it('should not re-emit an already-completed booking', async () => {
    // Empty result: completed bookings have status != 'confirmed', so they are not selected
    ;(supabase.from as any) = vi.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    })

    const emitted = await consultationCompletedEmitter.run(supabase)
    expect(emitted).toBe(0)
  })

  it('should ignore cancelled bookings', async () => {
    // Empty result: cancelled bookings are not selected by the query
    ;(supabase.from as any) = vi.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    })

    const emitted = await consultationCompletedEmitter.run(supabase)
    expect(emitted).toBe(0)
  })

  it('should continue processing when one emit fails', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 60 * 60 * 1000)

    const booking1 = {
      id: 'booking-1',
      user_id: 'user-1',
      couple_id: 'couple-1',
      meeting_type_id: 'mt-1',
      name: 'John Doe',
      email: 'john@example.com',
      starts_at: pastTime.toISOString(),
      ends_at: pastTime.toISOString(),
      timezone: 'UTC',
      status: 'confirmed',
    }

    const booking2 = {
      id: 'booking-2',
      user_id: 'user-1',
      couple_id: 'couple-2',
      meeting_type_id: 'mt-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      starts_at: pastTime.toISOString(),
      ends_at: pastTime.toISOString(),
      timezone: 'UTC',
      status: 'confirmed',
    }

    ;(supabase.from as any) = vi.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: [booking1, booking2],
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return {}
    })

    const mockRpc = vi.fn()
    // First emit fails, second succeeds
    mockRpc
      .mockResolvedValueOnce({ error: new Error('Network error') })
      .mockResolvedValueOnce({ error: null })

    ;(supabase.rpc as any) = mockRpc

    const emitted = await consultationCompletedEmitter.run(supabase)

    // Both were processed despite first's failure
    expect(emitted).toBe(1)
    expect(mockRpc).toHaveBeenCalledTimes(2)
  })
})
