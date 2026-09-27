/**
 * Applying a template to a couple.
 *
 * This is the one place the template-to-instance copy happens. It
 * **snapshots**: the instance's steps are independent rows, so editing or
 * deleting a template step afterwards never touches a couple's live
 * progress. That is Dubsado's safety property, and it avoids the Studio
 * Ninja bug where editing a workflow resets everyone's progress.
 *
 * It also avoids Dubsado's retroactive-fire gotcha: a wedding-anchored
 * step whose date has already passed when the workflow is applied is
 * skipped, never sent late (see {@link applyTemplate}).
 *
 * @module lib/workflows/instantiate
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendAlert } from '@/lib/alerts/send-alert';
import type { Database } from '@/types/database';
import type {
  StepTiming,
  StepType,
  WorkflowInstanceRow,
  WorkflowStepRow,
  WorkflowTemplateStepRow,
} from '@/types/workflows';
import { DEFAULT_STEP_TIMING } from '@/types/workflows';

import { writeAudit } from './audit';
import { abandonApply } from './interrupted-applies';
import { throwIfReadFailed, WorkflowReadError } from './read-failure';
import { settlePastOnApply } from './resume';
import { recomputeDueDates } from './timing';
import { loadWeddingDateOrThrow } from './wedding-date';

// Re-exported so existing callers keep one import site for instances.
export { ensureDefaultInstance, ensurePersonalInstance } from './instance-homes';

/** Fallback when the MC has never saved a timezone. */
const DEFAULT_TIMEZONE = 'Australia/Sydney';

export interface ApplyTemplateOptions {
  userId: string;
  templateId: string;
  /** Null for a personal (couple-less) instance. */
  coupleId: string | null;
  /** The bus event that triggered an automatic apply, when there was one. */
  triggerEventId?: string | null;
  /** Overrides the instance name; defaults to the template's name. */
  name?: string;
  /**
   * Refuse to apply when this template is already live on this couple.
   *
   * The dispatcher passes true: an automatic re-apply means duplicate
   * emails. The manual picker passes false, because an MC asking for a
   * second copy is making a deliberate choice.
   */
  dedupe?: boolean;
  /**
   * The template's `steps_revision` a pre-flight checked (the hand apply).
   * The apply refuses when the steps it snapshots are not the ones that
   * passed: checked before the instance exists, and again after the
   * snapshot read. Unset (the dispatcher) skips the check: an event-driven
   * apply enrols only on a template that was turned on through the
   * pre-flight.
   */
  expectedStepsRevision?: number;
}

/**
 * The outcome of an apply. `skipped: 'template_off'` means the template
 * was switched off between the caller choosing it and the insert, and
 * the database refused the enrolment (SQLSTATE `WF001`): a quiet skip,
 * not a failure. `skipped: 'stopped'` means something else stopped or
 * paused the instance while it was being built (an exit rule, a delete,
 * the interrupted-apply sweep, a manual pause), so it never went live:
 * not "started", and not an opened enrolment.
 *
 * `pausedReason: 'template_off'` means it was switched off after the
 * insert, while the instance was being built: the instance exists but
 * was left paused for Turn on to offer back. For the dispatcher that is
 * the same quiet skip, not an opened enrolment.
 */
export type ApplyTemplateResult =
  | { instanceId: string; pausedReason?: 'template_off' }
  | { error: string; skipped?: 'template_off' | 'stopped' | 'changed' };

type TemplateRow = Database['public']['Tables']['workflow_templates']['Row'];

/** The enrolment guard's own SQLSTATE (migration 20261008100000). */
const TEMPLATE_OFF_SQLSTATE = 'WF001';

/**
 * Read the MC's working timezone, falling back to Sydney when they have
 * never saved one. A failed read throws: falling back there would date
 * every step of the new workflow in the wrong zone, for good.
 */
async function loadTimezone(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  throwIfReadFailed('apply.load_timezone', error);
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

/**
 * Apply a template to a couple, snapshotting its steps.
 *
 * The instance is born `paused` (with no `paused_reason`) and only goes
 * live at the very end, so no tick can see it half built. In between:
 * the steps are inserted and dated, and every wedding-anchored action
 * whose date had already passed is skipped with an audit line
 * ({@link settlePastOnApply}). Inserted `active`, a tick landing after
 * the dates were written and before the skips would send those steps:
 * the same settle-then-flip order a resume uses.
 *
 * The final flip is `activate_applied_workflow_instance`, which agrees
 * with a concurrent Turn off. The Turn off sweep only pauses `active`
 * instances, so it cannot see this one mid-apply; the flip therefore
 * re-checks the template under a row lock and, if it went off, leaves
 * the instance paused as `template_off` for Turn on to offer back.
 *
 * The reads before the instance exists (the template, the MC's
 * timezone, the wedding date) throw a `WorkflowReadError` when they fail,
 * rather than answering "template not found" or a default. Nothing has
 * been written at that point, so the dispatcher can leave the event for
 * the next tick and the retry starts clean.
 *
 * @returns the new instance's id, or an error describing why not
 * @throws WorkflowReadError when a read before the insert fails
 */
export async function applyTemplate(
  supabase: SupabaseClient<Database>,
  opts: ApplyTemplateOptions,
): Promise<ApplyTemplateResult> {
  const { data: template, error: templateError } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('id', opts.templateId)
    .eq('user_id', opts.userId)
    .maybeSingle();
  // "Template not found" would mark the event handled with nothing opened.
  throwIfReadFailed('apply.load_template', templateError);

  if (!template) return { error: 'template not found' };
  if (template.status === 'archived') {
    return { error: 'template is archived' };
  }
  if (opts.expectedStepsRevision !== undefined && template.steps_revision !== opts.expectedStepsRevision) {
    return TEMPLATE_CHANGED;
  }

  if (opts.dedupe && !template.allow_reapply && opts.coupleId) {
    // The error is not checked, deliberately. This is only the early,
    // friendly answer: whenever this branch runs, `dedupeKey` below is
    // set, and the partial unique index refuses a second live instance
    // for the couple at the insert (23505, answered the same way). A
    // failed read here costs one insert attempt, never a duplicate.
    const { data: existing } = await supabase
      .from('workflow_instances')
      .select('id')
      .eq('template_id', opts.templateId)
      .eq('couple_id', opts.coupleId)
      .neq('status', 'cancelled')
      .limit(1);
    if (existing && existing.length > 0) {
      return { error: 'already applied to this couple' };
    }
  }

  const [timezone, weddingDate] = await Promise.all([
    loadTimezone(supabase, opts.userId),
    // The throwing variant: "no wedding date" would leave every
    // wedding-anchored step undated, and nothing re-dates them later.
    loadWeddingDateOrThrow(supabase, opts.coupleId),
  ]);

  const appliedAt = new Date().toISOString();

  // Null when a repeat enrolment is legitimate, so it never collides.
  // Set to the template id otherwise, which is what the partial unique
  // index keys off: the race the pre-check above cannot win is settled
  // by Postgres instead.
  const dedupeKey =
    opts.dedupe && !template.allow_reapply && opts.coupleId ? opts.templateId : null;

  // Born paused, reason null: the executor ignores it until goLive below.
  // The reason stays null so neither Turn on nor a manual resume ever
  // mistakes a half-built enrolment for one of theirs.
  const { data: instanceRow, error: instanceError } = await supabase
    .from('workflow_instances')
    .insert({
      user_id: opts.userId,
      couple_id: opts.coupleId,
      template_id: opts.templateId,
      name: opts.name ?? template.name,
      template_version: template.version,
      trigger_event_id: opts.triggerEventId ?? null,
      applied_at: appliedAt,
      dedupe_key: dedupeKey,
      status: 'paused',
      paused_reason: null,
    })
    .select('*')
    .single();
  const instance = instanceRow as unknown as WorkflowInstanceRow | null;

  if (instanceError) {
    // 23505: the other side of the race got there first. That is the
    // index doing its job, not a failure worth surfacing.
    if (instanceError.code === '23505') return { error: 'already applied to this couple' };
    // WF001: the template was turned off after the dispatcher loaded it
    // as a candidate. An off workflow takes no new couples; that is the
    // guard doing its job, same as the index above.
    if (instanceError.code === TEMPLATE_OFF_SQLSTATE) {
      return { error: 'template is off', skipped: 'template_off' };
    }
    // Any other insert failure wrote nothing, so the apply can be retried
    // whole: thrown as a read failure, the dispatcher leaves the event for
    // the next tick rather than marking it handled with nothing opened.
    throw new WorkflowReadError('apply.insert_instance', instanceError);
  }
  if (!instance) return { error: 'could not create instance' };

  // Anything that goes wrong from here leaves a half-built row holding
  // the couple's dedupe_key. Cancel it, so the key is released and it
  // can never be resumed into a live, unsettled workflow.
  let built: ApplyTemplateResult;
  try {
    built = await buildAndGoLive(supabase, {
      opts,
      template,
      instance,
      weddingDate,
      appliedAt,
      timezone,
    });
  } catch (err) {
    built = { error: err instanceof Error ? err.message : String(err) };
  }
  if ('error' in built) {
    await abandonApply(supabase, instance);
    // A race with the MC's own edit is not a broken workflow.
    if (built.skipped !== 'changed') await alertApplyFailed(opts, instance.id);
  }
  return built;
}

/**
 * One `workflow_apply_failed` alert per workflow per ten minutes. A
 * broken template fails for every couple it matches, and one line per
 * couple would bury the channel; the first names the workflow.
 */
const APPLY_FAILED_ALERT_WINDOW_MS = 10 * 60 * 1000;

/** Per template, when its last apply-failed alert went. */
const applyFailedAlertAt = new Map<string, number>();

/** Test-only: forget every workflow's apply-failed dedupe state. */
export function _resetApplyFailedAlertDedupForTest(): void {
  applyFailedAlertAt.clear();
}

/**
 * Say that an apply failed after its instance existed (Task 36 fix
 * round 1). The instance is cancelled as `setup_interrupted`, which the
 * couple's Stopped strip shows with "Start it again instead", and the
 * dispatcher marks the event handled because the per-event unique index
 * would refuse a retry. Without this alert that was silent. Ids only.
 */
async function alertApplyFailed(opts: ApplyTemplateOptions, instanceId: string): Promise<void> {
  const now = Date.now();
  const last = applyFailedAlertAt.get(opts.templateId);
  if (last !== undefined && now - last < APPLY_FAILED_ALERT_WINDOW_MS) return;
  applyFailedAlertAt.set(opts.templateId, now);
  // Awaited so it survives a Vercel handler returning; the Slack
  // transport bounds it.
  await sendAlert({
    type: 'workflow_apply_failed',
    severity: 'error',
    userId: opts.userId,
    templateId: opts.templateId,
    coupleId: opts.coupleId ?? null,
    instanceId,
    triggerEventId: opts.triggerEventId ?? null,
  }).catch(() => undefined);
}

/**
 * Everything an apply does once the instance row exists: snapshot the
 * steps, date them, settle the past ones, and go live. Any error it
 * returns (or throws) is the caller's cue to abandon the instance.
 */
async function buildAndGoLive(
  supabase: SupabaseClient<Database>,
  ctx: {
    opts: ApplyTemplateOptions;
    template: TemplateRow;
    instance: WorkflowInstanceRow;
    weddingDate: string | null;
    appliedAt: string;
    timezone: string;
  },
): Promise<ApplyTemplateResult> {
  const { opts, template, instance, weddingDate, appliedAt, timezone } = ctx;

  const { data: templateSteps, error: stepsError } = await supabase
    .from('workflow_template_steps')
    .select('*')
    .eq('template_id', opts.templateId)
    .eq('disabled', false)
    .order('position', { ascending: true });
  // A failed read would otherwise build an instance with no steps.
  if (stepsError) return { error: stepsError.message };

  // The revision read AFTER the snapshot: if it still matches what the
  // pre-flight checked, no step write committed in between (each bumps it
  // in its own transaction), so these are the steps that passed.
  if (opts.expectedStepsRevision !== undefined) {
    const { data: after, error: afterError } = await supabase
      .from('workflow_templates')
      .select('steps_revision')
      .eq('id', opts.templateId)
      .maybeSingle();
    if (afterError) return { error: afterError.message };
    if (after?.steps_revision !== opts.expectedStepsRevision) return TEMPLATE_CHANGED;
  }

  const source = (templateSteps ?? []) as unknown as WorkflowTemplateStepRow[];

  // Parents before children, so a child's parent_step_id can be remapped
  // from the template step id to the newly inserted instance step id.
  const roots = source.filter((s) => s.parent_step_id === null);
  const children = source.filter((s) => s.parent_step_id !== null);

  /** Template step id to instance step id. */
  const idMap = new Map<string, string>();

  const insertLayer = async (
    layer: WorkflowTemplateStepRow[],
  ): Promise<string | null> => {
    if (layer.length === 0) return null;
    // Uniform keys on every row: a supabase-js array insert whose rows
    // have differing key sets silently drops rows rather than erroring.
    const rows = layer.map((s) => ({
      instance_id: instance.id,
      template_step_id: s.id,
      position: s.position,
      type: s.type as StepType,
      config: s.config,
      title: s.title,
      description: s.description,
      timing: (s.timing ?? DEFAULT_STEP_TIMING) as unknown as StepTiming,
      parent_step_id: s.parent_step_id ? (idMap.get(s.parent_step_id) ?? null) : null,
      branch_path: s.branch_path,
      requires_approval: s.requires_approval,
      visible_to_couple: s.visible_to_couple,
      status: 'pending' as const,
      due_at: null,
    }));
    const { data, error } = await supabase
      .from('workflow_steps')
      .insert(rows as never)
      .select('id, template_step_id');
    if (error) return error.message;
    if (!data || data.length !== layer.length) {
      return `snapshot inserted ${data?.length ?? 0} of ${layer.length} steps`;
    }
    for (const row of data) {
      if (row.template_step_id) idMap.set(row.template_step_id, row.id);
    }
    return null;
  };

  const rootError = await insertLayer(roots);
  if (rootError) return { error: rootError };
  const childError = await insertLayer(children);
  if (childError) return { error: childError };

  const { data: inserted, error: insertedError } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('instance_id', instance.id);
  if (insertedError) return { error: insertedError.message };

  const steps = (inserted ?? []) as unknown as WorkflowStepRow[];
  const patch = recomputeDueDates(steps, { weddingDate, appliedAt, timezone });
  const dated = await Promise.all(
    patch
      .filter((p) => p.due_at !== null)
      .map((p) =>
        supabase.from('workflow_steps').update({ due_at: p.due_at }).eq('id', p.id),
      ),
  );
  // An undated step never runs, and the settle below cannot judge it.
  const dateError = dated.find((r) => r.error)?.error;
  if (dateError) return { error: dateError.message };

  await writeAudit(supabase, {
    userId: opts.userId,
    instanceId: instance.id,
    coupleId: opts.coupleId,
    event: 'instance_created',
    detail: { templateId: opts.templateId, stepCount: steps.length },
  });

  // Something may have stopped or paused the instance while it was being
  // built. A cancel marks only the steps that existed at that moment (the
  // trigger in 20261011000000 fires on the transition), so steps inserted
  // after it would sit `pending` on a stopped instance, reading as live.
  if (!(await stillBuilding(supabase, instance.id))) return STOPPED;

  await settlePastOnApply(supabase, instance, { weddingDate, timezone });

  // An event-driven enrolment was checked against an active template at
  // insert (the WF001 guard), and a manual apply of an active template
  // would have been swept by a Turn off had it been live, so both must
  // still find it active. A draft applied by hand goes live unless it was
  // archived since it was loaded (the status passed along here).
  const live = await goLive(supabase, instance, {
    requireActive: Boolean(opts.triggerEventId) || template.status === 'active',
    loadedStatus: template.status,
    workflowName: template.name,
  });
  if ('error' in live) return live;
  // Null: the flip found the instance no longer building. Something
  // stopped or paused it after the check above, so it is not live.
  if (live.outcome === null) return STOPPED;
  return live.outcome === 'paused'
    ? { instanceId: instance.id, pausedReason: 'template_off' }
    : { instanceId: instance.id };
}

/**
 * What a hand apply returns when the workflow's steps changed after its
 * pre-flight. The MC's own edit raced their own click, so it is a
 * sentence to retry on, not an alert.
 */
const TEMPLATE_CHANGED = {
  error: 'This workflow changed while it was being started. Try again.',
  skipped: 'changed',
} as const satisfies ApplyTemplateResult;

/** What an apply returns when the instance left the building state under it. */
const STOPPED = {
  error: 'This workflow was stopped or paused while it was being set up.',
  skipped: 'stopped',
} as const satisfies ApplyTemplateResult;

/**
 * Is the instance still being built (`paused`, no reason)? When it is
 * not and it was stopped, its open steps are marked `cancelled` to match
 * what the cancel trigger did to the ones that existed then. A pause
 * (manual) is left as it is: Resume settles its steps like any other.
 *
 * @throws when the read or the write fails, which abandons the apply
 */
async function stillBuilding(
  supabase: SupabaseClient<Database>,
  instanceId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('workflow_instances')
    .select('status, paused_reason')
    .eq('id', instanceId)
    .maybeSingle();
  if (error) throw new Error(`re-read instance: ${error.message}`);
  if (data?.status === 'paused' && data.paused_reason === null) return true;
  if (data?.status === 'cancelled') {
    const { error: cancelError } = await supabase
      .from('workflow_steps')
      .update({ status: 'cancelled' })
      .eq('instance_id', instanceId)
      .in('status', ['pending', 'waiting']);
    if (cancelError) throw new Error(`cancel stopped steps: ${cancelError.message}`);
  }
  return false;
}

/**
 * Flip a freshly built instance live, or leave it paused as
 * `template_off` when its workflow was turned off during the apply.
 *
 * @returns an error, or which way it went (null: the instance had
 *   already left the building state, for example a manual pause)
 */
async function goLive(
  supabase: SupabaseClient<Database>,
  instance: WorkflowInstanceRow,
  opts: { requireActive: boolean; loadedStatus: string; workflowName: string },
): Promise<{ error: string } | { outcome: 'active' | 'paused' | null }> {
  const { data: outcome, error } = await supabase.rpc('activate_applied_workflow_instance', {
    p_instance_id: instance.id,
    p_require_active: opts.requireActive,
    p_loaded_status: opts.loadedStatus,
  });
  if (error) return { error: error.message };
  if (outcome === 'paused') {
    // Worded exactly as the Turn off sweep words its own pauses, so the
    // feed reads the same whichever side of the race won.
    await writeAudit(supabase, {
      userId: instance.user_id,
      instanceId: instance.id,
      coupleId: instance.couple_id,
      event: 'instance_paused',
      detail: { reason: 'template_off', workflow: opts.workflowName },
    });
    return { outcome: 'paused' };
  }
  return { outcome: outcome === 'active' ? 'active' : null };
}
