/**
 * The Upcoming list's rows: every unfinished step on every running
 * workflow, dated the way the engine will run it.
 *
 * Reads the MC's active instances whole (a step's date depends on the
 * steps above it, finished ones included; see `./queue-schedule-reads`)
 * and hands each one to {@link projectSchedule}. Waits and branches are
 * the engine's plumbing, so they are not rows: the send behind a Wait
 * carries the Wait's end as its own time. A failed step of any kind
 * stays, since the MC has to deal with it.
 *
 * Read through the caller's client, so RLS scopes every query to them.
 *
 * @module lib/workflows/queue-schedule
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveQuietHours } from '@/lib/automations/quiet-hours';
import type { McSnapshot } from '@/types/automations';
import type { Database } from '@/types/database';
import type { StepStatus, StepType } from '@/types/workflows';

import type { QueueFilter, QueueItem } from './queue';
import { readSchedule, type ScheduleReads, type ScheduleStep } from './queue-schedule-reads';
import { releaseBlocker } from './release';
import { projectSchedule, type StepProjection } from './schedule-projection';
import { stepDisplayTitle } from './step-label';
import { isAutomated } from './steps';

/** The MC's own quiet hours, from their settings. */
export type McQuietHours = Pick<
  McSnapshot,
  'quietHoursStart' | 'quietHoursEnd' | 'quietHoursTimezone'
>;

/** Engine plumbing, never a row of its own unless it failed. */
const HIDDEN: ReadonlySet<StepType> = new Set(['wait', 'branch']);
/** The engine's couple timezone (`loadCoupleSnapshot`), for the quiet window. */
const COUPLE_TIMEZONE = 'Australia/Sydney';
/** Stands in for an MC whose own quiet hours are unknown: the template's still apply. */
const NO_MC_QUIET: McQuietHours = {
  quietHoursStart: null,
  quietHoursEnd: null,
  quietHoursTimezone: null,
};
const FINISHED: ReadonlySet<string> = new Set(['done', 'skipped', 'cancelled']);

/**
 * Load and date every unfinished step for one MC.
 *
 * @param supabase - the caller's client (RLS) or the digest's service client
 * @param userId - the MC
 * @param timezone - the MC's IANA zone
 * @param mcQuiet - the MC's quiet hours, or null when unknown (the
 *   template's own window still applies)
 * @param filter - couple and manual-type narrowing, as the queue takes it
 * @param now - the instant every projection is measured from
 * @throws on a read that failed or could not finish; never a short list
 */
export async function loadScheduledItems(
  supabase: SupabaseClient<Database>,
  userId: string,
  timezone: string,
  mcQuiet: McQuietHours | null,
  filter: QueueFilter,
  now: Date,
): Promise<QueueItem[]> {
  const reads = await readSchedule(supabase, userId, filter);
  const byInstance = new Map<string, ScheduleStep[]>();
  for (const step of reads.steps) {
    byInstance.set(step.instance_id, [...(byInstance.get(step.instance_id) ?? []), step]);
  }
  const manualTypes = new Set(filter.types ?? ['todo', 'appointment']);

  const items: QueueItem[] = [];
  for (const instance of reads.instances) {
    const own = byInstance.get(instance.id) ?? [];
    const weddingDate = instance.couple_id
      ? (reads.firstEvent.get(instance.couple_id) ?? instance.couples?.event_date ?? null)
      : null;
    const projected = projectInstance(
      instance,
      own,
      weddingDate,
      { timezone, mcQuiet, now },
      reads,
    );

    for (const step of own) {
      const failed = step.status === 'errored';
      const plan = projected.get(step.id);
      if (FINISHED.has(step.status) || (!failed && (!plan || HIDDEN.has(step.type)))) continue;
      if (!isAutomated(step.type) && !manualTypes.has(step.type)) continue;
      items.push({
        stepId: step.id,
        instanceId: instance.id,
        instanceName: instance.name,
        coupleId: instance.couple_id,
        coupleName: instance.couples?.name ?? null,
        weddingDate,
        title: stepDisplayTitle(step),
        description: step.description ?? null,
        type: step.type,
        status: step.status as StepStatus,
        dueAt: failed ? step.due_at : (plan?.at ?? null),
        gate: failed ? null : (plan?.gate ?? null),
        blocked: !failed && isBlocked(step, own),
        requiresApproval: step.requires_approval,
      });
    }
  }
  return items;
}

/** Project one instance, or read a loose list's to-dos as they are. */
function projectInstance(
  instance: ScheduleReads['instances'][number],
  steps: ScheduleStep[],
  weddingDate: string | null,
  at: { timezone: string; mcQuiet: McQuietHours | null; now: Date },
  reads: ScheduleReads,
): Map<string, StepProjection> {
  // A couple's own to-do list and the MC's personal one are loose lists,
  // not sequences: their to-dos keep whatever date the MC gave them.
  if (instance.is_default || instance.is_personal) {
    return new Map(steps.map((step) => [step.id, { at: step.due_at, gate: null }]));
  }
  const tpl = instance.template_id ? reads.quietHours.get(instance.template_id) : undefined;
  const window = resolveQuietHours(
    tpl?.quiet_hours_start ?? null,
    tpl?.quiet_hours_end ?? null,
    at.mcQuiet ?? NO_MC_QUIET,
    instance.couple_id ? COUPLE_TIMEZONE : null,
  );
  const anchors = { weddingDate, appliedAt: instance.applied_at, timezone: at.timezone };
  return projectSchedule(steps, anchors, window, at.now);
}

/**
 * An automated step the MC must not snooze or send yet: it is still
 * behind an earlier step (`./release`), or it has no stored date and
 * only a projected one. A held step's own missing date is the MC's
 * hold, which setting a date is how they lift, so it is not blocked.
 */
function isBlocked(step: ScheduleStep, steps: ScheduleStep[]): boolean {
  if (!isAutomated(step.type)) return false;
  if (releaseBlocker(step, steps)) return true;
  return step.due_at === null && !step.due_held_at;
}
