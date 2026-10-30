/**
 * The step executor.
 *
 * The second half of the tick. Where the old runner tracked one
 * `current_action_id` per run and walked forward, this queries for **due
 * steps** across every active instance. Manual step types are excluded
 * from that query by design: a `todo` simply sits there being overdue
 * until the MC ticks it, and everything anchored after it stays
 * unschedulable. That is how manual and automated steps coexist in one
 * ordered list.
 *
 * {@link completeStep} is the other half of the same mechanism and is
 * what the couple-profile checkbox calls. Ticking a step through a bare
 * `update({ status: 'done' })` would set the status but never recompute
 * `due_at` on the steps gated behind it, stranding them forever.
 *
 * @module lib/workflows/executor
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendAlert } from '@/lib/alerts/send-alert';
import type { Json } from '@/types/database';
import type { Database } from '@/types/database';
import type {
  WorkflowInstanceRow,
  WorkflowStepRow,
} from '@/types/workflows';

import {
  isAccountPaused,
  loadAccountPauses,
  type AccountPauseState,
} from './account-pause';
import { writeAudit, writeAuditMany } from './audit';
import { skipBranchSide } from './branch-skip';
import { isStartWorkflowStep, startedInstanceId } from './chain';
import { buildStepContext } from './context';
import { loadDueSteps } from './due-steps';
import { emitWorkflowCompleted } from './emitters/workflow-completed';
import { endRestOfInstance, endsWorkflow } from './end-instance';
import { isExecutable } from './executable';
import { executeStep, quietHoursHoldUntil } from './execute-step';
import { loadMcTimezone } from './mc-timezone';
import { createPassReads, readInstancesInChunks, type QuietHours } from './pass-reads';
import { CONTEXT_UNREADABLE, describeFailure, isWorkflowReadError, throwIfReadFailed } from './read-failure';
import { releaseBlocker, type ReleaseStep } from './release';
import { isAccountPauseBacklog, settleAccountPauseWindow } from './resume';
import { AUTOMATED_STEP_TYPES, isAutomated } from './steps';
import { recomputeDueDates } from './timing';
import { loadWeddingDateOrThrow } from './wedding-date';

/** How many steps one tick will execute before yielding. */
const STEP_BUDGET_PER_TICK = 200;

/**
 * How many follow-on steps one instance may run in the same pass after a
 * step completes. "Wait 15 minutes, then send" is two steps; without the
 * chain the send ran on the pass after the wait completed, so a
 * 15-minute wait was really 15 minutes plus a tick (and the tick was 15
 * minutes at the time). The cap keeps a
 * template of a hundred zero-delay steps from pinning one instance to
 * the whole tick.
 */
const DEFAULT_MAX_CHAIN_DEPTH = 25;

/** Attempts before a failure is final. */
const MAX_ATTEMPTS = 3;

/**
 * Backoff before the next attempt, indexed by attempts already spent.
 *
 * Only the first two entries are reachable while {@link MAX_ATTEMPTS} is
 * three, because the third failure is final rather than rescheduled. The
 * third entry and the fallback beside the lookup are here so that raising
 * the cap lengthens the backoff as intended instead of silently reusing
 * the last delay.
 */
const RETRY_DELAY_MS = [60_000, 300_000, 900_000];

export interface ExecutorResult {
  stepsExecuted: number;
  instancesCompleted: number;
  errors: number;
  /** True when the deadline stopped the pass before every due step ran. */
  truncated: boolean;
  /**
   * Steps or instances this pass left unrun or unfinished because a read
   * they depended on failed (a `WorkflowReadError`). Each is where the
   * next tick finds it: a step not yet claimed stays due, a woken wait
   * stays asleep. Counted rather than thrown so one bad read cannot end
   * the pass for every other tenant; the tick alerts on it instead. Also
   * counts steps that finished but whose bookkeeping after the finish
   * failed (see {@link StepOutcome}), which the tick's heal pass redoes.
   */
  failedReads: number;
  /** The first failed read's site, for the alert (review M2). Null when none. */
  failedReadSite: string | null;
}

/**
 * Statuses a step can no longer move on from. Includes `cancelled`, so
 * "send it now" (`runStepNow`) refuses a stopped workflow's step.
 */
const TERMINAL = new Set(['done', 'skipped', 'errored', 'cancelled']);

/**
 * Is this step ready to run right now? Lives in `./executable` so the
 * apply-time skip rule can share it without an import cycle; re-exported
 * here for every existing caller.
 */
export { isExecutable } from './executable';

/**
 * Would running this step now be backlog from a lifted account stop?
 *
 * Exactly the steps {@link settleAccountPauseWindow} acts on, asked of
 * the same rule (`isAccountPauseBacklog` in `./resume`): an action, a
 * branch, a wait already asleep, and an unstarted wait whose own date
 * had passed at the lift. Anything else runs as usual, which also keeps
 * a step the settle would leave alone from being deferred to it on every
 * tick. The wedding date is read only for an unstarted wait; a read that
 * fails counts as backlog, so the settle (which reads it again, and
 * throws) defers the step rather than letting it run unjudged.
 */
async function isPauseBacklog(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
  pause: AccountPauseState | undefined,
): Promise<boolean> {
  try {
    return await isAccountPauseBacklog(step, pause, () =>
      loadWeddingDateOrThrow(supabase, instance.couple_id),
    );
  } catch (err) {
    console.error('[workflows] backlog check failed, deferring the step', step.id, err);
    return true;
  }
}

/**
 * Advance every due automated step across all active instances.
 *
 * The account-wide stop (`./account-pause`) is judged in two places.
 * The due read ({@link loadDueSteps}) leaves every stopped MC's steps
 * out in SQL: never claimed, written or counted, and never allowed to
 * fill the batch and starve every other tenant, however many MCs are
 * stopped. The stop rows are also read once per pass, before the due
 * read, for the lifted windows: a step that came due inside a stop that
 * has since lifted is skipped, not run late, through
 * {@link settleAccountPauseWindow}. A stop pressed after the due read is
 * not seen until the next pass; the send gate
 * (`lib/email/automation-send.ts`) reads it on every send and is the
 * backstop for that window.
 *
 * Throws when either read fails. The tick's guard turns that into an
 * alert; a failed read reported as "nothing due" would halt every
 * tenant's workflows behind a healthy-looking heartbeat.
 *
 * @param opts.userId - only this owner's instances. Set by the
 *   immediate kick a mutation fires for the MC who caused it
 *   (`./kick`): a step that just came due for them must not mean
 *   running every other tenant's backlog on their request. The cron
 *   leaves it unset and sweeps everyone.
 * @param opts.deadline - epoch ms after which no further step starts.
 *   Steps not reached keep `due_at` in the past and are picked up next
 *   tick, oldest first, because the query already orders by `due_at`.
 * @param opts.maxChainDepth - how many steps an instance may chain
 *   through after one completes in this pass (default
 *   {@link DEFAULT_MAX_CHAIN_DEPTH}). Zero restores one step per pass.
 * @param opts.readFreshMs - how long a batched instance or quiet-hours
 *   row may be used before it is read again (default
 *   `PASS_READ_FRESH_MS` in `./pass-reads`). Tests set it to measure the
 *   batching apart from how long the pass took.
 */
export async function advanceDueSteps(
  supabase: SupabaseClient<Database>,
  opts: { userId?: string; deadline?: number; maxChainDepth?: number; readFreshMs?: number } = {},
): Promise<ExecutorResult> {
  const now = new Date();

  // Throws when the read fails, which the tick's guard alerts on: no
  // step may run against a stop that could not be checked.
  const pauses = await loadAccountPauses(supabase, opts.userId);
  if (opts.userId && isAccountPaused(pauses.get(opts.userId))) {
    return {
      stepsExecuted: 0,
      instancesCompleted: 0,
      errors: 0,
      truncated: false,
      failedReads: 0,
      failedReadSite: null,
    };
  }

  // Everything `isExecutable` would refuse is refused in SQL too, so it
  // cannot eat the budget below: a manual to-do and a send held for the
  // MC's OK are both due forever until a person acts on them. So is a
  // step on a cancelled or completed instance, which would otherwise be
  // due forever and could fill the whole batch. The SQL function also
  // breaks a due-time tie by position, so a step that reads the previous
  // step's output through `ctx.actionResults` runs after its producer.
  const dueRows = await loadDueSteps(supabase, {
    now,
    limit: STEP_BUDGET_PER_TICK,
    userId: opts.userId,
  });

  const candidates = dueRows.filter((s) => isExecutable(s, now));

  // The instances and quiet hours the steps below need, read in batches
  // of up to a hundred rather than once per step (Task 38). A failed
  // batch throws exactly as the per-step read did, a row the pass wrote
  // to is invalidated and read again, no row is used once it is older
  // than PASS_READ_FRESH_MS, and each batch is sized to what the pass
  // will use before it ages: see `./pass-reads` for each rule and what
  // the freshness window costs.
  const reads = createPassReads(
    supabase,
    candidates.map((s) => s.instance_id),
    { freshMs: opts.readFreshMs },
  );

  let stepsExecuted = 0;
  let errors = 0;
  let failedReads = 0;
  let failedReadSite: string | null = null;
  /** Count one failed read, remembering the first one's site. */
  const noteFailedRead = (site: string) => {
    failedReads += 1;
    failedReadSite ??= site;
  };
  let truncated = false;
  const touchedInstances = new Set<string>();
  // Steps this pass has already run, or that a chain reached before the
  // outer loop did. A chained follower can also be in `candidates` (two
  // zero-offset steps due together), and must not run twice.
  const handled = new Set<string>();
  const maxChainDepth = opts.maxChainDepth ?? DEFAULT_MAX_CHAIN_DEPTH;
  // Instances whose lifted-stop backlog this pass has already settled.
  const settled = new Set<string>();
  // Instances whose settle threw this pass. Nothing more runs on them
  // until the next pass tries the settle again.
  const unsettled = new Set<string>();

  const pastDeadline = () => opts.deadline !== undefined && Date.now() >= opts.deadline;

  /** Run one step, counting the outcome. */
  async function run(instance: WorkflowInstanceRow, step: WorkflowStepRow): Promise<void> {
    handled.add(step.id);
    touchedInstances.add(instance.id);
    try {
      const outcome = await runOneStep(supabase, instance, step, now, {
        quietHours: reads.quietHours,
      });
      // A lost claim did no work, so it must not inflate the count the
      // cron summary and the scheduler watchdog rely on.
      if (outcome === 'ran' || outcome === 'unsettled') stepsExecuted += 1;
      // Finished, but what follows a finish (the output merge, the branch
      // skip, the re-dating) failed. Already alerted with the instance id;
      // the tick's heal pass redoes it.
      if (outcome === 'unsettled') noteFailedRead('executor.after_completion');
      // A wait whose quiet-hours check could not read stays asleep for the
      // next tick. Not an error (nothing is wrong with the step), but a
      // failed read all the same, and a persistent one would keep the
      // wait asleep for good with nothing said.
      if (outcome === 'deferred') noteFailedRead('executor.wake_check');
    } catch (err) {
      errors += 1;
      if (isWorkflowReadError(err)) noteFailedRead(err.site);
      console.error('[workflows] step execution threw', step.id, describeFailure(err));
      // Only for a throw before the step's completion landed: everything
      // after it is caught inside runOneStep. Before a claim this matches
      // nothing and the step stays due for the next tick; after one, the
      // MC sees the step errored with the message. See markErrored.
      await markErrored(
        supabase,
        instance,
        step,
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      // Whatever happened, the step may have written to its instance (its
      // output into the context, a completion). The next step on it must
      // not be handed the row from before.
      reads.invalidate(instance.id);
    }
  }

  /**
   * Skip one instance's lifted-stop backlog, once per pass. Not counted
   * as executed: nothing ran.
   */
  async function settlePauseBacklog(
    instance: WorkflowInstanceRow,
    pause: AccountPauseState,
  ): Promise<void> {
    if (settled.has(instance.id)) return;
    settled.add(instance.id);
    touchedInstances.add(instance.id);
    // The settle skips steps and re-dates what they gated; read the
    // instance again before anything else runs on it.
    reads.invalidate(instance.id);
    try {
      await settleAccountPauseWindow(supabase, instance, pause);
    } catch (err) {
      // Deferred, not run: the step that led here was marked handled and
      // is left due for the next pass, which settles again.
      errors += 1;
      unsettled.add(instance.id);
      console.error('[workflows] skipping a lifted-stop backlog threw', instance.id, err);
    }
  }

  /**
   * A failed read outside `run` (the instance, the chain's next step):
   * counted, and the pass carries on. The step was not claimed, so it is
   * still due and the next tick's due read finds it. Rethrows anything
   * that is not a read failure, which the tick's guard alerts on.
   */
  function countReadFailure(err: unknown, id: string): void {
    if (!isWorkflowReadError(err)) throw err;
    noteFailedRead(err.site);
    console.error('[workflows] read failed, left for the next tick', id, describeFailure(err));
  }

  /**
   * Run what one instance has due now, in order, up to the chain cap:
   * the followers a finished step released. Any workflow a Start
   * workflow step opens on the way is added to `handoffs`.
   *
   * The loop body is the pre-chaining follower loop unchanged (the
   * backlog check on the row the caller holds, then a fresh read before
   * each run); only the handoff note after each run is new.
   */
  async function chainFrom(instance: WorkflowInstanceRow, handoffs: string[]): Promise<void> {
    for (let depth = 0; depth < maxChainDepth; depth += 1) {
      if (pastDeadline()) {
        truncated = true;
        return;
      }
      let next: WorkflowStepRow | null;
      try {
        next = await nextDueStep(supabase, instance.id, handled);
      } catch (err) {
        // The follower is still due; the next tick's due read has it.
        countReadFailure(err, instance.id);
        return;
      }
      if (!next) return;
      // The same backlog rule as the outer loop, for an instance whose
      // lifted-stop steps the outer loop has not reached yet.
      const pause = pauses.get(instance.user_id);
      if (await isPauseBacklog(supabase, instance, next, pause)) {
        handled.add(next.id);
        await settlePauseBacklog(instance, pause!);
        if (unsettled.has(instance.id)) return;
        continue;
      }
      // Reload rather than reuse: the step just run merged its output
      // into `instance.context` in the database, and a follower reads
      // that context (`update_task` finds the to-do `create_task` made
      // through it). The in-memory row is from before that write, and
      // handing it on would both hide the output and overwrite it. The
      // step may also have ended the instance. `run` invalidated it, so
      // this is a real read every time, never the batch's copy.
      let fresh: WorkflowInstanceRow | null;
      try {
        fresh = await reads.instance(instance.id);
      } catch (err) {
        countReadFailure(err, instance.id);
        return;
      }
      if (!fresh || fresh.status !== 'active') return;
      await run(fresh, next);
      await noteHandoff(next, handoffs);
    }
  }

  /**
   * Run the first due steps of a workflow a Start workflow step opened.
   * Its row is read here: it did not exist when this pass began.
   */
  async function chainInto(instanceId: string, handoffs: string[]): Promise<void> {
    let opened: WorkflowInstanceRow | null;
    try {
      opened = await reads.instance(instanceId);
    } catch (err) {
      countReadFailure(err, instanceId);
      return;
    }
    if (!opened || opened.status !== 'active') return;
    await chainFrom(opened, handoffs);
  }

  /**
   * After a Start workflow step, queue the workflow it opened, so its
   * first steps run in this pass. Read from the step's stored output:
   * that is the record of what the step did, whoever ran it.
   */
  async function noteHandoff(step: WorkflowStepRow, handoffs: string[]): Promise<void> {
    if (!isStartWorkflowStep(step)) return;
    try {
      const { data, error } = await supabase
        .from('workflow_steps')
        .select('status, output')
        .eq('id', step.id)
        .maybeSingle();
      // Not running the new workflow now only costs latency: its steps
      // are due, and the next tick's due read finds them.
      throwIfReadFailed('executor.handoff_read', error);
      if (data?.status !== 'done') return;
      const opened = startedInstanceId(data.output);
      if (opened && !handoffs.includes(opened)) handoffs.push(opened);
    } catch (err) {
      countReadFailure(err, step.id);
    }
  }

  for (const [index, step] of candidates.entries()) {
    // Batches look ahead from here, never back at steps already run.
    reads.startStep(index);
    if (handled.has(step.id)) continue;
    if (pastDeadline()) {
      truncated = true;
      break;
    }
    let instance: WorkflowInstanceRow | null;
    try {
      // From the pass's batch. An instance a step in this pass ran on was
      // invalidated after it, so the pass's own writes are always seen.
      // An MC's pause or Turn off can be up to a second newer than this
      // row. The claim catches it (it requires the instance active), so
      // a stale "active" here costs a refused claim, never a run.
      instance = await reads.instance(step.instance_id);
    } catch (err) {
      countReadFailure(err, step.id);
      continue;
    }
    // A cancelled or completed instance keeps its steps but must not run
    // them. Guarding here rather than in the query keeps the hot index
    // simple.
    if (!instance || instance.status !== 'active') continue;
    const pause = pauses.get(instance.user_id);
    // Belt and braces: the due query already left these out.
    if (isAccountPaused(pause)) continue;

    if (await isPauseBacklog(supabase, instance, step, pause)) {
      handled.add(step.id);
      await settlePauseBacklog(instance, pause!);
      continue;
    }
    // A settle that failed on this instance this pass leaves its backlog
    // half judged: run nothing more on it until the next pass retries.
    if (unsettled.has(instance.id)) continue;

    await run(instance, step);

    // Chain: a completed step's recompute may have stamped the next one
    // due right now (an "after previous, 0 delay" follower, or the send
    // behind a wait). Run it in this pass rather than the next. A Start
    // workflow step hands on to the workflow it opened, whose first steps
    // are due now too but were not in this pass's due read: they run next,
    // in this pass, so the couple does not sit in the new workflow until
    // the next tick (or, where no tick runs, for good).
    const handoffs: string[] = [];
    await noteHandoff(step, handoffs);
    await chainFrom(instance, handoffs);
    // Bounded: each handoff is one level deeper in its chain, and the
    // Start workflow step refuses past MAX_CHAIN_DEPTH.
    while (!truncated && handoffs.length > 0) {
      await chainInto(handoffs.shift()!, handoffs);
    }
    if (truncated) break;
  }

  // Every instance this pass touched, read afresh in chunks (they were
  // all invalidated when their steps ran), then checked for completion.
  // A failed chunk counts a failed read for each of its instances, which
  // is what a failed read of each one alone did. But one failed request
  // now covers up to a hundred instances, and one whose last step just
  // finished would show as running with nothing left to finish it, since
  // the heal only looks at marked instances (review M3). So the chunk is
  // marked for the heal, which completes whatever is done.
  //
  // A chunk's rows age while the ones before them are checked, which is
  // safe: a pause or stop landing meanwhile still wins, because the
  // completing write is guarded on the instance still being active.
  let instancesCompleted = 0;
  await readInstancesInChunks(supabase, [...touchedInstances], async (chunk, result) => {
    if ('error' in result) {
      for (const instanceId of chunk) countReadFailure(result.error, instanceId);
      await markManyNeedRecompute(supabase, chunk);
      return;
    }
    for (const instanceId of chunk) {
      try {
        if (await completeLoadedInstanceIfDone(supabase, instanceId, result.rows.get(instanceId) ?? null)) {
          instancesCompleted += 1;
        }
      } catch (err) {
        // Left active. If its last step just finished, nothing later
        // would finish it: it would read "running" for good and hold its
        // dedupe key (Phase 6 review M1). So it is marked for the heal,
        // which completes whatever is done, and alerted with its id,
        // exactly as a failed settle is.
        countReadFailure(err, instanceId);
        await markAndAlertUnsettled(supabase, instanceId, null, err, 'executor.completion_check');
      }
    }
  });

  return { stepsExecuted, instancesCompleted, errors, truncated, failedReads, failedReadSite };
}

/**
 * The earliest automated step of one instance that is due now and has
 * not run in this pass, or null. Read fresh: the previous step's
 * recompute may have just stamped it.
 */
async function nextDueStep(
  supabase: SupabaseClient<Database>,
  instanceId: string,
  handled: Set<string>,
): Promise<WorkflowStepRow | null> {
  const now = new Date();
  const { data, error } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('instance_id', instanceId)
    .in('status', ['pending', 'waiting'])
    .in('type', AUTOMATED_STEP_TYPES)
    .eq('requires_approval', false)
    .not('due_at', 'is', null)
    .lte('due_at', now.toISOString())
    .order('position', { ascending: true })
    .limit(10);
  // "No follower due" would end the chain quietly; the caller counts it.
  throwIfReadFailed('executor.next_due_step', error);
  const rows = ((data ?? []) as unknown as WorkflowStepRow[]).filter(
    (s) => !handled.has(s.id) && isExecutable(s, now),
  );
  return rows[0] ?? null;
}

/** How long a step may sit in `running` before it is presumed dead. */
const STUCK_STEP_MS = 10 * 60 * 1000;

/**
 * Instance ids per owner read in {@link sweepStuckSteps}. A hundred
 * uuids keep the request URL near 4KB, well inside the gateway limit.
 */
const SWEEP_OWNER_BATCH = 100;

/**
 * Recover steps a dead function left marked `running`.
 *
 * Nothing else can see such a step: the due query selects `pending` and
 * `waiting`, and Try again only accepts `errored`. Left alone it stops
 * its whole workflow for good. Ten minutes is comfortably past the
 * thirty-second executor budget, so a step still running at that point
 * is not slow, it is gone.
 *
 * Marking it `errored` rather than `pending` is deliberate: the send may
 * have left. The MC decides, and on Resend the idempotency key makes
 * their retry safe if it did. On a connected Gmail or Microsoft mailbox
 * it does not, which is another reason this never reschedules by itself.
 *
 * @param supabase - service-role client
 * @param olderThanMs - override the staleness window, for tests
 * @returns how many steps were recovered
 */
export async function sweepStuckSteps(
  supabase: SupabaseClient<Database>,
  olderThanMs: number = STUCK_STEP_MS,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const message =
    'This step did not finish. It may or may not have sent. Check, then try again.';
  const { data, error } = await supabase
    .from('workflow_steps')
    .update({
      status: 'errored',
      error_message: message,
      completed_at: new Date().toISOString(),
    })
    .eq('status', 'running')
    .lt('updated_at', cutoff)
    .select('id, instance_id');
  // Thrown, so the tick's guard alerts. Zero here reads as "nothing
  // stuck", and a stuck step is invisible to everything else.
  throwIfReadFailed('executor.sweep_stuck', error);

  const rows = data ?? [];
  const recovered = rows.length;
  if (recovered === 0) return 0;

  // The sweep moves a step to `errored` exactly as markErrored does, so
  // it owes the log the same row. Without one, the only transition in a
  // step's history that nobody chose is also the only one that leaves no
  // trace, and the couple profile's activity list jumps from "started"
  // to nothing. `reason` separates it from a step the action itself
  // failed: this one may have sent.
  //
  // The owners are read in batches. One `.in('id', ids)` carries every
  // id in the request URL, and a mass recovery (a platform outage that
  // killed a few hundred runs) would outgrow the gateway limit, fail the
  // read and drop every audit row. A failed batch throws, so the tick's
  // guard alerts rather than the history going quietly missing.
  const instanceIds = [...new Set(rows.map((row) => row.instance_id))];
  const byId = new Map<string, { id: string; user_id: string; couple_id: string | null }>();
  for (let i = 0; i < instanceIds.length; i += SWEEP_OWNER_BATCH) {
    const { data: instances, error } = await supabase
      .from('workflow_instances')
      .select('id, user_id, couple_id')
      .in('id', instanceIds.slice(i, i + SWEEP_OWNER_BATCH));
    if (error) throw new Error(`could not read swept steps' owners: ${error.message}`);
    for (const row of instances ?? []) byId.set(row.id, row);
  }
  await writeAuditMany(
    supabase,
    rows.flatMap((row) => {
      const instance = byId.get(row.instance_id);
      if (!instance) return [];
      return [
        {
          userId: instance.user_id,
          instanceId: row.instance_id,
          stepId: row.id,
          coupleId: instance.couple_id,
          event: 'step_errored' as const,
          detail: { message, reason: 'stuck_sweep' },
        },
      ];
    }),
  );

  void sendAlert({
    type: 'workflow_step_stuck',
    severity: 'error',
    count: recovered,
    stepIds: rows.map((row) => row.id).slice(0, 10),
  });
  return recovered;
}

/**
 * Take ownership of a step, or report that somebody else already has.
 *
 * The tick reads a batch of due steps once and then works through it
 * for up to thirty seconds, so a row's in-memory status is stale the
 * moment it is read. An approve-and-send, a retry or the immediate
 * kick can all reach the same row inside that window. Postgres decides
 * the winner: the claim only matches a row still waiting to run, and
 * only the caller whose claim returns true may execute it.
 *
 * The claim is `workflow_claim_step` (20261023800000), which also
 * requires the step's instance to be active in the same statement, under
 * the template-then-instance locks a Turn off takes. The instance row the
 * pass judged "active" can be up to a second old (`./pass-reads`), so a
 * pause or Turn off landing in that second used to let the next step run
 * anyway; now it stops that step exactly. The engine never claims a step
 * the MC took the date off (`due_held_at`); the MC's own Run now does,
 * and lifts the hold.
 *
 * `updated_at` is left to the table's `workflow_steps_set_updated_at`
 * trigger: a later sweep for stuck steps reads that stamp as "when did
 * this claim start running".
 *
 * @param supabase - service-role client, since the executor runs unscoped
 * @param stepId - the step to claim
 * @param opts.manual - the MC's explicit act (Run now, approve and send,
 *   Try again), which may claim a held step
 * @returns true when this caller now owns the step
 * @throws WorkflowReadError when the claim itself fails. That is not a
 *   lost race: read as one, a database that refuses every claim made the
 *   tick report zero steps and a clean pass.
 */
export async function claimStep(
  supabase: SupabaseClient<Database>,
  stepId: string,
  opts: { manual?: boolean } = {},
): Promise<boolean> {
  const { data, error } = await supabase.rpc('workflow_claim_step', {
    p_step_id: stepId,
    p_manual: opts.manual ?? false,
  });
  throwIfReadFailed('executor.claim_step', error);
  return data === true;
}

/**
 * What {@link runOneStep} did with a step. `unsettled` is a step that
 * ran and whose completion landed, but whose bookkeeping after it failed
 * (see {@link settleAfterCompletion}): it counts as run, and the tick's
 * heal pass finishes the bookkeeping.
 */
type StepOutcome = 'ran' | 'unsettled' | 'lost' | 'deferred';

/**
 * One `workflow_step_unsettled` alert per instance per ten minutes. A
 * database blip strands whichever instances were finishing a step at the
 * time, and each would otherwise alert again on every retry; the heal
 * pass fixes them either way.
 */
const UNSETTLED_ALERT_WINDOW_MS = 10 * 60 * 1000;

/** Per instance, when its last unsettled alert went. */
const unsettledAlertAt = new Map<string, number>();

/** Test-only: forget every instance's unsettled-alert dedupe state. */
export function _resetUnsettledAlertDedupForTest(): void {
  unsettledAlertAt.clear();
}

/**
 * Run the bookkeeping that follows a step's completion, and never let a
 * failure in it escape.
 *
 * The completion is one guarded write. What follows (merging the output,
 * skipping the branch not taken, the audit rows, re-dating the steps
 * behind it, completing the instance) is separate statements, and a
 * failure in any of them used to reach `run`'s catch, whose `markErrored`
 * matches nothing on a row that is already `done`. The followers kept a
 * null `due_at` for good, because nothing reads an undated step, while
 * the couple's checklist showed a green tick (review I1).
 *
 * So a failure here is caught, logged, and alerted as
 * `workflow_step_unsettled` with the instance and step ids (deduped per
 * instance), and the caller reports the step as `unsettled`. The
 * instance is marked (`needs_recompute_at`), and the tick's heal pass
 * (`./heal`, `workflow_stranded_instances`) finds marked instances only,
 * on the next tick, and redoes all of it in the same order. The marker
 * is the evidence: the heal used to infer strands from the shape of the
 * steps, and a step whose date the MC took off has that shape too, so
 * the heal re-dated and sent what the MC had held (re-review N1).
 *
 * @returns true when the bookkeeping finished, false when it did not
 */
async function settleAfterCompletion(
  supabase: SupabaseClient<Database>,
  instanceId: string,
  stepId: string,
  work: () => Promise<void>,
): Promise<boolean> {
  try {
    await work();
    return true;
  } catch (err) {
    console.error('[workflows] bookkeeping after a finished step failed', stepId, describeFailure(err));
    await markAndAlertUnsettled(supabase, instanceId, stepId, err);
    return false;
  }
}

/**
 * Mark an instance for the heal pass and raise `workflow_step_unsettled`
 * with its id, deduped per instance. Never throws.
 *
 * Shared by a failed settle after a finished step and a failed completion
 * check in the tick's closing loop: both leave an instance the heal must
 * finish, and both must name it.
 *
 * @param stepId - the step that finished, or null when the failure was in
 *   the instance's completion check rather than after one step
 * @param fallbackSite - the site to report for an error that is not a
 *   `WorkflowReadError`
 */
async function markAndAlertUnsettled(
  supabase: SupabaseClient<Database>,
  instanceId: string,
  stepId: string | null,
  err: unknown,
  fallbackSite = 'unexpected',
): Promise<void> {
  const marked = await markNeedsRecompute(supabase, instanceId);
  const now = Date.now();
  const last = unsettledAlertAt.get(instanceId);
  if (last !== undefined && now - last < UNSETTLED_ALERT_WINDOW_MS) return;
  unsettledAlertAt.set(instanceId, now);
  // Awaited so it is not lost when a Vercel handler returns; the Slack
  // transport bounds it.
  await sendAlert({
    type: 'workflow_step_unsettled',
    severity: 'error',
    instanceId,
    stepId,
    site: isWorkflowReadError(err) ? err.site : fallbackSite,
    marked,
  }).catch(() => undefined);
}

/**
 * Stamp the instance for the heal pass. Never throws: this runs inside a
 * failure already, often the same outage, and the caller's result must
 * stand. A marker that did not land is reported on the alert instead,
 * because the heal will not find that instance.
 *
 * @returns whether the marker landed
 */
async function markNeedsRecompute(
  supabase: SupabaseClient<Database>,
  instanceId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('workflow_instances')
      .update({ needs_recompute_at: new Date().toISOString() })
      .eq('id', instanceId);
    if (!error) return true;
    console.error('[workflows] could not mark instance for the heal pass', instanceId, error.message);
  } catch (err) {
    console.error('[workflows] could not mark instance for the heal pass', instanceId, describeFailure(err));
  }
  return false;
}

/**
 * {@link markNeedsRecompute} for many instances in one write, for a
 * completion check that could not read them. Best effort and never
 * throws, for the same reasons: it runs inside a failure, usually the
 * same outage, and the failed read is already counted and alerted. A
 * marker that did not land leaves those instances where the old per-
 * instance read left one: running until a later step on it finishes.
 *
 * @param ids - at most one completion chunk, so the URL stays bounded
 */
async function markManyNeedRecompute(
  supabase: SupabaseClient<Database>,
  ids: readonly string[],
): Promise<void> {
  try {
    const { error } = await supabase
      .from('workflow_instances')
      .update({ needs_recompute_at: new Date().toISOString() })
      .in('id', [...ids])
      // A paused or finished instance is not the heal's to touch (it
      // skips non-active ones anyway); marking only active ones keeps the
      // heal's queue to the instances this failure could have stranded.
      .eq('status', 'active');
    if (error) console.error('[workflows] could not mark instances for the heal pass', ids.length, error.message);
  } catch (err) {
    console.error('[workflows] could not mark instances for the heal pass', ids.length, describeFailure(err));
  }
}

/**
 * What the MC reads on a step whose action ran but whose outcome could
 * not be written. The action may have sent, so it says so, in the same
 * words the stuck sweep uses for the same uncertainty.
 */
const OUTCOME_UNSAVED =
  'This step ran but its result could not be saved. It may or may not have sent. Check, then try again.';

/**
 * Execute one step and write its outcome.
 *
 * `opts.quietHours` is where the template's quiet hours come from: the
 * tick's per-pass batch, or (unset) a read of its own. Either throws on
 * a failed read, at the same point in the run.
 *
 * `opts.manual` marks the MC's own explicit act (Run now, approve and
 * send, Try again). It reaches the actions as `ctx.manualRun`, which is
 * what lets the send gate tell that act apart from the engine sending
 * by itself while the account-wide stop is on.
 *
 * @returns `ran` when this caller actually ran the step (claimed it, or
 *   completed an already-slept wait); `lost` when it lost the race to
 *   another caller and did nothing; `deferred` when a woken wait's
 *   quiet-hours check could not read and the row was left for the next
 *   tick. Anything but `ran` must not be counted as executed or have
 *   anything further written for it.
 */
async function runOneStep(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
  now: Date = new Date(),
  opts: { manual?: boolean; quietHours?: QuietHoursReader } = {},
): Promise<StepOutcome> {
  // The tick hands in its per-pass batch; a manual run reads its own.
  const quietHoursFor: QuietHoursReader =
    opts.quietHours ?? ((templateId) => loadQuietHours(supabase, templateId));
  // A wait that has already slept is finished the moment its wake time
  // passes. Re-running executeStep here would call evaluateWaitAction
  // again, compute a fresh wake time from `now`, and sleep forever.
  if (step.type === 'wait' && step.status === 'waiting') {
    // Waking inside the MC's quiet window holds the wait to the window's
    // end rather than finishing it, because finishing releases the send
    // behind it on the spot. See quietHoursHoldUntil for why the stored
    // wake cannot be trusted to be outside the window already.
    const decision = await wakeHold(supabase, instance, step, now, quietHoursFor);
    // The check could not run. Leave the row exactly as it is for the
    // next tick: no write, no error, and not counted as work done. The
    // caller counts it as a failed read, so it is not silent either.
    if (decision.kind === 'retry') return 'deferred';
    if (decision.kind === 'hold') {
      const holdUntil = decision.until;
      // Exclusive on the wake this caller read as well as the status: two
      // callers holding the same `waiting` row would otherwise both
      // re-park it and both write the audit row. The loser matches
      // nothing and did no work. Like the claim, it lands only while the
      // instance is active (`workflow_hold_wait`, 20261023800000).
      const { data: held, error: holdError } = await supabase.rpc('workflow_hold_wait', {
        p_step_id: step.id,
        // Null when the wait slept with no wake; the SQL compares with
        // `is not distinct from`, so null matches null.
        p_expected_due_at: step.due_at as string,
        p_until: holdUntil.toISOString(),
      });
      // An error is not a lost race. The wait is still asleep, so the
      // next tick tries again; the throw is what gets it counted.
      throwIfReadFailed('executor.hold_wait', holdError);
      if (held !== true) return 'lost';
      await writeAudit(supabase, {
        userId: instance.user_id,
        instanceId: instance.id,
        stepId: step.id,
        coupleId: instance.couple_id,
        event: 'step_waiting',
        detail: { wakeAt: holdUntil.toISOString(), reason: 'quiet_hours' },
      });
      return 'ran';
    }
    // Same guard as claimStep, for the same reasons: the tick and a
    // manual run can both hold this row in memory as `waiting`, and only
    // the write that still finds it `waiting`, on an instance still
    // active (`workflow_finish_wait`), may complete it. So only one
    // caller writes the completion audit row and recomputes, and a pause
    // or Turn off stops the finish that would release the send behind it.
    const { data: finished, error: finishError } = await supabase.rpc('workflow_finish_wait', {
      p_step_id: step.id,
    });
    // As above: still asleep, retried next tick, and counted.
    throwIfReadFailed('executor.finish_wait', finishError);
    if (finished !== true) return 'lost';
    const settled = await settleAfterCompletion(supabase, instance.id, step.id, async () => {
      await writeAudit(supabase, {
        userId: instance.user_id,
        instanceId: instance.id,
        stepId: step.id,
        coupleId: instance.couple_id,
        event: 'step_completed',
        detail: { type: 'wait' },
      });
      await recomputeInstance(supabase, instance);
    });
    return settled ? 'ran' : 'unsettled';
  }

  // Another caller may have taken this step between the batch read and
  // now. Losing the claim is not an error: it means the work is already
  // in hand. A claim that failed throws instead (see claimStep).
  if (!(await claimStep(supabase, step.id, { manual: opts.manual === true }))) return 'lost';
  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId: instance.id,
    stepId: step.id,
    coupleId: instance.couple_id,
    event: 'step_started',
    detail: { type: step.type },
  });

  const built = await buildStepContext(supabase, instance, step);
  const ctx = opts.manual ? { ...built, manualRun: true } : built;
  const quietHours = await quietHoursFor(instance.template_id);
  const { result, branchPath } = await executeStep(step, ctx, quietHours);

  switch (result.kind) {
    case 'ok': {
      // Guarded on the row still being running, not just its id. This is
      // never load-bearing today: the platform's function timeout is far
      // below sweepStuckSteps's staleness window, so no genuine runner is
      // still alive by the time a step gets swept. It is load-bearing the
      // moment either constant changes without the other, which nothing
      // ties together today: without the guard a zombie runner's late
      // write would silently overwrite a swept row back to done, hiding
      // the very "this may have sent twice" signal the alert exists to
      // raise.
      const { data: completed, error: completeError } = await supabase
        .from('workflow_steps')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
          output: (result.output ?? null) as Json,
          error_message: null,
        })
        .eq('id', step.id)
        .eq('status', 'running')
        .select('id');
      // Not "the row moved on": the row is still running and nothing
      // recorded that the action ran. Thrown, `run` marks the step
      // errored with this message now, rather than the stuck sweep doing
      // it ten minutes later.
      throwIfReadFailed('executor.complete_step', completeError, OUTCOME_UNSAVED);

      // Everything below this line describes a step that completed, so
      // none of it may run when the completion itself did not land. In
      // the race the guard exists for, the sweep has already buried this
      // row: writing the output, skipping the losing branch, logging
      // `step_completed` and recomputing would leave the MC looking at an
      // errored step whose audit trail says it finished, with its
      // followers released and the other branch skipped for good.
      if ((completed?.length ?? 0) !== 1) {
        console.error('[workflows] step outcome discarded, row moved on', step.id);
        // Still `ran`: this caller claimed the step and ran the action.
        // The work happened, it just no longer owns the record of it.
        return 'ran';
      }

      // From here the step is done. What follows cannot be allowed to
      // throw into `run`: see settleAfterCompletion.
      const settled = await settleAfterCompletion(supabase, instance.id, step.id, async () => {
        await mergeStepOutput(supabase, instance.id, step.id, result.output ?? null);

        if (branchPath) {
          // Everything under the losing side, nested branches included.
          await skipBranchSide(supabase, instance, step.id, branchPath === 'yes' ? 'no' : 'yes', {
            site: 'executor.skip_losing_branch',
            reason: 'branch not taken',
          });
          await writeAudit(supabase, {
            userId: instance.user_id,
            instanceId: instance.id,
            stepId: step.id,
            coupleId: instance.couple_id,
            event: 'branch_taken',
            detail: { path: branchPath },
          });
        }

        // A Start workflow step with "End this workflow" on. Here, after
        // the completion landed, so a retried step never ends the
        // workflow twice or ends it without having started the next.
        // Before the recompute, which would otherwise date the steps
        // this is about to skip.
        if (endsWorkflow(result.output)) {
          await endRestOfInstance(supabase, instance, step.id, { site: 'executor.end_workflow' });
        }

        // A document action that found nothing to send (no draft proposal,
        // no primary email) completes with `{ skipped: reason }`. The step
        // is still done for timing purposes, but the couple's feed should
        // say what did not happen rather than "Done".
        const output =
          result.output && typeof result.output === 'object' && !Array.isArray(result.output)
            ? (result.output as Record<string, Json | undefined>)
            : null;
        const skipReason = typeof output?.['skipped'] === 'string' ? output['skipped'] : null;
        await writeAudit(supabase, {
          userId: instance.user_id,
          instanceId: instance.id,
          stepId: step.id,
          coupleId: instance.couple_id,
          event: skipReason ? 'step_skipped' : 'step_completed',
          detail: (skipReason && output ? { ...output, reason: skipReason } : (result.output ?? {})) as Json,
        });
        await recomputeInstance(supabase, instance);
      });
      return settled ? 'ran' : 'unsettled';
    }

    case 'sleep': {
      // Same guard, same reason as the 'ok' case above: a write that no
      // longer finds the row running lands nowhere, and the swept state
      // survives.
      const { data: sleeping, error: sleepError } = await supabase
        .from('workflow_steps')
        .update({
          status: 'waiting',
          due_at: result.wakeAt,
          ...(result.token
            ? { approval_token: result.token, requires_approval: true }
            : {}),
        })
        .eq('id', step.id)
        .eq('status', 'running')
        .select('id');
      // Same as the 'ok' case: an error leaves the row running, unrecorded.
      throwIfReadFailed('executor.sleep_step', sleepError, OUTCOME_UNSAVED);

      // Same rule as the 'ok' case: the log and the alert both describe
      // a step that is now waiting, and neither is true if the row is
      // errored. The MC is not left in the dark either way, because the
      // sweep that took the row writes its own audit row and fires
      // `workflow_step_stuck`.
      if ((sleeping?.length ?? 0) !== 1) {
        console.error('[workflows] step sleep discarded, row moved on', step.id);
        return 'ran';
      }

      await writeAudit(supabase, {
        userId: instance.user_id,
        instanceId: instance.id,
        stepId: step.id,
        coupleId: instance.couple_id,
        event: 'step_waiting',
        detail: { wakeAt: result.wakeAt, reason: result.reason },
      });
      // A `missing_variables` sleep is not a wait the MC asked for: the
      // step parked on a far-future wake time and will never resume by
      // itself. Without this alert the email simply never sends and
      // nobody finds out.
      if (result.reason === 'missing_variables') {
        const payload = (result.payload ?? {}) as {
          missing?: string[];
        };
        void sendAlert({
          type: 'automation_paused_missing_variables',
          severity: 'warn',
          automationId: instance.template_id ?? instance.id,
          runId: instance.id,
          coupleId: instance.couple_id,
          missingVariables: payload.missing ?? [],
        });
      }

      // A sleeping step has not completed, so nothing behind it is
      // released. Return before the recompute. This caller did claim
      // and run the step this turn, so it still counts as executed.
      return 'ran';
    }

    case 'error': {
      await handleFailure(supabase, instance, step, result.message, result.recoverable);
      return 'ran';
    }
  }
}

/**
 * Reschedule a failed step, or bury it once its attempts are spent.
 *
 * Most failures here are a provider having a bad minute. Burying those
 * stops the whole workflow, because every step gated behind this one
 * keeps a null due_at until it completes.
 *
 * A retry is only offered when the action says the failure is worth
 * repeating. `recoverable: false` covers two cases and both mean "a
 * second attempt cannot do better than the first": a configuration
 * error only the MC can fix, and a send whose transport cannot
 * deduplicate, where the failures that most want a retry are the ones
 * that may have delivered anyway. See
 * {@link transportDeduplicates} in `lib/email/dispatch.ts`: Resend
 * honours the idempotency key the send carries, so a message that did
 * leave is not sent twice; an MC's own Gmail or Microsoft mailbox has no
 * equivalent, and retrying there is how one couple gets three copies.
 *
 * @param recoverable - the action's own verdict. Undefined means "no
 *   opinion", which is treated as retryable, because most failures that
 *   reach here are transient.
 */
async function handleFailure(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
  message: string,
  recoverable?: boolean,
): Promise<void> {
  const attempts = (step.attempt_count ?? 0) + 1;

  if (recoverable !== false && attempts < MAX_ATTEMPTS) {
    const delay = RETRY_DELAY_MS[attempts - 1] ?? 900_000;
    // Guarded on the row still being running, same reason as every other
    // post-claim write in runOneStep: a step the stuck sweep already
    // buried as errored must not be dragged back to pending by a late
    // write from this runner.
    const { data: rescheduled, error: rescheduleError } = await supabase
      .from('workflow_steps')
      .update({
        status: 'pending',
        attempt_count: attempts,
        error_message: message,
        due_at: new Date(Date.now() + delay).toISOString(),
      })
      .eq('id', step.id)
      .eq('status', 'running')
      .select('id');
    // The row is still running with no retry booked. Thrown, `run` marks
    // it errored with the failure, so the MC can retry it by hand.
    throwIfReadFailed('executor.reschedule_step', rescheduleError, message);
    // Only log the retry that was actually scheduled. When the sweep has
    // already buried this row the update above lands nowhere, and an
    // audit row saying a retry is coming would describe a step that is
    // errored and waiting on the MC.
    if ((rescheduled?.length ?? 0) === 1) {
      await writeAudit(supabase, {
        userId: instance.user_id,
        instanceId: instance.id,
        stepId: step.id,
        coupleId: instance.couple_id,
        event: 'step_retry_scheduled',
        detail: { attempt: attempts, message },
      });
    }
    return;
  }

  await markErrored(supabase, instance, step, message);
  // Auxiliary write alongside the already-guarded transition markErrored
  // just performed: the count is metadata about a decision already
  // made, not itself a status transition to guard. Its error is not
  // checked, deliberately: the step is already errored and waiting on
  // the MC, whose Try again resets the count to zero anyway.
  await supabase
    .from('workflow_steps')
    .update({ attempt_count: attempts })
    .eq('id', step.id);
  // Unconditional, unlike the audit rows: the action really did fail,
  // whoever owns the row by now, and that is what this alert reports.
  void sendAlert({
    type: 'workflow_step_failed',
    severity: 'error',
    stepId: step.id,
    instanceId: instance.id,
    attempts,
    message,
  });
}

/**
 * Write an errored outcome plus its audit row.
 *
 * @returns true when this caller's update actually took the row. False
 *   means something else moved it on first (the stuck sweep, in
 *   practice), and the caller must not write anything that describes
 *   this outcome as the step's.
 */
async function markErrored(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
  message: string,
): Promise<boolean> {
  // Same guard as the post-claim writes in runOneStep: markErrored
  // usually runs after a successful claim, so the row should still be
  // running, but stamping that condition rather than trusting it keeps a
  // late write from clobbering a row the sweep already moved on from.
  // The other caller is the catch in `run`, which may fire before any
  // claim succeeded; there the update correctly matches nothing.
  const { data: buried, error } = await supabase
    .from('workflow_steps')
    .update({
      status: 'errored',
      error_message: message,
      completed_at: new Date().toISOString(),
    })
    .eq('id', step.id)
    .eq('status', 'running')
    .select('id');
  // Logged, not thrown. This is the failure path's own last write, run
  // from `run`'s catch, and a throw from here would end the pass for every
  // other tenant. It is safe to let go: a row that did not take the write
  // is either not running (nothing to bury) or still running, and the
  // stuck sweep buries a running row within ten minutes, with an alert.
  if (error) console.error('[workflows] could not mark the step errored', step.id, error.message);
  const took = (buried?.length ?? 0) === 1;
  // The audit row follows the write, not the intention. A failure that
  // never claimed the step leaves it pending and due, so the next tick
  // will run it; logging it as errored would put a transition in the
  // record that never happened.
  if (took) {
    await writeAudit(supabase, {
      userId: instance.user_id,
      instanceId: instance.id,
      stepId: step.id,
      coupleId: instance.couple_id,
      event: 'step_errored',
      detail: { message },
    });
  }
  // The instance deliberately stays `active`: the MC can fix the config
  // and retry rather than losing the whole workflow to one bad step.
  return took;
}

/**
 * Run one step right now, on the MC's say-so.
 *
 * The approve path in the Today view calls this: an MC who has read the
 * email and pressed Send expects it to go, not to sit until the next
 * tick. Everything after the gate is the ordinary execution path, so an
 * approved send is audited, quiet-hours-aware and recorded exactly like
 * an automatic one.
 *
 * Returns false when the step or its instance is not in a state that can
 * run, so the caller can say so rather than reporting a phantom success.
 * Returns `unsettled` (still truthy) when the step ran (an email went) but the
 * bookkeeping after it failed: the caller says "Sent", not "failed",
 * because a second press would find the step done, and the tick's heal
 * pass finishes the bookkeeping.
 *
 * @param supabase - RLS-scoped client for the approving user
 * @param stepId - the step to run
 * @returns true when it ran and everything after it landed, `unsettled`
 *   when it ran but the bookkeeping after it did not (yet), false when
 *   nothing ran
 * @throws WorkflowReadError when a read before the step finished fails;
 *   a claimed step is marked errored first
 */
export async function runStepNow(
  supabase: SupabaseClient<Database>,
  stepId: string,
): Promise<true | 'unsettled' | false> {
  const { data: stepRow, error } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('id', stepId)
    .maybeSingle();
  // Thrown rather than false: "not in a state that can run" would tell
  // the MC something untrue about a step nobody could read.
  throwIfReadFailed('executor.run_now_step', error);
  const step = stepRow as unknown as WorkflowStepRow | null;
  if (!step) return false;
  if (!isAutomated(step.type)) return false;
  if (TERMINAL.has(step.status) || step.status === 'running') return false;

  const instance = await loadInstance(supabase, step.instance_id);
  if (!instance || instance.status !== 'active') return false;

  // Never out of order: a send still behind an unfinished step (a to-do,
  // a Wait, an undecided branch) is not the MC's to run yet. The actions
  // refuse first with the reason in words (`./release`); this is the
  // backstop for any caller that did not ask.
  const { data: laneRows, error: laneError } = await supabase
    .from('workflow_steps')
    .select('id, position, type, status, timing, parent_step_id, branch_path, title, config, completed_at')
    .eq('instance_id', step.instance_id);
  throwIfReadFailed('executor.run_now_lane', laneError);
  if (releaseBlocker<ReleaseStep>(step, (laneRows ?? []) as unknown as ReleaseStep[])) {
    return false;
  }

  let ran: StepOutcome;
  try {
    ran = await runOneStep(
      supabase,
      instance,
      {
        ...step,
        // The gate is spent the moment the MC approves. Clearing it on the
        // in-memory row as well as the table keeps `runOneStep` from seeing
        // a stale value if it re-reads.
        requires_approval: false,
      },
      new Date(),
      // The MC pressed the button, so the account-wide stop does not hold
      // this one step back: the stop is for the engine acting alone.
      { manual: true },
    );
  } catch (err) {
    // The tick's `run` does the same: a throw after the claim would
    // otherwise leave the step `running` until the stuck sweep, ten
    // minutes later. Before a claim this matches nothing. Rethrown so the
    // MC's action reports the failure rather than a success.
    await markErrored(supabase, instance, step, err instanceof Error ? err.message : String(err));
    throw err;
  }
  // The tick (or another approve-and-send) may have claimed this step
  // between the read above and now. Reporting success here would be the
  // phantom-success this function's contract rules out, so a lost claim
  // (or a wake check left for the next tick) is surfaced the same way as
  // any other not-runnable state.
  if (ran !== 'ran' && ran !== 'unsettled') return false;
  const completed = await settleAfterCompletion(supabase, instance.id, step.id, async () => {
    await completeInstanceIfDone(supabase, instance.id);
  });
  return ran === 'ran' && completed ? true : 'unsettled';
}

/**
 * Mark a manual step done or skipped, and release whatever it gated.
 *
 * This is the path the couple-profile checkbox and the queue both call.
 * The recompute at the end is the whole point: without it, an automated
 * step anchored `after_previous` behind this one would keep its null
 * `due_at` and never run. A failure there, after the step's own write
 * landed, does not throw (the tick did land): it is alerted and the
 * tick's heal pass redoes it. See {@link settleAfterCompletion}.
 *
 * @returns `done` when the step was ticked and everything behind it
 *   re-dated, `unsettled` when the tick landed but the re-dating did not
 *   (yet), `noop` when there was nothing to tick
 * @throws WorkflowReadError when a read or the write itself fails
 */
export async function completeStep(
  supabase: SupabaseClient<Database>,
  stepId: string,
  opts: { skipped?: boolean } = {},
): Promise<'done' | 'unsettled' | 'noop'> {
  const { data: stepRow, error } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('id', stepId)
    .maybeSingle();
  // Thrown: returning would tell the MC their tick landed.
  throwIfReadFailed('executor.complete_step_read', error);
  const step = stepRow as unknown as WorkflowStepRow | null;
  if (!step) return 'noop';

  // A stopped workflow's step is not ticked or skipped: resuming the
  // workflow is what brings it back. Guarded in the write too, so a stop
  // landing after the read wins.
  if (step.status === 'cancelled') return 'noop';

  const instance = await loadInstance(supabase, step.instance_id);
  if (!instance) return 'noop';

  const status = opts.skipped ? 'skipped' : 'done';
  const { data: written, error: writeError } = await supabase
    .from('workflow_steps')
    .update({ status, completed_at: new Date().toISOString() })
    .eq('id', stepId)
    .neq('status', 'cancelled')
    .select('id');
  throwIfReadFailed('executor.complete_step_write', writeError);
  if ((written?.length ?? 0) === 0) return 'noop';

  const settled = await settleAfterCompletion(supabase, instance.id, stepId, async () => {
    await writeAudit(supabase, {
      userId: instance.user_id,
      instanceId: instance.id,
      stepId,
      coupleId: instance.couple_id,
      event: opts.skipped ? 'step_skipped' : 'step_completed',
      detail: { manual: true },
    });

    // A skipped branch chose neither lane, so both go with it, at any
    // depth. Its lanes are no longer dated from a skip (a lane head needs
    // a done parent, see ./timing), so without this they would sit
    // pending for good and the workflow would never finish.
    if (opts.skipped && step.type === 'branch') {
      await skipBranchSide(supabase, instance, stepId, 'both', {
        site: 'executor.skip_branch_lanes',
        reason: 'branch skipped',
        // The `step_skipped` row above is this skip's line; the lanes
        // going with it are not a second skip of the branch (N9).
        audit: false,
      });
    }

    await recomputeInstance(supabase, instance);
    await completeInstanceIfDone(supabase, instance.id);
  });
  return settled ? 'done' : 'unsettled';
}

/** What {@link reopenStep} did, or why it would not. */
export type ReopenResult = { ok: true } | { ok: false; error: string };

/** The refusal for an automated step on a finished workflow that is off or gone. */
export const REOPEN_TURN_ON_FIRST =
  'Turn this workflow on first, then reopen this step. It would run again by itself.';

/**
 * Re-open a step the MC un-ticked, and re-gate whatever it released.
 *
 * Clears `attempt_count`, for the same reason `retryStepAction` does and
 * with sharper consequences here. An automated step that failed once and
 * then succeeded carries a spent attempt for good. Un-ticking it would
 * put it back in `pending` still carrying that attempt, and both
 * recompute paths now skip a pending step with attempts spent, because
 * on such a step `due_at` is the executor's retry backoff rather than a
 * schedule. The step would keep the stale past due date it was last
 * retried on, so it would send again on the very next tick instead of
 * when the timing says, and a later wedding-date change would never
 * reschedule it. Un-ticking is the MC saying this has not happened yet,
 * which is a fresh start, not the second attempt of an old one.
 *
 * On a `completed` instance the reopen also brings the instance back,
 * through `reopen_completed_workflow_instance` (20261011100000), which
 * reads the workflow under a lock first. Neither Turn off nor delete
 * touches a finished instance, so without that check an un-tick would
 * make a workflow the MC switched off (or deleted) live again, and the
 * next tick would run the reopened step. With the workflow on, it goes
 * back to `active` as it always has. With it off or gone, an automated
 * step is refused ({@link REOPEN_TURN_ON_FIRST}) and a manual one is
 * reopened with the instance paused as `template_off`: the to-do shows,
 * and nothing automated can run.
 *
 * @param supabase - service-role client; the caller has checked ownership
 * @param stepId - the step to reopen
 * @returns ok, or the refusal to show the MC
 */
export async function reopenStep(
  supabase: SupabaseClient<Database>,
  stepId: string,
): Promise<ReopenResult> {
  const { data: stepRow, error: readError } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('id', stepId)
    .maybeSingle();
  // A refusal, not `{ ok: true }`: nothing was reopened.
  if (readError) return { ok: false, error: 'Could not read that step. Try again.' };
  const step = stepRow as unknown as WorkflowStepRow | null;
  if (!step) return { ok: true };

  // A stopped workflow's step is reopened only by resuming the workflow.
  if (step.status === 'cancelled') return { ok: true };

  const instance = await loadInstance(supabase, step.instance_id);
  if (!instance) return { ok: true };

  // Decided before the step is touched, so a refusal changes nothing.
  if (instance.status === 'completed') {
    const { data: outcome, error } = await supabase.rpc('reopen_completed_workflow_instance', {
      p_instance_id: instance.id,
      p_manual: !isAutomated(step.type),
    });
    if (error) return { ok: false, error: error.message };
    if (outcome === 'template_off') return { ok: false, error: REOPEN_TURN_ON_FIRST };
    if (outcome === null) {
      return { ok: false, error: 'That workflow changed. Refresh and try again.' };
    }
  }

  const { data: written, error: writeError } = await supabase
    .from('workflow_steps')
    .update({ status: 'pending', completed_at: null, attempt_count: 0 })
    .eq('id', stepId)
    .neq('status', 'cancelled')
    .select('id');
  if (writeError) return { ok: false, error: 'Could not reopen that step. Try again.' };
  if ((written?.length ?? 0) === 0) {
    // The step moved on under us after the instance was reopened: finish
    // it again rather than leave it live with nothing to do.
    await completeInstanceIfDone(supabase, instance.id);
    return { ok: true };
  }

  // A reopened branch has not chosen yet, so whatever its skip (or its
  // losing side) took comes back with it. Left skipped, those lanes are
  // terminal: when the branch runs again and picks that side, the
  // winning lane does nothing (Task 36 re-review 2, N8). They come back
  // undated, because their branch is pending again, and the branch's next
  // run skips the side it does not take, as it always does.
  if (step.type === 'branch') {
    const restored = await restoreBranchLanes(supabase, instance.id, stepId);
    if (!restored) return { ok: false, error: REOPEN_UNSETTLED };
  }

  // The step is pending again, but the steps behind it keep the dates it
  // released until this recompute lands, so they could still run. On a
  // failure the instance is marked like any other, and the heal pass's
  // recompute does re-gate them (it writes null for a gated step). But
  // that is a tick away at best, and a follower already due could send
  // first, so the MC is told as well: untick it again retries the whole
  // reopen now. Alerted with the instance id.
  const regated = await settleAfterCompletion(supabase, instance.id, stepId, () =>
    recomputeInstance(supabase, instance),
  );
  if (!regated) return { ok: false, error: REOPEN_UNSETTLED };
  return { ok: true };
}

/**
 * Put every step the branch logic skipped under a reopened branch back
 * to `pending`, at any depth. Steps that finished (a lane that already
 * ran) keep their record, and so does a step skipped for any other
 * reason: one the MC skipped by hand, or one a resume or an apply
 * skipped because its time had passed. Restoring that one would date it
 * in the past once its lane is taken again, and it would send at once,
 * the late send the resume rule exists to stop (Phase 6 residual F3).
 * The branch skip marks its own steps (`skip_reason = 'branch'`,
 * `./branch-skip`); anything else carries null. Never throws: the branch
 * is already reopened, and the caller tells the MC to retry when this
 * did not land.
 *
 * @returns whether the restore landed
 */
async function restoreBranchLanes(
  supabase: SupabaseClient<Database>,
  instanceId: string,
  branchId: string,
): Promise<boolean> {
  try {
    const { data: rows, error: readError } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('instance_id', instanceId);
    throwIfReadFailed('executor.reopen_branch_read', readError);
    const steps = (rows ?? []) as unknown as WorkflowStepRow[];
    // Breadth first through every child, finished or not, so a nested
    // branch's lanes come back too.
    const skipped: WorkflowStepRow[] = [];
    const queue = [branchId];
    while (queue.length > 0) {
      const parent = queue.shift()!;
      for (const child of steps) {
        if (child.parent_step_id !== parent) continue;
        queue.push(child.id);
        if (child.status === 'skipped' && child.skip_reason === 'branch') skipped.push(child);
      }
    }
    if (skipped.length === 0) return true;
    const { error } = await supabase
      .from('workflow_steps')
      .update({ status: 'pending', completed_at: null, due_at: null, attempt_count: 0 })
      .in(
        'id',
        skipped.map((s) => s.id),
      )
      .eq('status', 'skipped')
      .eq('skip_reason', 'branch');
    throwIfReadFailed('executor.reopen_branch_lanes', error);
    return true;
  } catch (err) {
    console.error('[workflows] could not restore a reopened branch\'s lanes', branchId, describeFailure(err));
    return false;
  }
}

/**
 * What the MC is told when a reopen landed but re-gating the steps behind
 * it did not.
 */
export const REOPEN_UNSETTLED =
  'The step was reopened, but the steps after it could not be rescheduled. Tick and untick it again to retry.';

/**
 * Recompute `due_at` across an instance after any step transition.
 *
 * Exported for the resume path (`./resume`), which skips steps outside
 * the executor and has to release what they gated exactly as a skip
 * from the checklist does.
 *
 * Throws a `WorkflowReadError` when a read or a write fails, always.
 * It used to do that only when asked (a `strict` option the skip paths
 * passed) and otherwise quietly carry on: an unread step list wrote
 * nothing, which left the follower of a just-finished step undated for
 * good, and an unread wedding date or timezone wrote wrong dates. Every
 * caller now gets the strict behaviour; the tick counts the throw as a
 * failed read and alerts.
 *
 * @param supabase - service-role client
 * @param instance - the instance whose steps to reschedule
 */
export async function recomputeInstance(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
): Promise<void> {
  const [{ data: rows, error: rowsError }, weddingDate, timezone] = await Promise.all([
    supabase.from('workflow_steps').select('*').eq('instance_id', instance.id),
    loadWeddingDateOrThrow(supabase, instance.couple_id),
    loadMcTimezone(supabase, instance.user_id, true),
  ]);
  throwIfReadFailed('executor.recompute_steps', rowsError);

  const steps = (rows ?? []) as unknown as WorkflowStepRow[];
  const patch = recomputeDueDates(steps, {
    weddingDate,
    appliedAt: instance.applied_at,
    timezone,
  });

  const current = new Map(steps.map((s) => [s.id, s.due_at]));
  const status = new Map(steps.map((s) => [s.id, s.status]));
  const attempts = new Map(steps.map((s) => [s.id, s.attempt_count ?? 0]));
  const writes = await Promise.all(
    patch
      // Only write rows that actually changed: a blanket update would
      // churn every row on every tick and bump updated_at for nothing.
      .filter((p) => current.get(p.id) !== p.due_at)
      // A running step is excluded even when its computed due_at
      // legitimately changed, because writing it would bump updated_at
      // and rewind sweepStuckSteps's staleness window: a sibling
      // completing could then keep a genuinely stuck step alive
      // indefinitely, one recompute at a time. The database trigger
      // _workflow_recompute_wedding_steps never touches a running step
      // either; keep the two in sync if either changes.
      .filter((p) => status.get(p.id) !== 'running')
      // A step back in `pending` with attempts already spent is not
      // sitting on its template's timing, it is sitting on
      // handleFailure's backoff, and that due date is the only place the
      // backoff is recorded. Recomputing it from the template would
      // restore the original anchor, which is in the past, and the next
      // tick would retry immediately: three attempts inside one tick
      // rather than spread over six minutes, so a provider having a
      // genuinely bad five minutes still buries the workflow. Any
      // sibling completing is enough to trigger this, so the window is
      // not narrow. A manual "Try again" resets attempt_count to 0, so
      // the step goes back to being scheduled by its timing config.
      .filter((p) => !(status.get(p.id) === 'pending' && (attempts.get(p.id) ?? 0) > 0))
      // A `waiting` step's due_at is a time the engine chose when it
      // parked the step, never a schedule, and no `waiting` row is
      // rewritten here. Two kinds of park share the status:
      //
      // - An action parked by runOneStep's sleep branch: the send-volume
      //   limiter deferring it (`send_rate_limited`), a missing variable,
      //   or an MC's approval. Rewriting it from the template timing
      //   restores an anchor already in the past, so it re-runs and
      //   re-parks every minute (an audit row, and for missing variables
      //   a Slack alert, each time).
      // - A `wait` that has started sleeping. Its template timing says
      //   when the wait STARTS; evaluateWaitAction wrote the wake time
      //   (start plus the configured duration) into due_at. Rewriting it
      //   from the timing threw the duration away, so ticking any sibling
      //   to-do ended a three-day wait at the next tick and sent the step
      //   behind it days early. A wait that has not started is `pending`
      //   and is still recomputed like any other step.
      //
      // The one sleeping wake that should move is a wait "until N before
      // the wedding" when the wedding moves; the database function
      // _workflow_recompute_wedding_steps re-derives that from the wait's
      // own config. Keep the two in sync if either changes.
      .filter((p) => status.get(p.id) !== 'waiting')
      .map((p) =>
        supabase.from('workflow_steps').update({ due_at: p.due_at }).eq('id', p.id),
      ),
  );
  const writeError = writes.find((w) => w.error)?.error;
  throwIfReadFailed('executor.recompute_write', writeError);
}

/**
 * Complete the instance when nothing is left to do. Returns true if it did.
 *
 * Exported for the resume path (`./resume`): a resume that skips the
 * last outstanding steps leaves nothing to run, and without this the
 * workflow would sit "running" forever with no step left to finish it.
 *
 * @param supabase - service-role client
 * @param instanceId - the instance to check
 */
export async function completeInstanceIfDone(
  supabase: SupabaseClient<Database>,
  instanceId: string,
): Promise<boolean> {
  return completeLoadedInstanceIfDone(supabase, instanceId, await loadInstance(supabase, instanceId));
}

/**
 * {@link completeInstanceIfDone} for an instance the caller has just
 * read (the tick reads every instance it touched in one chunked batch).
 * Null is an instance that no longer exists.
 */
async function completeLoadedInstanceIfDone(
  supabase: SupabaseClient<Database>,
  instanceId: string,
  instance: WorkflowInstanceRow | null,
): Promise<boolean> {
  if (!instance || instance.status !== 'active') return false;
  // The default and personal instances are open-ended to-do lists, not
  // sequences with an end. Completing them would hide the couple's
  // checklist the moment they cleared it.
  if (instance.is_default || instance.is_personal) return false;

  // `errored` counts as outstanding even though the step will not run
  // again on its own. A workflow with a broken step has not finished: the
  // MC still has to fix the config and retry, and completing the instance
  // would hide it from the couple's checklist.
  // Both counts throw on a failed read. Read as zero, the first would
  // complete a workflow with steps still to run, and the second would
  // leave a finished one active with nothing left to finish it.
  const { count, error: outstandingError } = await supabase
    .from('workflow_steps')
    .select('id', { count: 'exact', head: true })
    .eq('instance_id', instanceId)
    .in('status', ['pending', 'running', 'waiting', 'errored']);
  throwIfReadFailed('executor.count_outstanding', outstandingError);

  if ((count ?? 0) > 0) return false;

  const { count: total, error: totalError } = await supabase
    .from('workflow_steps')
    .select('id', { count: 'exact', head: true })
    .eq('instance_id', instanceId);
  throwIfReadFailed('executor.count_steps', totalError);
  // An instance with no steps at all has not "completed"; it was empty.
  if ((total ?? 0) === 0) return false;

  // Guarded on still being active: a pause, Turn off or stop landing
  // between the read above and this write must win, or it would be
  // overwritten with `completed`, a state neither Turn on nor Resume
  // offers back.
  const { data: finished, error: finishError } = await supabase
    .from('workflow_instances')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', instanceId)
    .eq('status', 'active')
    .select('id');
  // An error is not "a pause won the race": the instance is still active.
  throwIfReadFailed('executor.complete_instance', finishError);
  if ((finished?.length ?? 0) !== 1) return false;
  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId,
    coupleId: instance.couple_id,
    event: 'instance_completed',
  });
  // After the guarded write, so it fires once and only for a completion
  // that landed. Never throws; see the emitter.
  await emitWorkflowCompleted(supabase, instance);
  return true;
}

/**
 * Merge one step's output into the instance context for later steps.
 *
 * In SQL, one statement (`workflow_merge_step_outputs`, 20261023900000):
 * this used to write the whole `context` back from the row the pass read,
 * so a concurrent writer's output (a kick pass, the MC's Run now, the
 * heal) that landed after that read was erased for good, and a follower
 * reading it (`update_task` finding the to-do `create_task` made) acted
 * on nothing. The merge now applies to whatever the row holds when it
 * runs, and this step's key wins.
 */
async function mergeStepOutput(
  supabase: SupabaseClient<Database>,
  instanceId: string,
  stepId: string,
  output: Json | null,
): Promise<void> {
  const { error } = await supabase.rpc('workflow_merge_step_outputs', {
    p_instance_id: instanceId,
    p_outputs: { [stepId]: output } as Json,
  });
  // Checked: a follower reads this output and would act on its absence.
  throwIfReadFailed('executor.merge_output', error);
}

/**
 * One instance, or null when it does not exist. Throws a
 * `WorkflowReadError` when the read fails: null there skipped the step
 * as if its workflow had gone, every tick, with nothing said.
 */
async function loadInstance(
  supabase: SupabaseClient<Database>,
  instanceId: string,
): Promise<WorkflowInstanceRow | null> {
  const { data, error } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle();
  throwIfReadFailed('executor.load_instance', error);
  return (data as unknown as WorkflowInstanceRow | null) ?? null;
}

/**
 * Reads one template's quiet hours. Throws a `WorkflowReadError` on a
 * failed read: "no override" would send inside the MC's quiet window.
 */
export type QuietHoursReader = (templateId: string | null) => Promise<QuietHours>;

/** What a woken wait should do, from {@link wakeHold}. */
export type WakeDecision =
  | { kind: 'finish' }
  | { kind: 'hold'; until: Date }
  | { kind: 'retry' };

/**
 * Decide whether a woken wait finishes now, holds out of quiet hours, or
 * waits for the next tick because the check itself could not run.
 *
 * A failure to build the context (a transient database error, say) is
 * `retry`, not `finish`: finishing without the check could release the
 * send behind the wait inside the MC's quiet hours, and leaving the row
 * `waiting` costs one tick. Not an error either, since erroring a wait
 * strands the whole workflow behind it.
 *
 * @param supabase - service-role client
 * @param instance - the wait's instance
 * @param step - the woken wait
 * @param now - the tick's clock, so the check and the pass agree on time
 * @param quietHoursFor - where the template's quiet hours come from (the
 *   tick's per-pass batch); unset, a read of its own
 */
export async function wakeHold(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
  now: Date,
  quietHoursFor: QuietHoursReader = (templateId) => loadQuietHours(supabase, templateId),
): Promise<WakeDecision> {
  try {
    const [ctx, quietHours] = await Promise.all([
      buildStepContext(supabase, instance, step),
      quietHoursFor(instance.template_id),
    ]);
    const until = quietHoursHoldUntil(step, ctx, quietHours, now);
    return until ? { kind: 'hold', until } : { kind: 'finish' };
  } catch (err) {
    console.error('[workflows] quiet-hours check on wake failed, retrying next tick', step.id, err);
    return { kind: 'retry' };
  }
}

/**
 * The template's quiet-hours override, if it has one. Throws when the
 * read fails: "no override" would send inside the MC's quiet window.
 */
async function loadQuietHours(
  supabase: SupabaseClient<Database>,
  templateId: string | null,
): Promise<QuietHours> {
  if (!templateId) return null;
  const { data, error } = await supabase
    .from('workflow_templates')
    .select('quiet_hours_start, quiet_hours_end')
    .eq('id', templateId)
    .maybeSingle();
  throwIfReadFailed('executor.load_quiet_hours', error, CONTEXT_UNREADABLE);
  if (!data) return null;
  return { start: data.quiet_hours_start, end: data.quiet_hours_end };
}

