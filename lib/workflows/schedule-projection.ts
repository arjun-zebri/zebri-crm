/**
 * When each unfinished step of one workflow will actually run.
 *
 * The engine only dates a step once the step above it finishes, so a
 * send behind a Wait has no `due_at` until the Wait ends. Upcoming read
 * that null as "no date" and the MC could not see a send five minutes
 * away (owner report, 2026-09-27). This walks the instance the way the
 * engine will, lane by lane like `recomputeDueDates`, and dates every
 * step it can:
 *
 * - a stored `due_at` is trusted; an automated step already past it
 *   runs on the next tick, so it finishes at `now`;
 * - an undated step is dated from its predecessor's projected finish
 *   with the same `computeDueAt` the engine uses;
 * - a Wait finishes at its wake, from `computeWaitWakeAt` and the
 *   quiet-hours push `execute-step` applies. Only Waits move for quiet
 *   hours: the engine does not defer a send itself, so neither does this.
 *
 * Where only a person can say when (a to-do, an approval, a branch not
 * yet decided, a held date, a failed step), the steps behind it carry a
 * reason instead of a time. Pure, so every rule is unit-tested.
 *
 * @module lib/workflows/schedule-projection
 */

import { computeWaitWakeAt, waitConfigSchema } from '@/lib/automations/conditions';
import { nextAllowedSendAt, type QuietHoursWindow } from '@/lib/automations/quiet-hours';
import type { WaitActionConfig } from '@/types/automations';
import type { WorkflowStepRow } from '@/types/workflows';

import { stepDisplayTitle } from './step-label';
import { computeDueAt, isHeld, type InstanceAnchors } from './timing';
import { toStepTiming } from './timing-summary';

/** The step fields the projection reads. */
export type ProjectionStep = Pick<
  WorkflowStepRow,
  | 'id'
  | 'position'
  | 'type'
  | 'status'
  | 'timing'
  | 'due_at'
  | 'parent_step_id'
  | 'branch_path'
  | 'completed_at'
  | 'requires_approval'
  | 'config'
  | 'title'
> & { due_held_at?: string | null };

/** One unfinished step's projected run: a time, or why there is none. */
export interface StepProjection {
  /** ISO instant the step will run, or null when a person decides. */
  at: string | null;
  /** Plain-words reason when `at` is null, e.g. "After you finish Call venue". */
  gate: string | null;
}

/** What a step hands the step behind it: a finish time or a reason. */
type Release = { at: string } | { gate: string };

const later = (a: string, b: Date): string =>
  new Date(Math.max(new Date(a).getTime(), b.getTime())).toISOString();

/**
 * Project every unfinished step of one instance.
 *
 * @param steps - every step in the instance, finished ones included
 * @param anchors - wedding date, apply instant and the MC's zone
 * @param quietWindow - the window a Wait respects, or null for none
 * @param now - the instant "overdue" is measured against
 * @returns one entry per step that has not finished
 */
export function projectSchedule(
  steps: ProjectionStep[],
  anchors: InstanceAnchors,
  quietWindow: QuietHoursWindow | null,
  now: Date,
): Map<string, StepProjection> {
  const out = new Map<string, StepProjection>();
  const lanes = new Map<string, ProjectionStep[]>();
  for (const step of steps) {
    const key = `${step.parent_step_id ?? 'root'}::${step.branch_path ?? ''}`;
    lanes.set(key, [...(lanes.get(key) ?? []), step]);
  }

  const walk = (parentId: string | null, path: string, head: Release) => {
    const lane = (lanes.get(`${parentId ?? 'root'}::${path}`) ?? []).sort(
      (a, b) => a.position - b.position,
    );
    let prev = head;
    for (const step of lane) {
      const { shown, release } = projectStep(step, prev, anchors, quietWindow, now);
      if (shown) out.set(step.id, shown);
      if (step.type === 'branch') {
        // Only a decided branch dates its lanes; until then nobody knows
        // which side runs, so both sides say what they are waiting on.
        // A branch that is itself behind a person passes their reason
        // on, since that is what the MC has to do first.
        const lanesHead: Release =
          step.status === 'done' && step.completed_at
            ? { at: step.completed_at }
            : 'gate' in release
              ? release
              : { gate: `Depends on ${stepDisplayTitle(step)}` };
        walk(step.id, 'yes', lanesHead);
        walk(step.id, 'no', lanesHead);
      }
      prev = release;
    }
  };
  walk(null, '', { at: anchors.appliedAt });
  return out;
}

/** One step: what to show for it, and what it releases. */
function projectStep(
  step: ProjectionStep,
  prev: Release,
  anchors: InstanceAnchors,
  quietWindow: QuietHoursWindow | null,
  now: Date,
): { shown: StepProjection | null; release: Release } {
  const title = stepDisplayTitle(step);
  switch (step.status) {
    case 'done':
    case 'skipped':
      // A finished step with no finish time releases nothing in the
      // engine (`computeDueAt` has no anchor), so no time is invented.
      if (!step.completed_at) return { shown: null, release: { gate: `After ${title}` } };
      // A step finished early (a to-do ticked, or a dated step that ran
      // on its date, while a step above it still waits) releases nothing
      // until the chain above it does, and then from whichever finished
      // last, as `recomputeDueDates` dates it (owner ruling, 2026-09-27).
      return {
        shown: null,
        release: 'gate' in prev ? prev : { at: later(step.completed_at, new Date(prev.at)) },
      };
    case 'cancelled':
      return { shown: null, release: { gate: `After ${title}, which was stopped` } };
    case 'errored':
      return { shown: null, release: { gate: `After ${title} is fixed` } };
  }
  if (isHeld(step)) {
    return {
      shown: { at: null, gate: 'No date set' },
      release: { gate: `After ${title}, which has no date` },
    };
  }

  // What this step hands the step behind it once it has run: never
  // earlier than the chain above it, and nothing while that chain still
  // waits on a person. A chained step's own time is already at or after
  // `prev`; a dated one fires on its own date, but its follower waits for
  // everything above (owner ruling, 2026-09-27), as `recomputeDueDates`
  // and `releaseBlocker` hold it.
  const behind = (at: string): Release => ('gate' in prev ? prev : { at: later(at, new Date(prev.at)) });
  const timing = toStepTiming(step.timing);

  let start = step.due_at;
  if (start === null) {
    // Only a chained step waits on its predecessor; a wedding- or
    // apply-dated step has its own date whatever happens above it.
    if (timing.mode === 'after_previous' && 'gate' in prev) {
      return { shown: { at: null, gate: prev.gate }, release: prev };
    }
    start = computeDueAt(timing, {
      ...anchors,
      previousCompletedAt: 'at' in prev ? prev.at : null,
    });
    if (start === null) {
      const gate = 'Needs a wedding date';
      return { shown: { at: null, gate }, release: { gate } };
    }
  }

  if (step.status === 'running') {
    return { shown: { at: later(start, now), gate: null }, release: behind(now.toISOString()) };
  }
  if (step.type === 'todo' || step.type === 'appointment') {
    return { shown: { at: start, gate: null }, release: { gate: `After you finish ${title}` } };
  }
  if (step.requires_approval) {
    // Its own date stays the stored one: that is when it asks for the OK.
    // A legacy Wait or branch still flagged is never claimed by the
    // engine either (`nextDueStep` filters every type), so it gates too.
    return { shown: { at: start, gate: null }, release: { gate: `After you OK ${title}` } };
  }
  if (step.type === 'wait') {
    const finish = waitFinish(step, start, anchors, quietWindow, now);
    if (finish === null) {
      const gate = `After ${title}, which cannot run`;
      return { shown: { at: null, gate }, release: { gate } };
    }
    return { shown: { at: finish, gate: null }, release: behind(finish) };
  }
  const run = later(start, now);
  return { shown: { at: run, gate: null }, release: behind(run) };
}

/**
 * When a Wait ends, exactly as the engine computes it.
 *
 * A `waiting` Wait already stored its wake. A pending one starts when
 * it comes due (or on the next tick, if that has passed), and its wake
 * is pushed out of quiet hours when it respects them. A wake at or
 * before the start finishes at once, with no quiet-hours push, which is
 * `evaluateWaitAction` returning `ok`. Null for a config the engine
 * would refuse.
 */
function waitFinish(
  step: ProjectionStep,
  start: string,
  anchors: InstanceAnchors,
  quietWindow: QuietHoursWindow | null,
  now: Date,
): string | null {
  const parsed = waitConfigSchema.safeParse(step.config ?? {});
  if (!parsed.success) return null;
  let wake: Date;
  if (step.status === 'waiting') {
    wake = new Date(start);
  } else {
    const begin = new Date(later(start, now));
    const eventDate = anchors.weddingDate;
    wake = computeWaitWakeAt(
      parsed.data as WaitActionConfig,
      { couple: eventDate === null ? null : { eventDate } },
      begin,
    );
    if (wake.getTime() <= begin.getTime()) return begin.toISOString();
  }
  // The same push the engine makes when the wait starts, and again at
  // wake-up (`quietHoursHoldUntil`); both land on the window's end.
  if (parsed.data.respectQuietHours && quietWindow) wake = nextAllowedSendAt(wake, quietWindow);
  return later(wake.toISOString(), now);
}
