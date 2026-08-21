/**
 * `consultation_completed` time-based emitter.
 *
 * Fires when a booking with status `'confirmed'` has an `ends_at`
 * timestamp in the past, i.e. the consultation has ended. The emitter
 * flips the booking status to `'completed'` and emits a
 * `consultation_completed` event.
 *
 * # Idempotency
 *
 * Unlike the date-bucket dedup strategy used by `time_before_event` and
 * `invoice_due`, this emitter relies on the **status flip itself as the
 * idempotency guard**: a row with status `'completed'` is never selected
 * again by the WHERE clause, so it can never re-emit on a subsequent
 * tick. This is simpler and more efficient than date dedup because the
 * state change (confirmed → completed) is permanent per row.
 *
 * # Emit semantics
 *
 *   - One event per booking whose consultation has ended.
 *   - Payload mirrors the `booking_cancelled` shape: `booking_id`,
 *     `couple_id`, `meeting_type_id`, `booker_name`, `booker_email`,
 *     `starts_at`, `ends_at`, `timezone`.
 *   - Only confirmed bookings are processed; cancelled, pending, and
 *     already-completed bookings are skipped.
 *   - One row failing to emit does not abort the batch; remaining rows
 *     are still processed and emitted.
 *
 * @module lib/automations/time-emitters/consultation-completed
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { sendAlert } from '@/lib/alerts/send-alert'
import type { Database } from '@/types/database'

import type { TimeEmitter } from './index'

/**
 * A booking row that is ready to be transitioned to completed.
 */
interface CandidateBooking {
  id: string
  user_id: string
  couple_id: string | null
  meeting_type_id: string
  name: string | null
  email: string | null
  starts_at: string
  ends_at: string
  timezone: string
}

/**
 * Fetch all confirmed bookings whose ends_at is in the past.
 * These are candidates for transition to 'completed' status.
 */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
): Promise<CandidateBooking[]> {
  const { data, error } = await supabase
    .from('bookings' as never)
    .select(
      'id, user_id, couple_id, meeting_type_id, name, email, starts_at, ends_at, timezone'
    )
    .eq('status', 'confirmed')
    .lt('ends_at', new Date().toISOString())

  if (error) {
    throw new Error(`load past confirmed bookings: ${error.message}`)
  }

  return (data ?? []) as CandidateBooking[]
}

/**
 * Flip a booking's status from 'confirmed' to 'completed'.
 */
async function updateBookingStatus(
  supabase: SupabaseClient<Database>,
  bookingId: string,
): Promise<void> {
  const updatePayload = {
    status: 'completed',
    updated_at: new Date().toISOString(),
  } as never

  const result = await supabase
    .from('bookings' as never)
    .update(updatePayload)
    .eq('id', bookingId)

  const { error } = result as { error?: { message: string } | null }
  if (error) {
    throw new Error(`update booking status: ${error.message}`)
  }
}

/**
 * Emit a single `consultation_completed` event for a now-completed booking.
 */
async function emit(
  supabase: SupabaseClient<Database>,
  booking: CandidateBooking,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: booking.user_id,
    p_source_table: 'bookings',
    p_source_id: booking.id,
    p_event_type: 'consultation_completed',
    p_payload: {
      booking_id: booking.id,
      couple_id: booking.couple_id,
      meeting_type_id: booking.meeting_type_id,
      booker_name: booking.name,
      booker_email: booking.email,
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      timezone: booking.timezone,
    } as never,
    p_couple_id: booking.couple_id,
  } as never)

  if (error) throw new Error(`emit consultation_completed: ${error.message}`)
}

/**
 * The exported emitter. Reads past confirmed bookings, flips each to
 * completed, and emits the consultation_completed event. One row failing
 * does not abort the batch.
 */
export const consultationCompletedEmitter: TimeEmitter = {
  type: 'consultation_completed',
  async run(supabase) {
    const candidates = await loadCandidates(supabase)
    if (candidates.length === 0) return 0

    let emitted = 0
    for (const booking of candidates) {
      try {
        // Flip status first, so idempotency is guaranteed by the row's
        // new state even if emit fails.
        await updateBookingStatus(supabase, booking.id)
        await emit(supabase, booking)
        emitted += 1
      } catch (err) {
        // Log the error but continue processing the rest.
        void sendAlert({
          type: 'app_error',
          severity: 'error',
          source: 'automations.consultation-completed-emitter',
          message: `consultation_completed failed for booking ${booking.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        })
      }
    }

    return emitted
  },
}
