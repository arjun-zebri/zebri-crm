/**
 * Nudges: the one line a couple's profile should be telling the MC.
 *
 * A checklist shows what is there. A nudge shows what is *wrong* with
 * what is there, which is the thing an MC juggling forty couples cannot
 * see by scrolling. Every rule below answers a question an MC has asked
 * themselves at 11pm: has anything failed, is anything waiting on me, is
 * this wedding close with work still open, and is this couple running
 * any process at all.
 *
 * Pure. The caller supplies facts; this decides what is worth saying.
 * That split is what lets the couple profile, the digest email and the
 * tests all agree without three copies of the rules.
 *
 * @module lib/workflows/nudges
 */

import type { StepStatus, StepType, StepTiming } from '@/types/workflows';

/** How loudly a nudge should read. */
export type NudgeTone = 'danger' | 'warning' | 'info';

/** One thing worth telling the MC about a couple. */
export interface Nudge {
  /** Stable key, so a list of these can be rendered and dismissed. */
  id: string;
  tone: NudgeTone;
  message: string;
}

/** The subset of a step the rules read. */
export interface NudgeStep {
  title: string;
  type: StepType;
  status: StepStatus;
  dueAt: string | null;
  requiresApproval: boolean;
  timing: StepTiming;
}

/** Everything the rules need to know about one couple. */
export interface NudgeFacts {
  /** The couple's wedding date as `YYYY-MM-DD`, or null if unknown. */
  weddingDate: string | null;
  /** Today in the MC's zone, as `YYYY-MM-DD`. */
  todayLocal: string;
  /** Steps across every active workflow on this couple. */
  steps: NudgeStep[];
  /** Whether any non-default workflow is running. */
  hasActiveWorkflow: boolean;
}

/** Whole days between two `YYYY-MM-DD` strings. */
function dayDelta(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** `n thing` or `n things`. */
function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * What this couple's workflow is trying to tell the MC, most urgent
 * first. An empty array is the good case and should render nothing.
 */
export function detectNudges(facts: NudgeFacts): Nudge[] {
  const nudges: Nudge[] = [];
  const open = facts.steps.filter(
    (s) => s.status === 'pending' || s.status === 'waiting',
  );

  const errored = facts.steps.filter((s) => s.status === 'errored');
  if (errored.length > 0) {
    nudges.push({
      id: 'errored',
      tone: 'danger',
      message:
        errored.length === 1
          ? `"${errored[0]!.title}" failed and has not run. Open it to try again.`
          : `${count(errored.length, 'step')} failed and have not run.`,
    });
  }

  const awaitingReview = open.filter(
    (s) => s.requiresApproval && s.dueAt !== null && s.dueAt.slice(0, 10) <= facts.todayLocal,
  );
  if (awaitingReview.length > 0) {
    nudges.push({
      id: 'review',
      tone: 'warning',
      message: `${count(awaitingReview.length, 'message')} waiting for your OK before it sends.`,
    });
  }

  const overdue = open.filter(
    (s) =>
      s.status === 'pending' &&
      s.dueAt !== null &&
      s.dueAt.slice(0, 10) < facts.todayLocal,
  );
  if (overdue.length > 0) {
    nudges.push({
      id: 'overdue',
      tone: 'warning',
      message: `${count(overdue.length, 'step')} overdue.`,
    });
  }

  // A wedding-relative step with no wedding date never gets a due date,
  // so it silently never happens. This is the quietest failure in the
  // whole engine and the one worth shouting about.
  const unanchored = open.filter((s) => s.timing.mode === 'wedding_relative');
  if (facts.weddingDate === null && unanchored.length > 0) {
    nudges.push({
      id: 'no-wedding-date',
      tone: 'warning',
      message: `${count(unanchored.length, 'step')} anchored to the wedding date, which is not set yet. They will not come due until it is.`,
    });
  }

  if (facts.weddingDate !== null) {
    const days = dayDelta(facts.todayLocal, facts.weddingDate);
    if (days >= 0 && days <= 21 && open.length > 0) {
      nudges.push({
        id: 'wedding-close',
        tone: days <= 7 ? 'warning' : 'info',
        message:
          days === 0
            ? `The wedding is today and ${count(open.length, 'step')} still open.`
            : `The wedding is in ${count(days, 'day')} and ${count(open.length, 'step')} still open.`,
      });
    }
  }

  if (!facts.hasActiveWorkflow && facts.steps.length === 0) {
    nudges.push({
      id: 'no-workflow',
      tone: 'info',
      message: 'No workflow running for this couple yet.',
    });
  }

  return nudges;
}
