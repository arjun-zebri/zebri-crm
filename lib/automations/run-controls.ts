/**
 * Pure helpers for the couple Automations tab's run controls.
 *
 * Kept React-free and side-effect-free so the resume-state logic —
 * the one genuinely subtle bit — is unit-testable without a database.
 * The server actions in `app/(dashboard)/automations/actions.ts` do
 * the IO; this module just decides the target state.
 *
 * @module lib/automations/run-controls
 */

/**
 * Decide the resume target for each paused run.
 *
 * Pausing collapses both `running` and `waiting` runs into `paused`,
 * losing the distinction. To resume correctly we re-derive it: a run
 * that still has an **unconsumed wait** must go back to `waiting` (the
 * wait/wake machinery keeps owning it and fires the scheduled step on
 * time); every other paused run goes to `running` so the next tick
 * advances it. Resuming everything to `running` would skip pending
 * waits and double-fire scheduled steps.
 *
 * @param pausedIds - ids of the runs currently `paused`
 * @param stillWaitingIds - ids (subset) that still have an unconsumed wait
 * @returns the run ids to flip to each state
 */
export function partitionResume(
  pausedIds: readonly string[],
  stillWaitingIds: Iterable<string>,
): { toWaiting: string[]; toRunning: string[] } {
  const waiting = new Set(stillWaitingIds)
  return {
    toWaiting: pausedIds.filter((id) => waiting.has(id)),
    toRunning: pausedIds.filter((id) => !waiting.has(id)),
  }
}
