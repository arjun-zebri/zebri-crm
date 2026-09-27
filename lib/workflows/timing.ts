/**
 * Step timing: when each step in an applied workflow comes due.
 *
 * Three anchors, one per mode, and one sub-case:
 *
 * - `wedding_relative` and `apply_relative` resolve to **local midnight,
 *   or the step's `sendTime`,** on a shifted calendar date. They do not
 *   gate on anything, which is what lets "2 weeks before the wedding"
 *   appear in the queue while earlier to-dos are still open.
 * - `after_previous` resolves to the predecessor's completion **instant**
 *   plus a delay, and is `null` until that predecessor finishes. That null
 *   is the gating mechanism: an automated step anchored to a manual to-do
 *   has no `due_at`, so the executor never picks it up, until the MC ticks
 *   the to-do.
 * - `apply_relative` in minutes or hours is an instant offset from the
 *   apply moment, like `after_previous`.
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

/**
 * Statuses that mean a step will not run again and should not be
 * rescheduled. A `cancelled` step keeps the date it had when its workflow
 * stopped: a resume restores it to `pending` first and only then lets the
 * recompute date it.
 */
const TERMINAL: ReadonlySet<string> = new Set(['done', 'skipped', 'errored', 'cancelled']);

/**
 * Statuses that release the step gated behind this one. Not `cancelled`:
 * a stopped step releases nothing, or the step after it would come due.
 * Exported for `./release`, which asks the same question of one step.
 */
export const RELEASES_NEXT: ReadonlySet<string> = new Set(['done', 'skipped']);

/** Shift a `YYYY-MM-DD` date string by an amount in the given unit. */
function shiftDate(
  date: string,
  amount: number,
  unit: 'days' | 'weeks' | 'months',
): string {
  if (unit === 'months') return addMonthsToDateString(date, amount);
  return addDaysToDateString(date, unit === 'weeks' ? amount * 7 : amount);
}

/** Milliseconds per delay unit; delays are instant arithmetic by design. */
const MS_PER_DELAY_UNIT = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;

/**
 * `time` (or midnight) on `date` in `timezone`, as an ISO instant.
 *
 * Resolved in the zone on that calendar day, so a 9am step keeps being
 * 9am on the wall clock across a daylight-saving switch.
 */
function localTime(date: string, time: string | undefined, timezone: string): string {
  return zonedTimeToUtc(date, time ?? '00:00', timezone).toISOString();
}

/**
 * Local midnight on `date` in `timezone`, as an ISO instant.
 *
 * Exported because anything turning a plain `YYYY-MM-DD` into a due
 * instant has to do it in the MC's zone; a `new Date(date)` parse is a
 * UTC midnight, which lands an Australian to-do on the previous day.
 */
export function localMidnight(date: string, timezone: string): string {
  return localTime(date, undefined, timezone);
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
      return localTime(shifted, timing.sendTime, anchors.timezone);
    }
    case 'apply_relative': {
      // A sub-day delay is "this long after it was applied", an instant.
      // A calendar delay counts LOCAL days from the apply date: "3 days
      // after booking" means three sleeps, not 72 hours.
      if (timing.unit === 'minutes' || timing.unit === 'hours') {
        const base = new Date(anchors.appliedAt).getTime();
        return new Date(base + timing.amount * MS_PER_DELAY_UNIT[timing.unit]).toISOString();
      }
      const appliedLocalDate = zonedDateParts(
        new Date(anchors.appliedAt),
        anchors.timezone,
      ).date;
      const shifted = shiftDate(appliedLocalDate, timing.amount, timing.unit);
      return localTime(shifted, timing.sendTime, anchors.timezone);
    }
    case 'after_previous': {
      if (!anchors.previousCompletedAt) return null;
      // Instant arithmetic, deliberately: "2 days after that happened"
      // rather than "on the calendar day two days later".
      const base = new Date(anchors.previousCompletedAt).getTime();
      return new Date(base + timing.delayAmount * MS_PER_DELAY_UNIT[timing.unit]).toISOString();
    }
  }
}

/**
 * Is this step held by the MC ("Take the date off")? Held steps are left
 * out of the recompute's patch, so their `due_at` stays null.
 */
export function isHeld(step: Pick<WorkflowStepRow, 'due_held_at'>): boolean {
  return step.due_held_at !== null && step.due_held_at !== undefined;
}

/** Group key identifying the ordered list a step belongs to. */
function laneKey(step: WorkflowStepRow): string {
  return `${step.parent_step_id ?? 'root'}::${step.branch_path ?? ''}`;
}

/** When a branch releases its lane heads: its completion, if it is done. */
function branchReleaseAt(branch: WorkflowStepRow | undefined): string | null {
  return branch?.status === 'done' ? branch.completed_at : null;
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
 * So are held steps ({@link isHeld}): the MC took their date off, and
 * only the MC puts one back.
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
    const head = lane[0];
    // The instant everything above the current step settled, or null
    // while something above is still open. Head of the lane: a branch
    // child anchors to its branch step, and only once that branch is
    // `done`: a done branch picked a lane (the other side is skipped
    // with it), while a skipped branch picked none, so dating its lanes
    // from the skip would run both (Task 36 fix round 2, re-review N3).
    // A top-level head anchors to the apply instant.
    let released: string | null = head?.parent_step_id
      ? branchReleaseAt(byId.get(head.parent_step_id))
      : anchors.appliedAt;

    for (const step of lane) {
      // The MC took a held step's date off. A null date alone looked
      // exactly like a step waiting on its predecessor, so every
      // recompute (a sibling ticked, the heal, a resume) put the date back
      // and the executor sent what the MC had held. The hold is recorded
      // instead, and only the MC setting a date lifts it. It still gates
      // the steps behind it: it is pending, so it releases nothing.
      if (!TERMINAL.has(step.status) && !isHeld(step)) {
        patch.push({
          id: step.id,
          due_at: computeDueAt(step.timing, { ...anchors, previousCompletedAt: released }),
        });
      }
      released = releasedAfter(step, released);
    }
  }

  return patch;
}

/**
 * What a step hands the step behind it: the instant the lane settled
 * through it, or null while anything up to it is still open.
 *
 * Release is transitive up the lane. A to-do the MC ticked early, while
 * a send above it was still behind a Wait, used to date the send below
 * it from the tick, so that send went out before the one above it
 * (owner report, 2026-09-27). The MC may still tick early; the step
 * behind simply waits until the chain above has finished too, and is
 * dated from whichever finished last.
 *
 * Skipped counts as finished: skipping a to-do must not strand every
 * step below it. The rule is the same behind a wedding- or apply-dated
 * step: that step still runs on its own date, but the step behind it
 * waits for everything above too (owner ruling, 2026-09-27).
 */
function releasedAfter(step: WorkflowStepRow, above: string | null): string | null {
  if (!RELEASES_NEXT.has(step.status) || step.completed_at === null) return null;
  // The same for a wedding- or apply-dated step (owner ruling,
  // 2026-09-27): it runs on its own date whatever is open above it, but
  // finishing it does not release the step behind it past an earlier
  // step that is still open.
  return above === null ? null : laterInstant(above, step.completed_at);
}

/** The later of two ISO instants, compared as instants, not strings. */
function laterInstant(a: string, b: string): string {
  return new Date(a).getTime() > new Date(b).getTime() ? a : b;
}
