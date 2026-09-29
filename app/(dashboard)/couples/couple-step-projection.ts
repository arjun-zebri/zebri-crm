/**
 * When each coming step on a couple will run, for the Workflow tab.
 *
 * The engine only dates a step once the step above it finishes, so on
 * the couple's list every send behind a Wait had no date at all, and
 * the Wait itself showed the day it started rather than the day it
 * ends (user ticket, 2026-09-29). The Upcoming list already solved this
 * with {@link projectSchedule}; this runs the same projection over the
 * couple's own instances so the two surfaces cannot disagree.
 *
 * Pure, so it is tested without rendering the tab.
 *
 * @module app/(dashboard)/couples/couple-step-projection
 */

import { projectSchedule, type StepProjection } from '@/lib/workflows/schedule-projection';
import type { WorkflowInstanceWithSteps } from '@/types/workflows';

/**
 * Project every running workflow on one couple.
 *
 * Only `active` instances are projected. A paused one runs nothing until
 * it is resumed, so a projected date would be a promise it cannot keep.
 * The couple's own to-do list is a loose list, not a sequence, and keeps
 * the dates the MC gave it. Both fall back to their stored `due_at`.
 *
 * Quiet hours are not applied: the tab does not load them, and they only
 * ever nudge a Wait's end by hours, never the day a send is planned for
 * in the ordinary case of a daytime wake.
 *
 * @param instances - the couple's instances, cancelled ones included or not
 * @param weddingDate - the couple's wedding date as `YYYY-MM-DD`, or null
 * @param timezone - the MC's IANA zone
 * @param now - injectable for tests
 * @returns one projection per unfinished step of a running workflow
 */
export function projectCoupleSteps(
  instances: WorkflowInstanceWithSteps[],
  weddingDate: string | null,
  timezone: string,
  now: Date = new Date(),
): Map<string, StepProjection> {
  const out = new Map<string, StepProjection>();
  for (const instance of instances) {
    if (instance.status !== 'active' || instance.is_default || instance.is_personal) continue;
    const projected = projectSchedule(
      instance.steps,
      { weddingDate, appliedAt: instance.applied_at, timezone },
      null,
      now,
    );
    for (const [id, projection] of projected) out.set(id, projection);
  }
  return out;
}
