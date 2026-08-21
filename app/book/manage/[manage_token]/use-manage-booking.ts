/**
 * State machine hook for the public manage booking page.
 *
 * Orchestrates the manage flow: loading -> active | cancelledAlready | past | notFound | error.
 * From active: confirmCancel -> cancelled, or pickNewTime -> rescheduling -> rescheduled.
 * Slot fetch handles 503 as fail-closed. On 409 (slot taken), returns to picker with notice and refetches.
 *
 * @module app/book/manage/[manage_token]/use-manage-booking
 */

import { useCallback, useEffect, useState } from 'react'

import type { PublicBranding } from '@/lib/branding/public-branding'
import { createClient } from '@/lib/supabase/client'

export type ManagePageState =
  | 'loading'
  | 'active'
  | 'cancelledAlready'
  | 'past'
  | 'notFound'
  | 'error'
  | 'confirmCancel'
  | 'pickNewTime'
  | 'rescheduling'
  | 'cancelled'
  | 'rescheduled'

/**
 * Meeting type details from the booking.
 */
interface MeetingType {
  name: string
  duration_minutes: number
  location_type: 'video' | 'phone' | 'in_person'
}

/**
 * Booking data merged with branding scalars.
 */
export interface ManageBooking extends PublicBranding {
  booking_id: string
  status: 'confirmed' | 'cancelled' | 'past'
  starts_at: string
  ends_at: string
  timezone: string
  name: string
  email: string
  video_join_url: string | null
  business_name: string
  meeting_type: MeetingType
  share_token: string
}

export interface Slot {
  start: string
  end: string
}

interface UseManageBookingState {
  state: ManagePageState
  booking: ManageBooking | null
  slots: Slot[]
  selectedSlot: Slot | null
  timezone: string
  slotTakenNotice: boolean
  error: string | null
  currentFrom: string
  currentTo: string
  submitting: boolean
}

/**
 * Manages the manage booking page state machine. Handles RPC fetch for booking data,
 * slot queries with 2-week paging, cancel and reschedule submission, and error recovery.
 */
export function useManageBooking(manageToken: string) {
  const supabase = createClient()

  const [s, setS] = useState<UseManageBookingState>({
    state: 'loading',
    booking: null,
    slots: [],
    selectedSlot: null,
    timezone: '',
    slotTakenNotice: false,
    error: null,
    currentFrom: '',
    currentTo: '',
    submitting: false,
  })

  const loadSlots = useCallback(
    async (from: string, to: string) => {
      try {
        const res = await fetch(`/api/booking/slots?manageToken=${manageToken}&from=${from}&to=${to}`)

        if (!res.ok) {
          if (res.status === 503) {
            setS((prev) => ({
              ...prev,
              error: 'Availability is temporarily unavailable, please try again shortly',
            }))
          } else {
            setS((prev) => ({ ...prev, error: 'Could not load available times' }))
          }
          return
        }

        const data = (await res.json()) as {
          slots: Slot[]
          timezone: string
          durationMinutes: number
        }

        setS((prev) => ({
          ...prev,
          slots: data.slots,
          timezone: data.timezone,
          currentFrom: from,
          currentTo: to,
          error: null,
        }))
      } catch (err) {
        console.error('[manage-booking] slot load error', err)
        setS((prev) => ({ ...prev, error: 'Could not load available times' }))
      }
    },
    [manageToken],
  )

  // Initialize: fetch booking data on mount
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_booking_by_manage_token', {
        token: manageToken,
      })

      if (error || !data) {
        console.warn(`[manage-booking] unavailable token=${manageToken} err=${error?.message ?? 'none'}`)
        setS((prev) => ({ ...prev, state: 'notFound' }))
        return
      }

      const booking = data as unknown as ManageBooking

      // Determine state based on booking status and time
      let nextState: ManagePageState = 'active'
      if (booking.status === 'cancelled') {
        nextState = 'cancelledAlready'
      } else if (booking.status === 'past') {
        nextState = 'past'
      }

      setS((prev) => ({ ...prev, booking, state: nextState }))

      // Load initial fortnight of slots only if active
      if (nextState === 'active') {
        const today = new Date()
        const from = today.toISOString().split('T')[0]
        const toDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
        const to = toDate.toISOString().split('T')[0]

        if (from && to) {
          await loadSlots(from, to)
        }
      }
    }

    void load()
  }, [manageToken, supabase, loadSlots])

  const openCancelConfirm = useCallback(() => {
    setS((prev) => ({
      ...prev,
      state: 'confirmCancel',
    }))
  }, [])

  const closeCancelConfirm = useCallback(() => {
    setS((prev) => ({
      ...prev,
      state: 'active',
    }))
  }, [])

  const confirmCancel = useCallback(async () => {
    setS((prev) => ({ ...prev, submitting: true }))

    try {
      const res = await fetch('/api/booking/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manageToken }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        setS((prev) => ({
          ...prev,
          state: 'error',
          error: errorData.error || 'Could not cancel booking',
          submitting: false,
        }))
        return
      }

      setS((prev) => ({
        ...prev,
        state: 'cancelled',
        submitting: false,
      }))
    } catch (err) {
      console.error('[manage-booking] cancel error', err)
      setS((prev) => ({
        ...prev,
        state: 'error',
        error: 'Something went wrong. Please try again.',
        submitting: false,
      }))
    }
  }, [manageToken])

  const openReschedule = useCallback(() => {
    setS((prev) => ({
      ...prev,
      state: 'pickNewTime',
      slotTakenNotice: false,
    }))
  }, [])

  const closeReschedule = useCallback(() => {
    setS((prev) => ({
      ...prev,
      state: 'active',
      selectedSlot: null,
      slotTakenNotice: false,
    }))
  }, [])

  const selectNewSlot = useCallback((slot: Slot) => {
    setS((prev) => ({
      ...prev,
      selectedSlot: slot,
      state: 'rescheduling',
      slotTakenNotice: false,
    }))
  }, [])

  const submitReschedule = useCallback(async () => {
    if (!s.selectedSlot || !s.timezone) {
      console.error('[manage-booking] submit: no selected slot or timezone')
      return
    }

    try {
      const res = await fetch('/api/booking/reschedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          manageToken,
          // Send the slot string exactly as the slots endpoint produced it;
          // a Date round-trip re-adds milliseconds and changes the value.
          startsAt: s.selectedSlot.start,
          timezone: s.timezone,
        }),
      })

      if (res.status === 409) {
        // Slot was taken: refetch and return to picker
        await loadSlots(s.currentFrom, s.currentTo)
        setS((prev) => ({
          ...prev,
          state: 'pickNewTime',
          selectedSlot: null,
          slotTakenNotice: true,
          submitting: false,
        }))
        return
      }

      if (res.status === 503) {
        setS((prev) => ({
          ...prev,
          state: 'pickNewTime',
          selectedSlot: null,
          error: 'Availability is temporarily unavailable, please try again shortly',
          submitting: false,
        }))
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        setS((prev) => ({
          ...prev,
          state: 'error',
          error: errorData.error || 'Could not reschedule booking',
          submitting: false,
        }))
        return
      }

      setS((prev) => ({
        ...prev,
        state: 'rescheduled',
        selectedSlot: null,
        submitting: false,
      }))
    } catch (err) {
      console.error('[manage-booking] reschedule error', err)
      setS((prev) => ({
        ...prev,
        state: 'error',
        error: 'Something went wrong. Please try again.',
        submitting: false,
      }))
    }
  }, [s.selectedSlot, s.timezone, s.currentFrom, s.currentTo, manageToken, loadSlots])

  const loadNextFortnight = useCallback(async () => {
    if (!s.currentTo) return
    const toDate = new Date(s.currentTo + 'T00:00:00Z')
    const nextFromDate = new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
    const nextFrom = nextFromDate.toISOString().split('T')[0]
    const nextToDate = new Date(nextFromDate.getTime() + 14 * 24 * 60 * 60 * 1000)
    const nextTo = nextToDate.toISOString().split('T')[0]
    if (nextFrom && nextTo) {
      await loadSlots(nextFrom, nextTo)
    }
  }, [s.currentTo, loadSlots])

  const loadPreviousFortnight = useCallback(async () => {
    if (!s.currentFrom) return
    const fromDate = new Date(s.currentFrom + 'T00:00:00Z')
    const prevToDate = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000)
    const prevTo = prevToDate.toISOString().split('T')[0]
    const prevFromDate = new Date(prevToDate.getTime() - 14 * 24 * 60 * 60 * 1000)
    const prevFrom = prevFromDate.toISOString().split('T')[0]
    if (prevFrom && prevTo) {
      await loadSlots(prevFrom, prevTo)
    }
  }, [s.currentFrom, loadSlots])

  return {
    state: s.state,
    booking: s.booking,
    slots: s.slots,
    selectedSlot: s.selectedSlot,
    timezone: s.timezone,
    slotTakenNotice: s.slotTakenNotice,
    error: s.error,
    currentFrom: s.currentFrom,
    currentTo: s.currentTo,
    submitting: s.submitting,
    openCancelConfirm,
    closeCancelConfirm,
    confirmCancel,
    openReschedule,
    closeReschedule,
    selectNewSlot,
    submitReschedule,
    loadNextFortnight,
    loadPreviousFortnight,
  }
}
