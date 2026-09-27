/**
 * Bringing a paused or stopped workflow back without a retroactive burst.
 *
 * While an instance is not `active` the executor ignores it, so every
 * automated step whose time arrives in the meantime sits there overdue.
 * Flipping the instance back to `active` as-is would hand all of them to
 * the next tick at once: the couple gets a week of missed emails in one
 * minute, several of them no longer true. That is the same failure as a
 * past-dated step firing on apply (Dubsado's retroactive-fire gotcha).
 *
 * The rule, applied before the instance goes live again:
 *
 * - An `action` step the next tick would run is **skipped**, with an
 *   audit line naming why. Actions are the only step type with an effect
 *   outside the CRM, so they are the only ones that can "fire late".
 * - A `wait` that was already sleeping and whose wake time has passed is
 *   **completed**: its time genuinely elapsed, and it sends nothing.
 * - Whatever those two release is re-checked, so a zero-delay step
 *   straight after a skipped send (meant to go at the same moment) is
 *   skipped too. Anything with a real delay after it is anchored to the
 *   resume moment by the ordinary recompute and runs when that comes.
 * - A step held for the MC's OK is left alone: it never fires by itself.
 * - A `branch` that came due is **skipped with every step under it**
 *   (`descendantsOf` in `./apply-skips`). Left alone it would run on the
 *   next tick and its zero-delay lane would send at once; skipped on its
 *   own it would release both lanes, since a lane's head anchors to the
 *   branch's completion whatever its status.
 * - A `wait` that came due but had not started, and whose own date
 *   (`relative_to_event` or `until_date`) had already passed at the
 *   judging moment, is **skipped** (`isPastWait`). Started late, it would
 *   finish at once and release the send behind it. Any other unstarted
 *   wait is left for the next tick, and counts its duration from then.
 *
 * Skipping rather than rescheduling is deliberate. `recomputeDueDates`
 * cannot move a wedding-relative step "from the resume moment": its date
 * is fixed to the wedding, and the only way to stop it firing late is not
 * to fire it. Skipped also matches what Task 19 does for past-dated steps
 * on apply, so the MC sees one behaviour for one kind of problem.
 *
 * The account-wide stop (Task 18) lifts by the same rule, limited to the
 * steps that came due while it was on: {@link settleAccountPauseWindow}.
 * A fresh apply (Task 19) skips its past-dated steps by a stricter rule
 * that lives in `./apply-skips`, shared with the Start preview:
 * {@link settlePastOnApply}.
 *
 * @module lib/workflows/resume
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
import type { WorkflowInstanceRow, WorkflowStepRow } from '@/types/workflows';

import { isLiftedPauseBacklog, type AccountPauseState } from './account-pause';
import { descendantsOf, isPastWait, planApplySkips } from './apply-skips';
import { writeAudit } from './audit';
import { isExecutable, recomputeInstance } from './executor';
import { loadWeddingDateOrThrow } from './wedding-date';

/** What the instance is being resumed from, for the audit wording. */
export type ResumeFrom = 'paused' | 'cancelled';

/**
 * Why a step was skipped, shown in the activity feed. `account_paused`
 * is the account-wide stop (Task 18), which never changes the instance
 * itself but follows the same no-backlog rule when it lifts. `applied`
 * is a fresh apply whose wedding-anchored steps were already in the past
 * (Task 19).
 */
type SkipCause = ResumeFrom | 'account_paused' | 'applied' | 'with_branch';

/**
 * The reason written on each skipped step, shown in the activity feed as
 * "Skipped: <title> (<reason>)". `with_branch` is a step under a skipped
 * branch, whatever its own date: the branch's decision was never made.
 */
const SKIP_REASON: Record<SkipCause, string> = {
  paused: 'its time passed while the workflow was paused',
  cancelled: 'its time passed while the workflow was stopped',
  account_paused: 'its time passed while all workflows were paused',
  applied: 'its date had already passed when this workflow was started',
  with_branch: 'with its branch, whose date had passed',
};

/**
 * Skip or settle every step that would otherwise fire late on resume.
 *
 * Call this while the instance is still paused (or cancelled), before
 * flipping it to `active`. Done the other way round, a tick landing
 * between the flip and the skips could claim and send an overdue step.
 * Every write is guarded on the step's current status, so a concurrent
 * resume of the same instance cannot double-skip or double-audit.
 *
 * Fails closed: any read or write it cannot make throws, and the caller
 * must then not flip the instance live. Settling nothing because a read
 * came back empty would hand the whole backlog to the next tick.
 *
 * @param supabase - service-role client (audit rows are service-only)
 * @param instanceId - the instance about to be resumed
 * @param from - the state it is leaving, for the audit wording
 * @returns how many steps were skipped
 * @throws when a read or write fails
 */
export async function settleOverdueForResume(
  supabase: SupabaseClient<Database>,
  instanceId: string,
  from: ResumeFrom,
): Promise<number> {
  const { data: instanceRow, error } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle();
  if (error) throw new Error(`read instance to settle: ${error.message}`);
  const instance = instanceRow as unknown as WorkflowInstanceRow | null;
  // Gone (deleted under us): nothing to settle, and the flip that follows
  // finds nothing to flip either.
  if (!instance) return 0;
  return settleOverdue(supabase, instance, from, () => true, new Date());
}

/**
 * Skip what came due while the account-wide stop was on, now that it has
 * lifted, on one instance.
 *
 * The same rule as {@link settleOverdueForResume}, limited to steps whose
 * due time fell inside the stop's window and whose row was last written
 * before the lift (`isLiftedPauseBacklog`): a step due after the lift,
 * or dated after it, is on its own schedule and runs. The release
 * cascade below is unchanged. Called lazily by the executor when it meets
 * such a step, because sweeping every instance at lift time could time
 * out on a large account. The instance is active throughout (the account
 * stop never changes its status), so the executor must not run the step
 * it met until this returns.
 *
 * A date-wait is judged at the lift moment, not now: the lift is when
 * the stop's backlog was fixed, and a wait whose date fell after it is on
 * its own schedule however late the tick reaches it.
 *
 * @param supabase - service-role client
 * @param instance - an active instance of an MC whose stop has lifted
 * @param window - that MC's stop, with both ends set
 * @returns how many steps were skipped
 * @throws when a read or write fails; the executor then runs nothing
 *   more on the instance this pass
 */
export async function settleAccountPauseWindow(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  window: AccountPauseState,
): Promise<number> {
  return settleOverdue(
    supabase,
    instance,
    'account_paused',
    (step) => isLiftedPauseBacklog(window, step),
    new Date(window.resumedAt ?? Date.now()),
  );
}

/**
 * Would {@link settleAccountPauseWindow} act on this step? The
 * executor's question before it runs a due step of an MC whose stop has
 * lifted; it must agree with the settle exactly, or a step the settle
 * leaves alone would be deferred to it on every tick and never run.
 *
 * @param step - a due step the executor met
 * @param window - the MC's stop
 * @param weddingDate - read only for an unstarted wait, the one case
 *   that needs it; called lazily so the common case costs no read
 */
export async function isAccountPauseBacklog(
  step: WorkflowStepRow,
  window: AccountPauseState | undefined,
  weddingDate: () => Promise<string | null>,
): Promise<boolean> {
  if (!isLiftedPauseBacklog(window, step)) return false;
  if (step.type === 'action' || step.type === 'branch') return true;
  if (step.type !== 'wait') return false;
  if (step.status === 'waiting') return true;
  return isPastWait(step, await weddingDate(), new Date(window!.resumedAt!));
}

/**
 * Skip what a fresh apply would otherwise fire retroactively.
 *
 * The Dubsado gotcha: a twelve-month wedding workflow applied to a couple
 * whose wedding is three weeks away has every step dated before today
 * due on the next tick. The rule itself (which steps, and the release
 * cascade) lives in `./apply-skips` as a pure plan, because the Start
 * preview has to flag exactly the rows this skips: two copies of the
 * rule would drift, and the MC would be told one thing while the couple
 * got another. This function only writes the plan.
 *
 * Unlike a resume, nothing here completes a sleeping wait: a new
 * instance has none. A past branch is skipped with its whole subtree.
 *
 * Call it while the new instance is still paused, before it goes live,
 * for the same race reason as {@link settleOverdueForResume}. It throws
 * on any failed read or write, and `applyTemplate` then abandons the
 * instance rather than let it go live half settled.
 *
 * @param supabase - service-role client (audit rows are service-only)
 * @param instance - the new instance, steps inserted and dated
 * @param anchors - the wedding date and timezone the steps were dated with
 * @param now - the moment being judged; the wall clock outside tests
 * @returns how many steps were skipped
 * @throws when a read or write fails
 */
export async function settlePastOnApply(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  anchors: { weddingDate: string | null; timezone: string },
  now: Date = new Date(),
): Promise<number> {
  const steps = await loadSteps(supabase, instance.id);
  const plan = planApplySkips(steps, { ...anchors, appliedAt: instance.applied_at }, now);
  const planned = new Map(plan.steps.map((s) => [s.id, s]));
  const withBranch = new Set(plan.withBranchIds);

  let skipped = 0;
  for (const id of plan.skippedIds) {
    const step = planned.get(id);
    const cause: SkipCause = withBranch.has(id) ? 'with_branch' : 'applied';
    // The plan's copy carries the date a released follower was given, so
    // the audit line and the row both say when it would have gone.
    if (step && (await skipStep(supabase, instance, step, cause, step.due_at))) skipped += 1;
  }
  // Date what the skips released from their real completion times.
  if (skipped > 0) await recomputeInstance(supabase, instance);
  return skipped;
}

/**
 * The shared rule. `inScope` picks which overdue steps are backlog:
 * every one on a resume, only the stop's window after an account stop.
 * Steps released on the spot by the settling are backlog either way.
 * `judgedAt` is the moment a date-wait's own date is measured against.
 */
async function settleOverdue(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  from: SkipCause,
  inScope: (step: WorkflowStepRow) => boolean,
  judgedAt: Date,
): Promise<number> {
  const instanceId = instance.id;
  let steps = await loadSteps(supabase, instanceId);
  const weddingDate = await loadWeddingDateOrThrow(supabase, instance.couple_id);
  const now = new Date();
  /** Ids this settle has already closed, so a subtree is not judged twice. */
  const closed = new Set<string>();
  let skipped = 0;

  /**
   * Skip one step and, for a branch, everything under it. The subtree
   * goes only when the branch's own skip landed: a branch another caller
   * has just claimed and is running will choose a lane itself.
   */
  const skipOne = async (step: WorkflowStepRow, cause: SkipCause): Promise<boolean> => {
    if (closed.has(step.id)) return false;
    closed.add(step.id);
    if (!(await skipStep(supabase, instance, step, cause))) return false;
    skipped += 1;
    if (step.type === 'branch') {
      for (const child of descendantsOf(steps, step.id)) {
        if (closed.has(child.id)) continue;
        closed.add(child.id);
        if (await skipStep(supabase, instance, child, 'with_branch')) skipped += 1;
      }
    }
    return true;
  };

  /** Would a due, unstarted step send (or release a send) if left? */
  const sendsLate = (step: WorkflowStepRow): boolean =>
    step.type === 'action' ||
    step.type === 'branch' ||
    isPastWait(step, weddingDate, judgedAt);

  // First pass, on the rows as they stood during the pause. A sleeping
  // wait is completed on its real wake time; every other due step that
  // would send late is skipped.
  let changed = false;
  for (const step of steps) {
    if (closed.has(step.id)) continue;
    if (!isExecutable(step, now)) continue;
    if (!inScope(step)) continue;
    if (step.type === 'wait' && step.status === 'waiting') {
      closed.add(step.id);
      if (await settleWait(supabase, instance, step)) changed = true;
    } else if (sendsLate(step)) {
      if (await skipOne(step, from)) changed = true;
    }
  }

  // Release what those gated, then skip anything the release made due
  // on the spot. Only steps that had no date before this recompute are
  // candidates: a step that already had a future date is on its own
  // schedule, not part of the backlog. Bounded by the step count because
  // each pass either skips something new or stops.
  for (let pass = 0; changed && pass < steps.length; pass += 1) {
    const undated = new Set(steps.filter((s) => s.due_at === null).map((s) => s.id));
    await recomputeInstance(supabase, instance);
    steps = await loadSteps(supabase, instanceId);

    const released = steps.filter(
      (s) =>
        undated.has(s.id) &&
        !closed.has(s.id) &&
        isExecutable(s, new Date()) &&
        sendsLate(s),
    );
    changed = false;
    for (const step of released) {
      if (await skipOne(step, from)) changed = true;
    }
  }

  return skipped;
}

/** Every step of the instance. Throws when the read fails. */
async function loadSteps(
  supabase: SupabaseClient<Database>,
  instanceId: string,
): Promise<WorkflowStepRow[]> {
  // An empty list on a failed read would read as "nothing overdue", and
  // the instance would go live with its whole backlog due.
  const { data, error } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('instance_id', instanceId);
  if (error) throw new Error(`read steps to settle: ${error.message}`);
  return (data ?? []) as unknown as WorkflowStepRow[];
}

/**
 * Mark one overdue step skipped and say why. True if this call did it.
 *
 * `dueAt`, given only by an apply, also writes the date a released
 * follower was planned for: it was undated in the table, and a skipped
 * step is never re-dated afterwards.
 */
async function skipStep(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
  from: SkipCause,
  dueAt?: string | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('workflow_steps')
    .update({
      status: 'skipped',
      completed_at: new Date().toISOString(),
      ...(dueAt !== undefined ? { due_at: dueAt } : {}),
    })
    .eq('id', step.id)
    .in('status', ['pending', 'waiting'])
    .select('id, due_at');
  // A failed write is not a lost race: the step is still due, and going
  // live now would send it. Zero rows is the race, and is fine.
  if (error) throw new Error(`skip step ${step.id}: ${error.message}`);
  const row = data?.length === 1 ? data[0] : undefined;
  if (!row) return false;
  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId: instance.id,
    stepId: step.id,
    coupleId: instance.couple_id,
    event: 'step_skipped',
    // The date as stored, so the feed and the row agree to the character.
    detail: { reason: SKIP_REASON[from], dueAt: row.due_at },
  });
  return true;
}

/**
 * Complete a sleeping wait whose wake time has passed. True if this call
 * did it. Written exactly as the executor completes one, so the feed
 * reads the same whichever path finished it.
 */
async function settleWait(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('workflow_steps')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', step.id)
    .eq('status', 'waiting')
    .select('id');
  if (error) throw new Error(`settle wait ${step.id}: ${error.message}`);
  if ((data?.length ?? 0) !== 1) return false;
  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId: instance.id,
    stepId: step.id,
    coupleId: instance.couple_id,
    event: 'step_completed',
    detail: { type: 'wait' },
  });
  return true;
}
