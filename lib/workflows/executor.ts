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

import { writeAudit } from './audit';
import { buildStepContext } from './context';
import { executeStep } from './execute-step';
import { loadWeddingDate } from './instantiate';
import { AUTOMATED_STEP_TYPES, isAutomated } from './steps';
import { recomputeDueDates } from './timing';

/** How many steps one tick will execute before yielding. */
const STEP_BUDGET_PER_TICK = 200;

/** Fallback when the MC has never saved a timezone. */
const DEFAULT_TIMEZONE = 'Australia/Sydney';

export interface ExecutorResult {
  stepsExecuted: number;
  instancesCompleted: number;
  errors: number;
}

/** Statuses a step can no longer move on from. */
const TERMINAL = new Set(['done', 'skipped', 'errored']);

/**
 * Is this step ready to run right now?
 *
 * Pure, and exported so the decision can be tested without a database.
 * Every clause here is load-bearing:
 *
 * - a null `due_at` means gated behind an unfinished predecessor
 * - manual types are the MC's to tick, never the engine's to run
 * - an approval gate holds until the approval is recorded
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

/**
 * Advance every due automated step across all active instances.
 *
 * @param opts.userId - only this owner's instances. Set by the
 *   immediate kick a mutation fires for the MC who caused it
 *   (`./kick`): a step that just came due for them must not mean
 *   running every other tenant's backlog on their request. The cron
 *   leaves it unset and sweeps everyone.
 */
export async function advanceDueSteps(
  supabase: SupabaseClient<Database>,
  opts: { userId?: string } = {},
): Promise<ExecutorResult> {
  const now = new Date();

  // Steps carry no owner column - they hang off the instance - so the
  // scoped pass resolves the instances first. No instances means there
  // is nothing this user could possibly run.
  let instanceIds: string[] | null = null;
  if (opts.userId) {
    const { data } = await supabase
      .from('workflow_instances')
      .select('id')
      .eq('user_id', opts.userId)
      .eq('status', 'active');
    instanceIds = (data ?? []).map((row) => row.id);
    if (instanceIds.length === 0) {
      return { stepsExecuted: 0, instancesCompleted: 0, errors: 0 };
    }
  }

  // Everything `isExecutable` would refuse is refused in SQL too, so it
  // cannot eat the budget below: a manual to-do and a send held for the
  // MC's OK are both due forever until a person acts on them.
  let dueQuery = supabase
    .from('workflow_steps')
    .select('*')
    .in('status', ['pending', 'waiting'])
    .in('type', AUTOMATED_STEP_TYPES)
    .eq('requires_approval', false)
    .not('due_at', 'is', null)
    .lte('due_at', now.toISOString());

  if (instanceIds) dueQuery = dueQuery.in('instance_id', instanceIds);

  const { data: dueRows } = await dueQuery
    .order('due_at', { ascending: true })
    // Two steps of one workflow can fall due at the same instant (a
    // template applied with zero offsets, say). Position breaks the tie,
    // so a step that reads the previous step's output through
    // `ctx.actionResults` still runs after the step that produced it.
    .order('instance_id', { ascending: true })
    .order('position', { ascending: true })
    .limit(STEP_BUDGET_PER_TICK);

  const candidates = ((dueRows ?? []) as unknown as WorkflowStepRow[]).filter((s) =>
    isExecutable(s, now),
  );

  let stepsExecuted = 0;
  let errors = 0;
  const touchedInstances = new Set<string>();

  for (const step of candidates) {
    const instance = await loadInstance(supabase, step.instance_id);
    // A cancelled or completed instance keeps its steps but must not run
    // them. Guarding here rather than in the query keeps the hot index
    // simple.
    if (!instance || instance.status !== 'active') continue;

    touchedInstances.add(instance.id);
    try {
      await runOneStep(supabase, instance, step);
      stepsExecuted += 1;
    } catch (err) {
      errors += 1;
      console.error('[workflows] step execution threw', step.id, err);
      await markErrored(
        supabase,
        instance,
        step,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  let instancesCompleted = 0;
  for (const instanceId of touchedInstances) {
    if (await completeInstanceIfDone(supabase, instanceId)) instancesCompleted += 1;
  }

  return { stepsExecuted, instancesCompleted, errors };
}

/** Execute one step and write its outcome. */
async function runOneStep(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
): Promise<void> {
  // A wait that has already slept is finished the moment its wake time
  // passes. Re-running executeStep here would call evaluateWaitAction
  // again, compute a fresh wake time from `now`, and sleep forever.
  if (step.type === 'wait' && step.status === 'waiting') {
    await supabase
      .from('workflow_steps')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', step.id);
    await writeAudit(supabase, {
      userId: instance.user_id,
      instanceId: instance.id,
      stepId: step.id,
      coupleId: instance.couple_id,
      event: 'step_completed',
      detail: { type: 'wait' },
    });
    await recomputeInstance(supabase, instance);
    return;
  }

  await supabase.from('workflow_steps').update({ status: 'running' }).eq('id', step.id);
  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId: instance.id,
    stepId: step.id,
    coupleId: instance.couple_id,
    event: 'step_started',
    detail: { type: step.type },
  });

  const ctx = await buildStepContext(supabase, instance, step);
  const quietHours = await loadQuietHours(supabase, instance.template_id);
  const { result, branchPath } = await executeStep(step, ctx, quietHours);

  switch (result.kind) {
    case 'ok': {
      await supabase
        .from('workflow_steps')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
          output: (result.output ?? null) as Json,
          error_message: null,
        })
        .eq('id', step.id);

      await mergeStepOutput(supabase, instance, step.id, result.output ?? null);

      if (branchPath) {
        await skipLosingBranch(supabase, instance, step, branchPath);
        await writeAudit(supabase, {
          userId: instance.user_id,
          instanceId: instance.id,
          stepId: step.id,
          coupleId: instance.couple_id,
          event: 'branch_taken',
          detail: { path: branchPath },
        });
      }

      await writeAudit(supabase, {
        userId: instance.user_id,
        instanceId: instance.id,
        stepId: step.id,
        coupleId: instance.couple_id,
        event: 'step_completed',
        detail: (result.output ?? {}) as Json,
      });
      break;
    }

    case 'sleep': {
      await supabase
        .from('workflow_steps')
        .update({
          status: 'waiting',
          due_at: result.wakeAt,
          ...(result.token
            ? { approval_token: result.token, requires_approval: true }
            : {}),
        })
        .eq('id', step.id);
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
          couple_name?: string | null;
        };
        void sendAlert({
          type: 'automation_paused_missing_variables',
          severity: 'warn',
          automationId: instance.template_id ?? instance.id,
          runId: instance.id,
          coupleName: payload.couple_name ?? null,
          missingVariables: payload.missing ?? [],
        });
      }

      // A sleeping step has not completed, so nothing behind it is
      // released. Return before the recompute.
      return;
    }

    case 'error': {
      await markErrored(supabase, instance, step, result.message);
      return;
    }
  }

  await recomputeInstance(supabase, instance);
}

/** Write an errored outcome plus its audit row. */
async function markErrored(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  step: WorkflowStepRow,
  message: string,
): Promise<void> {
  await supabase
    .from('workflow_steps')
    .update({
      status: 'errored',
      error_message: message,
      completed_at: new Date().toISOString(),
    })
    .eq('id', step.id);
  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId: instance.id,
    stepId: step.id,
    coupleId: instance.couple_id,
    event: 'step_errored',
    detail: { message },
  });
  // The instance deliberately stays `active`: the MC can fix the config
  // and retry rather than losing the whole workflow to one bad step.
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
 *
 * @param supabase - RLS-scoped client for the approving user
 * @param stepId - the step to run
 */
export async function runStepNow(
  supabase: SupabaseClient<Database>,
  stepId: string,
): Promise<boolean> {
  const { data: stepRow } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('id', stepId)
    .maybeSingle();
  const step = stepRow as unknown as WorkflowStepRow | null;
  if (!step) return false;
  if (!isAutomated(step.type)) return false;
  if (TERMINAL.has(step.status) || step.status === 'running') return false;

  const instance = await loadInstance(supabase, step.instance_id);
  if (!instance || instance.status !== 'active') return false;

  await runOneStep(supabase, instance, {
    ...step,
    // The gate is spent the moment the MC approves. Clearing it on the
    // in-memory row as well as the table keeps `runOneStep` from seeing
    // a stale value if it re-reads.
    requires_approval: false,
  });
  await completeInstanceIfDone(supabase, instance.id);
  return true;
}

/**
 * Mark a manual step done or skipped, and release whatever it gated.
 *
 * This is the path the couple-profile checkbox and the queue both call.
 * The recompute at the end is the whole point: without it, an automated
 * step anchored `after_previous` behind this one would keep its null
 * `due_at` and never run.
 */
export async function completeStep(
  supabase: SupabaseClient<Database>,
  stepId: string,
  opts: { skipped?: boolean } = {},
): Promise<void> {
  const { data: stepRow } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('id', stepId)
    .maybeSingle();
  const step = stepRow as unknown as WorkflowStepRow | null;
  if (!step) return;

  const instance = await loadInstance(supabase, step.instance_id);
  if (!instance) return;

  const status = opts.skipped ? 'skipped' : 'done';
  await supabase
    .from('workflow_steps')
    .update({ status, completed_at: new Date().toISOString() })
    .eq('id', stepId);

  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId: instance.id,
    stepId,
    coupleId: instance.couple_id,
    event: opts.skipped ? 'step_skipped' : 'step_completed',
    detail: { manual: true },
  });

  await recomputeInstance(supabase, instance);
  await completeInstanceIfDone(supabase, instance.id);
}

/** Re-open a step the MC un-ticked, and re-gate whatever it released. */
export async function reopenStep(
  supabase: SupabaseClient<Database>,
  stepId: string,
): Promise<void> {
  const { data: stepRow } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('id', stepId)
    .maybeSingle();
  const step = stepRow as unknown as WorkflowStepRow | null;
  if (!step) return;

  const instance = await loadInstance(supabase, step.instance_id);
  if (!instance) return;

  await supabase
    .from('workflow_steps')
    .update({ status: 'pending', completed_at: null })
    .eq('id', stepId);

  // An instance that had completed goes back to active: un-ticking a step
  // means there is work outstanding again.
  if (instance.status === 'completed') {
    await supabase
      .from('workflow_instances')
      .update({ status: 'active', completed_at: null })
      .eq('id', instance.id);
  }

  await recomputeInstance(supabase, instance);
}

/** Recompute `due_at` across an instance after any step transition. */
async function recomputeInstance(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
): Promise<void> {
  const [{ data: rows }, weddingDate, timezone] = await Promise.all([
    supabase.from('workflow_steps').select('*').eq('instance_id', instance.id),
    loadWeddingDate(supabase, instance.couple_id),
    loadTimezone(supabase, instance.user_id),
  ]);

  const steps = (rows ?? []) as unknown as WorkflowStepRow[];
  const patch = recomputeDueDates(steps, {
    weddingDate,
    appliedAt: instance.applied_at,
    timezone,
  });

  const current = new Map(steps.map((s) => [s.id, s.due_at]));
  await Promise.all(
    patch
      // Only write rows that actually changed: a blanket update would
      // churn every row on every tick and bump updated_at for nothing.
      .filter((p) => current.get(p.id) !== p.due_at)
      .map((p) =>
        supabase.from('workflow_steps').update({ due_at: p.due_at }).eq('id', p.id),
      ),
  );
}

/**
 * Mark the losing side of a branch skipped.
 *
 * Skipped rather than deleted: the MC can see which way the workflow went
 * and why, and a skipped step still releases anything anchored after it.
 */
async function skipLosingBranch(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  branchStep: WorkflowStepRow,
  taken: 'yes' | 'no',
): Promise<void> {
  const losing = taken === 'yes' ? 'no' : 'yes';
  await supabase
    .from('workflow_steps')
    .update({ status: 'skipped', completed_at: new Date().toISOString() })
    .eq('parent_step_id', branchStep.id)
    .eq('branch_path', losing)
    .in('status', ['pending', 'waiting']);
  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId: instance.id,
    stepId: branchStep.id,
    coupleId: instance.couple_id,
    event: 'step_skipped',
    detail: { reason: 'branch not taken', path: losing },
  });
}

/** Complete the instance when nothing is left to do. Returns true if it did. */
async function completeInstanceIfDone(
  supabase: SupabaseClient<Database>,
  instanceId: string,
): Promise<boolean> {
  const instance = await loadInstance(supabase, instanceId);
  if (!instance || instance.status !== 'active') return false;
  // The default and personal instances are open-ended to-do lists, not
  // sequences with an end. Completing them would hide the couple's
  // checklist the moment they cleared it.
  if (instance.is_default || instance.is_personal) return false;

  // `errored` counts as outstanding even though the step will not run
  // again on its own. A workflow with a broken step has not finished: the
  // MC still has to fix the config and retry, and completing the instance
  // would hide it from the couple's checklist.
  const { count } = await supabase
    .from('workflow_steps')
    .select('id', { count: 'exact', head: true })
    .eq('instance_id', instanceId)
    .in('status', ['pending', 'running', 'waiting', 'errored']);

  if ((count ?? 0) > 0) return false;

  const { count: total } = await supabase
    .from('workflow_steps')
    .select('id', { count: 'exact', head: true })
    .eq('instance_id', instanceId);
  // An instance with no steps at all has not "completed"; it was empty.
  if ((total ?? 0) === 0) return false;

  await supabase
    .from('workflow_instances')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', instanceId);
  await writeAudit(supabase, {
    userId: instance.user_id,
    instanceId,
    coupleId: instance.couple_id,
    event: 'instance_completed',
  });
  return true;
}

/** Merge one step's output into the instance context for later steps. */
async function mergeStepOutput(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  stepId: string,
  output: Json | null,
): Promise<void> {
  const context = (instance.context ?? {}) as Record<string, unknown>;
  const existing = (context['step_outputs'] ?? {}) as Record<string, unknown>;
  await supabase
    .from('workflow_instances')
    .update({
      context: { ...context, step_outputs: { ...existing, [stepId]: output } } as Json,
    })
    .eq('id', instance.id);
}

async function loadInstance(
  supabase: SupabaseClient<Database>,
  instanceId: string,
): Promise<WorkflowInstanceRow | null> {
  const { data } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle();
  return (data as unknown as WorkflowInstanceRow | null) ?? null;
}

/** The template's quiet-hours override, if it has one. */
async function loadQuietHours(
  supabase: SupabaseClient<Database>,
  templateId: string | null,
): Promise<{ start: string | null; end: string | null } | null> {
  if (!templateId) return null;
  const { data } = await supabase
    .from('workflow_templates')
    .select('quiet_hours_start, quiet_hours_end')
    .eq('id', templateId)
    .maybeSingle();
  if (!data) return null;
  return { start: data.quiet_hours_start, end: data.quiet_hours_end };
}

async function loadTimezone(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}
