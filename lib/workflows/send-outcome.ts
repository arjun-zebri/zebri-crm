/**
 * The partial-send warning, derived from a step's output.
 *
 * A step that mails several people and fails on some of them still
 * finishes `done` (audit M6): erroring it would make the executor, or the
 * MC's Try again, re-run the whole step and send a second copy to
 * everyone it already reached. There is deliberately no status for it
 * either, since a new status would ripple through recompute, the
 * after-previous release and every status switch. So the send actions
 * record `sent`, `failed` and `last_error` in the output, and every
 * surface that would otherwise show a green tick (the couple's checklist
 * row, the step detail, the activity feed) asks this module instead.
 *
 * Each failed couple-facing recipient also has its own `failed` row in
 * the couple's Emails tab (Task 30), with the transport's reason, so the
 * MC can see exactly who missed out. The one exception is a copy to the
 * MC themselves (`generate_run_sheet_pdf`'s own copy): it counts here but
 * writes no row, since it is not a message to the couple.
 *
 * Pure, no React: shared by client components and the narration module.
 *
 * @module lib/workflows/send-outcome
 */

/** A send step that reached some of its recipients and not others. */
export interface PartialSendFailure {
  /** Messages that went out. */
  sent: number;
  /** Messages the transport refused or that errored. */
  failed: number;
  /** The last transport error, as the provider worded it, or null. */
  reason: string | null;
}

/** A finite, non-negative whole count, else null. */
function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Read the partial-send warning off a step's output.
 *
 * Null unless the output records at least one failed recipient. `sent`
 * is read as a count only: the single-recipient actions write
 * `sent: true`, and they never report a partial failure, so a
 * non-numeric `sent` alongside a failure counts as none sent.
 *
 * @param output - `workflow_steps.output`, or a `step_completed` audit
 *   row's `detail` (the executor writes the same object to both).
 */
export function partialSendFailure(output: unknown): PartialSendFailure | null {
  if (typeof output !== 'object' || output === null || Array.isArray(output)) return null;
  const record = output as Record<string, unknown>;
  const failed = count(record['failed']);
  if (!failed) return null;
  const reason = record['last_error'];
  return {
    sent: count(record['sent']) ?? 0,
    failed,
    reason: typeof reason === 'string' && reason.trim().length > 0 ? reason : null,
  };
}

/**
 * How many of `steps` are done sends that reached only some recipients.
 * Feeds the collapsed Done strip's header and the Workflow tab's stat
 * line, so the warning is visible without opening anything (review I1).
 */
export function countPartialSends(steps: ReadonlyArray<{ status: string; output: unknown }>): number {
  return steps.filter((s) => s.status === 'done' && partialSendFailure(s.output) !== null).length;
}

/** "Sent to 1 of 2, 1 failed". The reason is left to the caller to place. */
export function partialSendFailureLabel(failure: PartialSendFailure): string {
  return `Sent to ${failure.sent} of ${failure.sent + failure.failed}, ${failure.failed} failed`;
}
