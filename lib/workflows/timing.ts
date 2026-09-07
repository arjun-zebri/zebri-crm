/**
 * Step timing: when each step in an applied workflow comes due.
 *
 * Three anchors, one per {@link StepTiming} mode:
 *
 * - `wedding_relative` and `apply_relative` resolve to **local midnight**
 *   on a shifted calendar date. They do not gate on anything, which is
 *   what lets "2 weeks before the wedding" appear in the queue while
 *   earlier to-dos are still open.
 * - `after_previous` resolves to the predecessor's completion **instant**
 *   plus a delay, and is `null` until that predecessor finishes. That null
 *   is the gating mechanism: an automated step anchored to a manual to-do
 *   has no `due_at`, so the executor never picks it up, until the MC ticks
 *   the to-do.
 *
 * Never hand-roll date or hour arithmetic on instants here. Compose
 * `zonedTimeToUtc`, `addDaysToDateString` and `addMonthsToDateString` from
 * `lib/scheduling/timezone`. The Scheduler build found six timezone bugs,
 * every one of them from arithmetic that looked right in UTC.
 *
 * @module lib/workflows/timing
 */

import {
  addDaysToDateString,
  addMonthsToDateString,
  zonedDateParts,
  zonedTimeToUtc,
} from '@/lib/scheduling/timezone';
import type { StepTiming, WorkflowStepRow } from '@/types/workflows';

/** Everything a step needs to resolve its own due date. */
export interface TimingAnchors {
  /** The couple's wedding date as `YYYY-MM-DD`, or null if unknown. */
  weddingDate: string | null;
  /** When the workflow was applied, as an ISO instant. */
  appliedAt: string;
  /** When the predecessor step completed, or null if it has not. */
  previousCompletedAt: string | null;
  /** IANA zone the MC works in. Local midnight is resolved in this zone. */
  timezone: string;
}

/** The subset of anchors that is the same for every step in an instance. */
export type InstanceAnchors = Omit<TimingAnchors, 'previousCompletedAt'>;

/** One row of the patch {@link recomputeDueDates} returns. */
export interface DueDatePatch {
  id: string;
  due_at: string | null;
}

/** Statuses that mean a step will not run again and should not be rescheduled. */
const TERMINAL: ReadonlySet<string> = new Set(['done', 'skipped', 'errored']);

/** Statuses that release the step gated behind this one. */
const RELEASES_NEXT: ReadonlySet<string> = new Set(['done', 'skipped']);

/** Shift a `YYYY-MM-DD` date string by an amount in the given unit. */
function shiftDate(
  date: string,
  amount: number,
  unit: 'days' | 'weeks' | 'months',
): string {
  if (unit === 'months') return addMonthsToDateString(date, amount);
  return addDaysToDateString(date, unit === 'weeks' ? amount * 7 : amount);
}

/**
 * Local midnight on `date` in `timezone`, as an ISO instant.
 *
 * Exported because anything turning a plain `YYYY-MM-DD` into a due
 * instant has to do it in the MC's zone; a `new Date(date)` parse is a
 * UTC midnight, which lands an Australian to-do on the previous day.
 */
export function localMidnight(date: string, timezone: string): string {
  return zonedTimeToUtc(date, '00:00', timezone).toISOString();
}

/**
 * When a single step comes due, or null when it is not schedulable yet.
 *
 * @param timing - the step's own timing config
 * @param anchors - the instance's anchors plus this step's predecessor
 * @returns an ISO instant, or null when the step is gated or unanchored
 */
export function computeDueAt(
  timing: StepTiming,
  anchors: TimingAnchors,
): string | null {
  switch (timing.mode) {
    case 'wedding_relative': {
      // A couple with no wedding date cannot anchor to one. The step stays
      // unscheduled rather than guessing a date.
      if (!anchors.weddingDate) return null;
      const signed = timing.direction === 'before' ? -timing.amount : timing.amount;
      const shifted = shiftDate(anchors.weddingDate, signed, timing.unit);
      return localMidnight(shifted, anchors.timezone);
    }
    case 'apply_relative': {
      // Count calendar days from the LOCAL date the workflow was applied,
      // not from the instant: "3 days after booking" means three sleeps,
      // not 72 hours.
      const appliedLocalDate = zonedDateParts(
        new Date(anchors.appliedAt),
        anchors.timezone,
      ).date;
      const shifted = shiftDate(appliedLocalDate, timing.amount, timing.unit);
      return localMidnight(shifted, anchors.timezone);
    }
    case 'after_previous': {
      if (!anchors.previousCompletedAt) return null;
      // Instant arithmetic, deliberately: "2 days after that happened"
      // rather than "on the calendar day two days later".
      const ms = timing.unit === 'hours' ? 3_600_000 : 86_400_000;
      const base = new Date(anchors.previousCompletedAt).getTime();
      return new Date(base + timing.delayAmount * ms).toISOString();
    }
  }
}

/** Group key identifying the ordered list a step belongs to. */
function laneKey(step: WorkflowStepRow): string {
  return `${step.parent_step_id ?? 'root'}::${step.branch_path ?? ''}`;
}

/**
 * Recompute `due_at` for every non-terminal step in one instance.
 *
 * Steps are walked lane by lane, a lane being the top-level list or one
 * side of a branch. Within a lane, each step's predecessor is the previous
 * sibling; the first step in a branch lane anchors to the branch step
 * itself, and the first top-level step anchors to the apply instant so a
 * workflow actually starts.
 *
 * Terminal steps are left out of the returned patch: their `due_at` is
 * history, and rewriting it would move dates the MC has already acted on.
 *
 * @param steps - every step in the instance, in any order
 * @param anchors - the instance-wide anchors
 * @returns one patch row per step whose `due_at` should be written
 */
export function recomputeDueDates(
  steps: WorkflowStepRow[],
  anchors: InstanceAnchors,
): DueDatePatch[] {
  const byId = new Map(steps.map((s) => [s.id, s]));

  const lanes = new Map<string, WorkflowStepRow[]>();
  for (const step of steps) {
    const key = laneKey(step);
    const lane = lanes.get(key);
    if (lane) lane.push(step);
    else lanes.set(key, [step]);
  }
  for (const lane of lanes.values()) {
    lane.sort((a, b) => a.position - b.position);
  }

  const patch: DueDatePatch[] = [];

  for (const lane of lanes.values()) {
    for (let i = 0; i < lane.length; i += 1) {
      const step = lane[i]!;
      if (TERMINAL.has(step.status)) continue;

      const previous = i > 0 ? lane[i - 1] : undefined;
      const previousCompletedAt = previous
        ? // Skipped counts as completed: skipping a to-do must not strand
          // every step below it.
          RELEASES_NEXT.has(previous.status)
          ? previous.completed_at
          : null
        : // Head of the lane. A branch child anchors to its branch step;
          // a top-level head anchors to the apply instant.
          step.parent_step_id
          ? (byId.get(step.parent_step_id)?.completed_at ?? null)
          : anchors.appliedAt;

      patch.push({
        id: step.id,
        due_at: computeDueAt(step.timing, { ...anchors, previousCompletedAt }),
      });
    }
  }

  return patch;
}
