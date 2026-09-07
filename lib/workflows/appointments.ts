/**
 * Appointment steps and the Scheduler.
 *
 * An `appointment` step is a manual step by default: a dated meeting the
 * MC holds in the diary and ticks off themselves. Give it a
 * `config.meetingTypeId` and it becomes a bridge to the Scheduler: when
 * a booking is confirmed against that meeting type for the couple, the
 * step completes on its own.
 *
 * That matters because an appointment step gates everything anchored
 * behind it. Without this, an MC who books a consultation through the
 * Scheduler would still have to tick the step by hand before the
 * follow-up email would send.
 *
 * The `consultation_booked` bus event is the trigger; the dispatcher
 * calls in here as it walks the bus.
 *
 * @module lib/workflows/appointments
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AutomationEventRow } from '@/types/automations';
import type { Database } from '@/types/database';
import type { WorkflowStepRow } from '@/types/workflows';

import { writeAudit } from './audit';
import { completeStep } from './executor';

/** The fields the booking emitter puts on a `consultation_booked` event. */
interface BookingPayload {
  booking_id?: string;
  couple_id?: string | null;
  meeting_type_id?: string | null;
  starts_at?: string;
}

/**
 * Complete every appointment step waiting on this booking's meeting
 * type, for this couple.
 *
 * Returns how many steps were completed. Never throws: a booking must
 * still be recorded even if no workflow was listening for it.
 *
 * @param supabase - a service-role client; this runs from the cron tick
 * @param event - a `consultation_booked` bus event
 */
export async function completeBookedAppointmentSteps(
  supabase: SupabaseClient<Database>,
  event: AutomationEventRow,
): Promise<number> {
  if (event.event_type !== 'consultation_booked') return 0;

  const payload = (event.payload ?? {}) as BookingPayload;
  const meetingTypeId = payload.meeting_type_id ?? null;
  const coupleId = payload.couple_id ?? event.couple_id;
  // A booking with no couple belongs to nobody's workflow, and one with
  // no meeting type cannot be matched to a step that names one.
  if (!meetingTypeId || !coupleId) return 0;

  const { data, error } = await supabase
    .from('workflow_steps')
    .select('*, workflow_instances!inner(id, user_id, couple_id, status)')
    .eq('type', 'appointment')
    .eq('status', 'pending')
    .eq('workflow_instances.couple_id', coupleId)
    .eq('workflow_instances.status', 'active');
  if (error) return 0;

  const rows = (data ?? []) as unknown as Array<
    WorkflowStepRow & {
      workflow_instances: { id: string; user_id: string; couple_id: string | null };
    }
  >;

  let completed = 0;
  for (const step of rows) {
    const config = (step.config ?? {}) as { meetingTypeId?: unknown };
    if (config.meetingTypeId !== meetingTypeId) continue;

    // completeStep, not a bare status update: ticking a step has to
    // recompute the due dates of everything gated behind it.
    await completeStep(supabase, step.id);
    completed += 1;
    await writeAudit(supabase, {
      userId: step.workflow_instances.user_id,
      instanceId: step.workflow_instances.id,
      stepId: step.id,
      coupleId: step.workflow_instances.couple_id,
      event: 'step_completed',
      detail: {
        via: 'scheduler',
        bookingId: payload.booking_id ?? null,
        meetingTypeId,
        startsAt: payload.starts_at ?? null,
      },
    });
  }

  return completed;
}
