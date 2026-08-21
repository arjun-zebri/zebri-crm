/**
 * State machine hook for the public booking page.
 *
 * Orchestrates the 5-state flow: loading -> pick -> details -> submitting -> confirmed | notFound | error.
 * Slot fetch handles 503 as fail-closed. Slot selection caches the current 2-week range.
 * On 409 (slot taken), returns to picker with slotTakenNotice=true and refetches.
 *
 * @module app/book/[token]/use-booking-page
 */

import { useCallback, useEffect, useState } from 'react'

import type { BookingSubmitInput } from '@/app/api/booking/submit-schema'
import { useBrowserTimezone } from '@/components/scheduling/use-browser-timezone'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { isValidTimezone } from '@/lib/scheduling/timezone-options'
import { createClient } from '@/lib/supabase/client'

export type PageState = 'loading' | 'pick' | 'details' | 'submitting' | 'confirmed' | 'notFound' | 'error'

export type BookingPageData = PublicBranding & {
  name: string
  description: string
  duration_minutes: number
  location_type: 'video' | 'phone' | 'in_person'
  address: string | null
}

export interface Slot {
  start: string
  end: string
}

export interface BookingConfirmation {
  ok: boolean
  start: string
  end: string
  timezone: string
  joinUrl?: string | null
}

interface UseBookingPageState {
  state: PageState
  bookingPage: BookingPageData | null
  slots: Slot[]
  selectedSlot: Slot | null
  /**
   * The MC's own zone, as returned by the slots endpoint.
   *
   * Kept only as the fallback for display before detection lands. It is NOT
   * the booker's zone: treating it as such is what made a Perth couple read
   * Sydney times as their own and stored the MC's zone on their booking.
   */
  mcTimezone: string
  /**
   * An explicit zone the booker picked, overriding browser detection.
   *
   * Empty means "whatever the browser says". Kept separate from the detected
   * value so a deliberate choice survives re-renders and slot refetches.
   */
  viewerTimezone: string
  slotTakenNotice: boolean
  confirmation: BookingConfirmation | null
  error: string | null
  currentFrom: string
  currentTo: string
  submitting: boolean
  selectedDate: string | null
  currentMonth: string
  /**
   * True while a slot query is in flight.
   *
   * Paging to another month refetches, and during that window the slot list is
   * stale or empty. Without this the picker would claim there are no times,
   * which is a very different message from "still looking".
   */
  slotsLoading: boolean
}

interface SubmitPayload {
  token: string
  name: string
  partnerName: string | undefined
  email: string
  phone: string | undefined
  notes: string | undefined
  startedAt: number
}

/**
 * Get the local calendar day for a slot in YYYY-MM-DD format.
 */
function getLocalDay(isoString: string, timezone: string): string {
  const date = new Date(isoString)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  })
  return formatter.format(date)
}

/**
 * Build a Set of available dates from slots.
 */
function buildAvailableDates(slots: Slot[], timezone: string): Set<string> {
  const dates = new Set<string>()
  for (const slot of slots) {
    dates.add(getLocalDay(slot.start, timezone))
  }
  return dates
}

/**
 * Manages the booking page state machine. Handles RPC fetch for meeting type data,
 * slot queries with 2-week paging, form submission, and error recovery (409 -> refetch).
 */
export function useBookingPage(token: string) {
  const supabase = createClient()

  const [s, setS] = useState<UseBookingPageState>({
    state: 'loading',
    bookingPage: null,
    slots: [],
    selectedSlot: null,
    mcTimezone: '',
    viewerTimezone: '',
    slotTakenNotice: false,
    confirmation: null,
    error: null,
    currentFrom: '',
    currentTo: '',
    submitting: false,
    selectedDate: null,
    currentMonth: new Date().toISOString().split('T')[0]!.slice(0, 7),
    slotsLoading: true,
  })

  // The zone the browser reports, or '' on the server and where Intl cannot say.
  const detectedTimezone = useBrowserTimezone()

  const loadSlots = useCallback(
    async (tokenVal: string, from: string, to: string) => {
      setS((prev) => ({ ...prev, slotsLoading: true }))
      try {
        const res = await fetch(`/api/booking/slots?token=${tokenVal}&from=${from}&to=${to}`)

        if (!res.ok) {
          if (res.status === 503) {
            setS((prev) => ({
              ...prev,
              error: 'Availability is temporarily unavailable, please try again shortly',
            }))
          } else if (res.status === 404) {
            setS((prev) => ({ ...prev, state: 'notFound' }))
          } else {
            setS((prev) => ({ ...prev, error: 'Could not load available times' }))
          }
          setS((prev) => ({ ...prev, slotsLoading: false }))
          return
        }

        const data = (await res.json()) as {
          slots: Slot[]
          timezone: string
          durationMinutes: number
        }

        setS((prev) => {
          // Group in the zone the booker is actually reading. Far-offset zones
          // push a slot into the neighbouring local day, so the first available
          // date has to be derived after the zone is known, not before.
          const groupingZone = prev.viewerTimezone || detectedTimezone || data.timezone
          const sortedDates = Array.from(
            buildAvailableDates(data.slots, groupingZone),
          ).sort()
          const firstAvailable = sortedDates.length > 0 ? sortedDates[0]! : null

          return {
          ...prev,
          slots: data.slots,
          mcTimezone: data.timezone,
          currentFrom: from,
          currentTo: to,
          error: null,
          selectedDate: firstAvailable,
          currentMonth: from.slice(0, 7),
          slotsLoading: false,
          }
        })
      } catch (err) {
        console.error('[booking] slot load error', err)
        setS((prev) => ({
          ...prev,
          error: 'Could not load available times',
          slotsLoading: false,
        }))
      }
    },
    [detectedTimezone],
  )

  // Initialize: fetch booking page data on mount
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_public_booking_page', {
        token,
      })

      if (error || !data) {
        console.warn(`[booking] unavailable token=${token} err=${error?.message ?? 'none'}`)
        setS((prev) => ({ ...prev, state: 'notFound' }))
        return
      }

      const bookingPage = data as unknown as BookingPageData

      // Load the first fortnight of slots BEFORE revealing the picker.
      //
      // Switching to 'pick' as soon as the meeting type arrived showed the
      // picker with an empty slot list, so the couple saw the skeleton, then
      // "No times available for this period", then the times. Two of those
      // three frames were wrong, and the middle one says the MC is unavailable.
      const today = new Date()
      const from = today.toISOString().split('T')[0]
      const toDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
      const to = toDate.toISOString().split('T')[0]

      if (from && to) {
        await loadSlots(token, from, to)
      }

      setS((prev) => ({ ...prev, bookingPage, state: 'pick' }))
    }

    void load()
  }, [token, supabase, loadSlots])

  const selectSlot = useCallback((slot: Slot) => {
    setS((prev) => ({
      ...prev,
      selectedSlot: slot,
      state: 'details',
      slotTakenNotice: false,
    }))
  }, [])

  const goBackToSlots = useCallback(() => {
    setS((prev) => ({
      ...prev,
      state: 'pick',
      selectedSlot: null,
    }))
  }, [])

  const selectDate = useCallback((date: string) => {
    setS((prev) => ({
      ...prev,
      selectedDate: date,
    }))
  }, [])

  const changeMonth = useCallback(
    async (yearMonth: string) => {
      const [year, month] = yearMonth.split('-').map(Number)
      const firstDay = new Date(Date.UTC(year!, month! - 1, 1))
      const lastDay = new Date(Date.UTC(year!, month!, 0))
      const from = firstDay.toISOString().split('T')[0]
      const to = lastDay.toISOString().split('T')[0]

      if (from && to) {
        setS((prev) => ({ ...prev, currentMonth: yearMonth }))
        await loadSlots(token, from, to)
      }
    },
    [token, loadSlots],
  )

  const submit = useCallback(
    async (payload: SubmitPayload) => {
      const bookerTimezone = s.viewerTimezone || detectedTimezone || s.mcTimezone
      if (!s.selectedSlot || !bookerTimezone) {
        console.error('[booking] submit: no selected slot or timezone')
        return
      }

      setS((prev) => ({ ...prev, submitting: true }))

      try {
        // Send the slot string exactly as the slots endpoint produced it.
        // Round-tripping through Date re-adds milliseconds and changes the
        // value the server offered.
        const submitBody: BookingSubmitInput = {
          token: payload.token,
          startsAt: s.selectedSlot.start,
          // The booker's zone, so their confirmation and 24h reminder render
          // in it and the MC can see where they are.
          timezone: bookerTimezone,
          name: payload.name,
          email: payload.email,
          website: '', // honeypot
          startedAt: payload.startedAt,
          partnerName: payload.partnerName,
          phone: payload.phone,
          notes: payload.notes,
        }

        const res = await fetch('/api/booking/submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(submitBody),
        })

        if (res.status === 409) {
          // Slot was taken: refetch and return to picker
          await loadSlots(token, s.currentFrom, s.currentTo)
          setS((prev) => ({
            ...prev,
            state: 'pick',
            selectedSlot: null,
            slotTakenNotice: true,
            submitting: false,
          }))
          return
        }

        if (!res.ok) {
          const errorData = await res.json()
          setS((prev) => ({
            ...prev,
            state: 'error',
            error: errorData.error || 'Could not complete booking',
            submitting: false,
          }))
          return
        }

        const confirmation = (await res.json()) as BookingConfirmation
        setS((prev) => ({
          ...prev,
          state: 'confirmed',
          confirmation,
          selectedSlot: null,
          submitting: false,
        }))
      } catch (err) {
        console.error('[booking] submit error', err)
        setS((prev) => ({
          ...prev,
          state: 'error',
          error: 'Something went wrong. Please try again.',
          submitting: false,
        }))
      }
    },
    [s.selectedSlot, s.viewerTimezone, detectedTimezone, s.mcTimezone, s.currentFrom, s.currentTo, token, loadSlots],
  )

  /**
   * Switch the zone the booker reads times in.
   *
   * Slots are absolute instants, so nothing is refetched. But regrouping can
   * move a slot across a local-day boundary, which can leave the selected date
   * empty; when that happens, fall to the first date that still has times
   * rather than showing "no times available" for a day the booker did not pick.
   */
  const changeTimezone = useCallback((next: string) => {
    if (!isValidTimezone(next)) return
    setS((prev) => {
      const dates = Array.from(buildAvailableDates(prev.slots, next)).sort()
      const keepSelected = prev.selectedDate && dates.includes(prev.selectedDate)
      return {
        ...prev,
        viewerTimezone: next,
        selectedDate: keepSelected ? prev.selectedDate : (dates[0] ?? null),
      }
    })
  }, [])

  const loadNextFortnight = useCallback(async () => {
    if (!s.currentTo) return
    const toDate = new Date(s.currentTo + 'T00:00:00Z')
    const nextFromDate = new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
    const nextFrom = nextFromDate.toISOString().split('T')[0]
    const nextToDate = new Date(nextFromDate.getTime() + 14 * 24 * 60 * 60 * 1000)
    const nextTo = nextToDate.toISOString().split('T')[0]
    if (nextFrom && nextTo) {
      await loadSlots(token, nextFrom, nextTo)
    }
  }, [token, s.currentTo, loadSlots])

  const loadPreviousFortnight = useCallback(async () => {
    if (!s.currentFrom) return
    const fromDate = new Date(s.currentFrom + 'T00:00:00Z')
    const prevToDate = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000)
    const prevTo = prevToDate.toISOString().split('T')[0]
    const prevFromDate = new Date(prevToDate.getTime() - 14 * 24 * 60 * 60 * 1000)
    const prevFrom = prevFromDate.toISOString().split('T')[0]
    if (prevFrom && prevTo) {
      await loadSlots(token, prevFrom, prevTo)
    }
  }, [token, s.currentFrom, loadSlots])

  // Everything the booker reads is rendered in their zone, falling back to the
  // MC's only for the first paint before detection resolves.
  const timezone = s.viewerTimezone || detectedTimezone || s.mcTimezone
  const availableDates = buildAvailableDates(s.slots, timezone)
  const slotsForSelectedDate = s.selectedDate
    ? s.slots.filter((slot) => getLocalDay(slot.start, timezone) === s.selectedDate)
    : []

  return {
    state: s.state,
    bookingPage: s.bookingPage,
    slots: s.slots,
    slotsForSelectedDate,
    selectedSlot: s.selectedSlot,
    selectedDate: s.selectedDate,
    currentMonth: s.currentMonth,
    availableDates,
    timezone,
    changeTimezone,
    slotTakenNotice: s.slotTakenNotice,
    confirmation: s.confirmation,
    error: s.error,
    currentFrom: s.currentFrom,
    currentTo: s.currentTo,
    submitting: s.submitting,
    slotsLoading: s.slotsLoading,
    selectSlot,
    selectDate,
    changeMonth,
    goBackToSlots,
    submit,
    loadNextFortnight,
    loadPreviousFortnight,
  }
}
