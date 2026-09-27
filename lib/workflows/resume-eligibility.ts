/**
 * Can this workflow be put back into play?
 *
 * One rule for two readers: `resumeInstanceAction` refuses with these
 * words, and the couple tab uses the same answer to decide whether to
 * offer Resume at all or to show the reason instead. Two copies would
 * drift, and the MC would press a button the server then refuses.
 *
 * Pure: no database, no React.
 *
 * @module lib/workflows/resume-eligibility
 */

/** The instance fields the rule reads. */
export interface ResumeCandidate {
  status: string;
  paused_reason: string | null;
  cancelled_reason: string | null;
  template_id: string | null;
  /** The status of its template, or null when the template is gone. */
  template_status: string | null;
}

/**
 * Why this instance cannot be resumed, in the MC's words, or null when it
 * can.
 *
 * Resumable: a paused instance with a reason (the MC's pause, or Turn
 * off), and a cancelled one the MC stopped, including an old stop with no
 * reason recorded, as long as its workflow still exists and is on.
 *
 * The workflow-is-on check here is the early, worded refusal. The flip
 * itself (`resume_workflow_instance`, 20261011100000) checks it again in
 * the same statement, so a Turn off landing in between still wins.
 *
 * @param instance - the instance as loaded
 * @returns the refusal, or null
 */
export function resumeRefusal(instance: ResumeCandidate): string | null {
  const { status, paused_reason, cancelled_reason, template_id } = instance;
  if (status !== 'paused' && status !== 'cancelled') {
    return 'Only a paused or stopped workflow can be resumed.';
  }
  // Paused with no reason is an apply still building this instance (or
  // one that died, which the tick will cancel): half built and not yet
  // settled, so putting it live could send what the apply would skip.
  if (status === 'paused' && paused_reason === null) {
    return 'This workflow is still being set up. Try again in a moment.';
  }
  // The apply that built it failed part way, so steps may be missing or
  // undated. Resuming would run a workflow nobody designed.
  if (status === 'cancelled' && cancelled_reason === 'setup_interrupted') {
    return 'Its setup did not finish, so some steps may be missing. Start it again instead.';
  }
  // The template is gone (its FK is set null on delete), whatever the
  // stop's reason: a workflow stopped by hand and deleted afterwards keeps
  // `manual`, because the delete only sweeps running and paused couples.
  // Resumed, it would run with no workflow-level switch left to stop it.
  if (template_id === null) {
    return 'Its workflow was deleted, so it cannot be resumed.';
  }
  // The WF001 guard stops new enrolments on an off workflow, not a
  // resume. Turning it back on is what resumes the couples it paused.
  if (instance.template_status !== 'active') {
    return 'Turn this workflow on first, then resume it.';
  }
  return null;
}

/** The instance fields {@link hasLiveTwin} reads. */
export interface TwinCandidate {
  id: string;
  couple_id: string | null;
  dedupe_key: string | null;
  status: string;
}

/**
 * Is the same workflow running (or paused) on this couple again, in
 * another instance?
 *
 * Mirrors the dedupe index: one live enrolment per couple and
 * `dedupe_key`, where live means not `cancelled`. A stopped workflow with
 * a twin cannot be resumed; the flip would violate the index. A null key
 * never collides.
 *
 * @param instance - the stopped instance
 * @param others - the couple's instances (the instance itself may be among them)
 */
export function hasLiveTwin(instance: TwinCandidate, others: readonly TwinCandidate[]): boolean {
  if (!instance.dedupe_key || !instance.couple_id) return false;
  return others.some(
    (other) =>
      other.id !== instance.id &&
      other.couple_id === instance.couple_id &&
      other.dedupe_key === instance.dedupe_key &&
      other.status !== 'cancelled',
  );
}
