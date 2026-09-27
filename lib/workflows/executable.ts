/**
 * The executor's "is this step ready to run?" decision, on its own.
 *
 * Pure and dependency-light so the apply-time skip rule
 * (`./apply-skips`) and the Start preview can ask exactly the question
 * the executor asks without importing the executor, which would close an
 * import cycle through `./resume`. `./executor` re-exports it, so every
 * existing caller is unchanged.
 *
 * @module lib/workflows/executable
 */

import type { WorkflowStepRow } from '@/types/workflows';

import { isAutomated } from './steps';

/**
 * Statuses a step can no longer move on from. `cancelled` belongs here: a
 * stopped workflow's step must never run, even if some path left its
 * instance active (a resume passes through that state).
 */
const TERMINAL: ReadonlySet<string> = new Set(['done', 'skipped', 'errored', 'cancelled']);

/**
 * Is this step ready to run right now?
 *
 * Pure, and exported so the decision can be tested without a database.
 * Every clause here is load-bearing:
 *
 * - a null `due_at` means gated behind an unfinished predecessor
 * - manual types are the MC's to tick, never the engine's to run
 * - an approval gate holds until the approval is recorded
 *
 * @param step - the step as it stands
 * @param now - the moment being judged
 * @returns true when the executor would claim and run it at `now`
 */
export function isExecutable(step: WorkflowStepRow, now: Date): boolean {
  if (TERMINAL.has(step.status)) return false;
  if (step.status === 'running') return false;
  if (!isAutomated(step.type)) return false;
  if (step.due_at === null) return false;
  if (new Date(step.due_at).getTime() > now.getTime()) return false;
  // An approval gate that has been issued but not answered stays put. The
  // approval flow clears requires_approval when it is granted.
  if (step.requires_approval) return false;
  return true;
}
