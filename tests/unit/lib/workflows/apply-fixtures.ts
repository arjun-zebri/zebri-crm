/**
 * Shared fixtures for the apply-time skip rule and its preview.
 *
 * One clock and one wedding for both suites, so the projection and the
 * real `settlePastOnApply` are judged on exactly the same case.
 */
import type { Json } from '@/types/database';
import type { StepTiming, StepType, WorkflowStepRow } from '@/types/workflows';

/** The apply moment: noon in Sydney on 24 September 2026. */
export const NOW = new Date('2026-09-24T02:00:00Z');
export const TZ = 'Australia/Sydney';
/** Three weeks after {@link NOW}. */
export const WEDDING = '2026-10-15';

export const weddingBefore = (
  amount: number,
  unit: 'days' | 'weeks' | 'months',
): StepTiming => ({ mode: 'wedding_relative', direction: 'before', amount, unit });

export const afterPrevious = (delayAmount: number): StepTiming => ({
  mode: 'after_previous',
  delayAmount,
  unit: 'days',
});

export const onStart: StepTiming = { mode: 'apply_relative', amount: 0, unit: 'days' };

const SEND: Json = { actionType: 'send_email', subject: 'Hi', body: 'Hi' };

/** An undated, pending step as `applyTemplate` inserts it. */
export function draft(
  id: string,
  position: number,
  timing: StepTiming,
  over: Partial<WorkflowStepRow> = {},
): WorkflowStepRow {
  const type = (over.type ?? 'action') as StepType;
  return {
    id,
    instance_id: 'inst-1',
    template_step_id: null,
    position,
    type,
    config: type === 'action' ? SEND : {},
    title: id,
    description: null,
    timing,
    due_at: null,
    parent_step_id: null,
    branch_path: null,
    status: 'pending',
    requires_approval: false,
    visible_to_couple: false,
    approval_token: null,
    approval_expires_at: null,
    completed_at: null,
    error_message: null,
    output: null,
    attempt_count: 0,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...over,
  };
}

/**
 * Every arm of the rule in one workflow, wedding three weeks out:
 * the ids starting `skip-` are exactly the ones the apply must skip.
 */
export function everyArm(): WorkflowStepRow[] {
  return [
    // Timed from the apply: resolves to midnight today, still sends.
    draft('send-now', 0, onStart),
    draft('skip-six-months', 1, weddingBefore(6, 'months')),
    // Zero-delay follower of a skipped send: skipped with it.
    draft('skip-same-moment', 2, afterPrevious(0)),
    // A real delay after the skip: not skipped. It waits for "send-now"
    // above, which has not run at the apply (owner ruling 2026-09-27).
    draft('two-days-after', 3, afterPrevious(2)),
    // A wait whose own date (eight weeks before) is already gone.
    draft('skip-past-wait', 4, onStart, {
      type: 'wait',
      config: {
        mode: 'relative_to_event',
        relative: { amount: 8, unit: 'weeks', direction: 'before', anchor: 'event_date' },
      },
    }),
    draft('skip-after-wait', 5, afterPrevious(0)),
    // Held for the MC's OK: never fires by itself, so never skipped.
    draft('approval-past', 6, weddingBefore(3, 'months'), { requires_approval: true }),
    // A to-do is the MC's to tick, whatever its date.
    draft('todo-past', 7, weddingBefore(2, 'months'), { type: 'todo', config: {} }),
    draft('week-out', 8, weddingBefore(1, 'weeks')),
  ];
}

const BRANCH_CONFIG: Json = { predicate: { kind: 'has_signed_contract' } };
const WAIT_60_BEFORE: Json = {
  mode: 'relative_to_event',
  relative: { amount: 60, unit: 'days', direction: 'before', anchor: 'event_date' },
};

/**
 * The whole-phase review's shape (Phase 3 fix wave, I1), wedding three
 * weeks out, plus a branch still ahead for contrast. The ids starting
 * `skip-` are exactly the ones the apply must skip: the past branch, all
 * of its subtree (including a lane step still in the future, and a nested
 * branch's lane), the past wait it releases and the send behind that.
 */
export function pastBranchArm(): WorkflowStepRow[] {
  return [
    draft('skip-branch', 0, weddingBefore(3, 'months'), { type: 'branch', config: BRANCH_CONFIG }),
    draft('skip-lane-yes', 0, afterPrevious(0), { parent_step_id: 'skip-branch', branch_path: 'yes' }),
    draft('skip-lane-yes-later', 1, weddingBefore(1, 'weeks'), {
      parent_step_id: 'skip-branch',
      branch_path: 'yes',
    }),
    draft('skip-nested-branch', 0, afterPrevious(0), {
      type: 'branch',
      config: BRANCH_CONFIG,
      parent_step_id: 'skip-branch',
      branch_path: 'no',
    }),
    draft('skip-nested-lane', 0, afterPrevious(0), {
      parent_step_id: 'skip-nested-branch',
      branch_path: 'yes',
    }),
    draft('skip-wait-60', 1, afterPrevious(0), { type: 'wait', config: WAIT_60_BEFORE }),
    draft('skip-last-send', 2, afterPrevious(0)),
    // A week out: still ahead, so it and its lane run when it comes.
    draft('future-branch', 3, weddingBefore(1, 'weeks'), { type: 'branch', config: BRANCH_CONFIG }),
    draft('future-lane', 0, afterPrevious(0), { parent_step_id: 'future-branch', branch_path: 'yes' }),
  ];
}
