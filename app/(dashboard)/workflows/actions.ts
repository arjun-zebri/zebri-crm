/**
 * Server actions for the Workflows builder and template library.
 *
 * Lifts mutations out of the client components so the page and builder
 * stay presentational. All actions are RLS-scoped via the server
 * Supabase client; the calling user is the source of truth.
 *
 * # The step-type adapter
 *
 * The builder canvas thinks in **action slugs**: a node's type is
 * `send_email`, `wait`, `branch`, and so on. The workflows schema splits
 * that into a small `type` enum plus `config.actionType`. The split and
 * join happen at the data boundary, in `splitStepType` and
 * `joinStepType` (`lib/workflows/steps.ts`). That is what lets all forty
 * builder components, their chips and their composer modals carry over
 * untouched.
 *
 * # The apply-rule adapter
 *
 * The same trick, one level up. The canvas picks a **trigger** out of the
 * registry; `workflow_templates.apply_rule_type` is a five-member CHECK
 * constraint. `joinApplyRule` / `splitApplyRule`
 * (`lib/workflows/apply-rules.ts`) translate at the data boundary, so the
 * whole trigger vocabulary stays expressible and the pickers, chips and
 * filter editors never learn a second set of slugs.
 *
 * @module app/(dashboard)/workflows/actions
 */
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { buildPublicBranding, type UserMetadata } from '@/lib/branding/public-branding'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { actionFailureMessage } from '@/lib/workflows/action-failure'
import { joinApplyRule } from '@/lib/workflows/apply-rules'
import { writeAuditMany } from '@/lib/workflows/audit'
import { exitRuleRefusal } from '@/lib/workflows/exit-rule-guard'
import { MAX_EXIT_STATUSES, normaliseExitStatuses } from '@/lib/workflows/exit-rules'
import {
  loadTemplatePreflight,
  preflightRefusal,
  type PreflightProblem,
  type TemplatePreflight,
} from '@/lib/workflows/preflight'
import { WorkflowReadError } from '@/lib/workflows/read-failure'
import { normalizeWaitStep, validateStepConfig } from '@/lib/workflows/step-config-validation'
import { splitStepType } from '@/lib/workflows/steps'
import { parseStepTiming, stepTimingSchema } from '@/lib/workflows/timing-schema'
import type { Json } from '@/types/database'
import type { WorkflowTemplateRow } from '@/types/workflows'

import { resumeInstanceAction } from './instance-actions'

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

/* ─── templates ──────────────────────────────────────────────────── */

const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  applyRuleType: z.string().min(1).default('manual'),
  applyRuleConfig: z.record(z.string(), z.any()).default({}),
  description: z.string().max(2000).optional(),
})

/** Create a draft template. New templates never apply until activated. */
export async function createWorkflowTemplateAction(
  input: z.infer<typeof createTemplateSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTemplateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }
  const rule = joinApplyRule(parsed.data.applyRuleType, parsed.data.applyRuleConfig)
  const { data, error } = await supabase
    .from('workflow_templates')
    .insert({
      user_id: auth.user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      apply_rule_type: rule.applyRuleType,
      apply_rule_config: rule.applyRuleConfig as Json,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'failed' }
  revalidatePath('/workflows')
  return { ok: true, data: { id: data.id } }
}

const templateIdSchema = z.object({ templateId: z.string().uuid() })

const setStatusSchema = z.object({
  templateId: z.string().uuid(),
  status: z.enum(['draft', 'active', 'archived']),
  /** Turning on only: also resume the couples the switch paused. */
  resumePaused: z.boolean().optional(),
})

/** The template is not the caller's, or no longer exists. */
const WORKFLOW_NOT_FOUND = 'Workflow not found.'

/** A step was added, removed or edited between the pre-flight and the flip. */
const CHANGED_WHILE_CHECKING =
  'This workflow changed while it was being checked. Try Turn on again.'

/** What a status change did to the couples running the workflow. */
export interface TemplateStatusChange {
  /** Couples paused because the workflow was turned off. */
  paused: number
  /** Couples resumed because the MC asked, on turning it back on. */
  resumed: number
  /**
   * Couples the MC asked to resume that are still paused (a resume that
   * failed part way). They keep `template_off`, so turning the workflow
   * on again offers them again.
   */
  stillPaused: number
}

/**
 * Move a template between draft, active and archived.
 *
 * There is no `paused`: the automations model had one, but a template
 * that should stop applying is a draft again, and one that should not
 * be offered at all is archived. Two states covered what three did.
 *
 * Any move to draft or archived also pauses every couple running it,
 * each marked `paused_reason = 'template_off'` with a feed line naming
 * the workflow. The flip and the pause are one transaction
 * (`set_workflow_template_status`), so a failure leaves the switch on and
 * a retry is real, and the sweep runs on every move to off, so a retry
 * or a template turned off before this existed repairs itself. A step
 * already claimed by a tick when this lands still finishes; only the
 * steps after it stop.
 *
 * Turning it on is refused while the Turn on pre-flight finds anything
 * unfinished (`lib/workflows/preflight`, Task 34), with every problem
 * named. This is the one server gate: the canvas button and the library
 * card both land here, and their own check is only there to show the
 * list before the click. The database holds the rest of the line: a
 * client cannot set `active` itself (a trigger on the template row), and
 * the flip function is service role only, so it is called with the admin
 * client once ownership and the pre-flight have passed on the MC's own
 * RLS client. It re-reads the steps under the template's row lock and
 * refuses (WF002) if one changed after the pre-flight read them. Turning
 * off is never gated: an unfinished workflow must always be stoppable.
 *
 * Turning it back on resumes nothing by itself. With `resumePaused`, the
 * couples the switch paused are resumed through
 * {@link resumeInstanceAction}, the one resume path, so a step that fell
 * due while the workflow was off is skipped, not sent. A couple the MC
 * paused by hand (`manual`) is never touched.
 */
export async function setTemplateStatusAction(
  input: z.infer<typeof setStatusSchema>,
): Promise<ActionResult<TemplateStatusChange>> {
  const parsed = setStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const { templateId, status, resumePaused } = parsed.data
  const supabase = await createClient()

  // RLS makes this read the ownership check, and it names the workflow
  // in the feed lines below. It is the ONLY ownership check: the flip
  // below runs as the service role, which RLS does not scope.
  const { data: current, error: readError } = await supabase
    .from('workflow_templates')
    .select('id, name')
    .eq('id', templateId)
    .maybeSingle()
  // A read that failed is not "not found" (Phase 6 review M2): the MC
  // would be told their workflow is gone during an outage.
  if (readError) {
    return { ok: false, error: actionFailureMessage(new WorkflowReadError('setTemplateStatusAction.read', readError), 'setTemplateStatusAction') }
  }
  if (!current) return { ok: false, error: WORKFLOW_NOT_FOUND }

  let checked: TemplatePreflight | null = null
  if (status === 'active') {
    // Fails closed: a read that failed refuses the Turn on rather than
    // waving through steps nobody looked at.
    try {
      checked = await loadTemplatePreflight(supabase, templateId)
    } catch (err) {
      return { ok: false, error: actionFailureMessage(err, 'setTemplateStatusAction.preflight') }
    }
    if (checked.problems.length > 0) return { ok: false, error: preflightRefusal(checked.problems) }
  }

  const { data: paused, error } = await createAdminClient().rpc('set_workflow_template_status', {
    p_template_id: templateId,
    p_status: status,
    ...(checked ? { p_expected_steps_revision: checked.stepsRevision } : {}),
  })
  if (error?.code === 'WF002') return { ok: false, error: CHANGED_WHILE_CHECKING }
  // Deleted between the ownership read and the flip.
  if (error?.code === 'P0002') return { ok: false, error: WORKFLOW_NOT_FOUND }
  // Never PostgREST's own text in a toast; an unexpected refusal alerts.
  if (error) return { ok: false, error: actionFailureMessage(error, 'setTemplateStatusAction.flip') }
  await auditTemplateSweep(paused ?? [], 'instance_paused', {
    reason: 'template_off',
    workflow: current.name,
  })

  const { resumed, stillPaused } =
    status === 'active' && resumePaused === true
      ? await resumeTemplateInstances(supabase, templateId)
      : { resumed: 0, stillPaused: 0 }

  const pausedCount = paused?.length ?? 0
  revalidatePath('/workflows')
  if (pausedCount > 0 || resumed > 0) revalidatePath('/couples')
  return { ok: true, data: { paused: pausedCount, resumed, stillPaused } }
}

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * One feed line per couple a template-wide change touched.
 *
 * Written after the transaction, through the service role (the audit
 * table is service-write only). Losing a line is logged, never fatal: the
 * state change it describes has already committed.
 */
async function auditTemplateSweep(
  rows: { instance_id: string; user_id: string; couple_id: string | null }[],
  event: 'instance_paused' | 'instance_cancelled',
  detail: { reason: string; workflow: string },
): Promise<void> {
  await writeAuditMany(
    createAdminClient(),
    rows.map((row) => ({
      userId: row.user_id,
      instanceId: row.instance_id,
      coupleId: row.couple_id,
      event,
      detail,
    })),
  )
}

/**
 * Resume the couples the switch paused, one at a time, through the same
 * action the couple tab uses. One resume path means one overdue rule.
 */
async function resumeTemplateInstances(
  supabase: ServerClient,
  templateId: string,
): Promise<{ resumed: number; stillPaused: number }> {
  const { data } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('template_id', templateId)
    .eq('status', 'paused')
    .eq('paused_reason', 'template_off')
  const rows = data ?? []
  let resumed = 0
  for (const row of rows) {
    const res = await resumeInstanceAction({ instanceId: row.id })
    if (res.ok) resumed += 1
  }
  return { resumed, stillPaused: rows.length - resumed }
}

/**
 * What stands between a workflow and Turn on: every unfinished step
 * (Task 34). Empty when it may be turned on.
 *
 * The switches read this at click time to show the list, and the canvas
 * reads it to badge the cards and, on a workflow already on, to warn
 * which steps a couple enrolled now would reach unfinished. The verdict
 * needs the server-only action registry, so it is computed here and the
 * client gets plain rows.
 */
export async function templatePreflightAction(
  input: z.infer<typeof templateIdSchema>,
): Promise<ActionResult<{ problems: PreflightProblem[] }>> {
  const parsed = templateIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  // RLS makes this the ownership check: another tenant's template is not
  // found, and its steps would read as none (which is itself a problem).
  const { data: owned, error: readError } = await supabase
    .from('workflow_templates')
    .select('id')
    .eq('id', parsed.data.templateId)
    .maybeSingle()
  if (readError) {
    return { ok: false, error: actionFailureMessage(new WorkflowReadError('templatePreflightAction.read', readError), 'templatePreflightAction') }
  }
  if (!owned) return { ok: false, error: WORKFLOW_NOT_FOUND }
  try {
    const { problems } = await loadTemplatePreflight(supabase, owned.id)
    return { ok: true, data: { problems } }
  } catch (err) {
    return { ok: false, error: actionFailureMessage(err, 'templatePreflightAction') }
  }
}

/** How many of the caller's couples a template's switch would affect. */
export interface TemplateEnrolmentCounts {
  /** Couples running it now: what turning it off would pause. */
  running: number
  /** Couples paused when it was turned off: what turning it on can resume. */
  pausedByToggle: number
  /** Couples running or paused for any reason: what deleting it would stop. */
  live: number
}

/**
 * Count the couples behind a workflow's on/off switch, for its
 * confirmation.
 *
 * Read on the server at the moment the MC clicks, not from the library's
 * cached rows: the number in "Pause this workflow for 4 couples" is a
 * promise about what the click will do. Cancelled, completed and
 * already-paused couples are not running, so they are not counted.
 */
export async function countTemplateEnrolmentsAction(
  input: z.infer<typeof templateIdSchema>,
): Promise<ActionResult<TemplateEnrolmentCounts>> {
  const parsed = templateIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { data: owned } = await supabase
    .from('workflow_templates')
    .select('id')
    .eq('id', parsed.data.templateId)
    .maybeSingle()
  if (!owned) return { ok: false, error: 'Workflow not found.' }

  const base = () =>
    supabase
      .from('workflow_instances')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', parsed.data.templateId)
  const [running, toggled, live] = await Promise.all([
    base().eq('status', 'active'),
    base().eq('status', 'paused').eq('paused_reason', 'template_off'),
    base().in('status', ['active', 'paused']),
  ])
  const error = running.error ?? toggled.error ?? live.error
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      running: running.count ?? 0,
      pausedByToggle: toggled.count ?? 0,
      live: live.count ?? 0,
    },
  }
}

const setApplyRuleSchema = z.object({
  templateId: z.string().uuid(),
  applyRuleType: z.string().min(1),
  applyRuleConfig: z.record(z.string(), z.any()).default({}),
})

/**
 * Set how instances of this template get created.
 *
 * The canvas speaks trigger slugs (`new_enquiry`), plus `unset` when the
 * MC removes the rule. The `apply_rule_type` CHECK constraint has neither:
 * a trigger is stored as `on_event` nesting its own config, and `unset` is
 * stored as `manual`. `joinApplyRule` does that translation here, at the
 * single write path, so the canvas keeps speaking one vocabulary.
 *
 * Refused when the new rule starts the workflow on a stage it also lists
 * as a stop stage (`exitRuleRefusal`).
 */
export async function setApplyRuleAction(
  input: z.infer<typeof setApplyRuleSchema>,
): Promise<ActionResult<null>> {
  const parsed = setApplyRuleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const rule = joinApplyRule(parsed.data.applyRuleType, parsed.data.applyRuleConfig)
  const refusal = await exitRuleRefusal(supabase, parsed.data.templateId, rule)
  if (typeof refusal === 'string') return { ok: false, error: refusal }
  const { error } = await supabase
    .from('workflow_templates')
    .update({
      apply_rule_type: rule.applyRuleType,
      apply_rule_config: rule.applyRuleConfig as Json,
    })
    .eq('id', parsed.data.templateId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/workflows/${parsed.data.templateId}`)
  return { ok: true, data: null }
}

const exitStatusesSchema = z.object({
  templateId: z.string().uuid(),
  exitStatuses: z.array(z.string().max(120)).max(MAX_EXIT_STATUSES),
})

/**
 * Set the stages that stop this workflow for a couple (exit rules).
 *
 * Stored lower-cased and de-duplicated (`normaliseExitStatuses`), in the
 * form the stage-changed trigger compares against. Refused, in the MC's
 * words, when the workflow's own trigger starts it on one of them: the
 * couple would be stopped and started again on the same move. The
 * dispatcher applies the list from the next stage change on; a couple
 * already sitting in one of the stages is not stopped retroactively.
 *
 * @returns the list as saved
 */
export async function setExitStatusesAction(
  input: z.infer<typeof exitStatusesSchema>,
): Promise<ActionResult<{ exitStatuses: string[] }>> {
  const parsed = exitStatusesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const exitStatuses = normaliseExitStatuses(parsed.data.exitStatuses)
  // Also the ownership check: RLS hides another tenant's template, and a
  // zero-row update would otherwise read as saved.
  const refusal = await exitRuleRefusal(supabase, parsed.data.templateId, { exitStatuses })
  if (refusal !== null) {
    return { ok: false, error: typeof refusal === 'string' ? refusal : 'Workflow not found.' }
  }
  const { data, error } = await supabase
    .from('workflow_templates')
    .update({ exit_statuses: exitStatuses })
    .eq('id', parsed.data.templateId)
    .select('exit_statuses')
  if (error) return { ok: false, error: error.message }
  const saved = data?.[0]
  if (!saved) return { ok: false, error: 'Workflow not found.' }
  revalidatePath(`/workflows/${parsed.data.templateId}`)
  return { ok: true, data: { exitStatuses: saved.exit_statuses } }
}

/** A workflow's stop stages and the MC's own stages to choose from. */
export interface ExitStagesPayload {
  /** The stages that stop the workflow, as stored. */
  saved: string[]
  /** The MC's stages, in board order. */
  stages: Array<{ slug: string; name: string }>
}

/**
 * Load what the builder's stop-stage control needs, in one round trip.
 * Both reads are RLS-scoped, so another tenant's template is not found.
 */
export async function loadExitStagesAction(
  input: z.infer<typeof templateIdSchema>,
): Promise<ActionResult<ExitStagesPayload>> {
  const parsed = templateIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const [template, stages] = await Promise.all([
    supabase
      .from('workflow_templates')
      .select('exit_statuses')
      .eq('id', parsed.data.templateId)
      .maybeSingle(),
    supabase.from('couple_statuses').select('slug, name').order('position', { ascending: true }),
  ])
  if (template.error || stages.error) {
    return { ok: false, error: template.error?.message ?? stages.error?.message ?? 'failed' }
  }
  if (!template.data) return { ok: false, error: 'Workflow not found.' }
  return { ok: true, data: { saved: template.data.exit_statuses, stages: stages.data ?? [] } }
}

const renameSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(120),
})

export async function renameTemplateAction(
  input: z.infer<typeof renameSchema>,
): Promise<ActionResult<null>> {
  const parsed = renameSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_templates')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.templateId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

/**
 * Delete a template, stopping every couple still running it.
 *
 * `workflow_instances.template_id` is `on delete set null` and the
 * executor never reads the template, so a plain delete left each live
 * couple sending with no switch left to turn it off. The running and
 * paused ones are cancelled first, in the same transaction as the delete
 * (`delete_workflow_template`): cancelled, not paused, because with the
 * template gone there is no Turn on to resume from. Their steps stay on
 * the couple, as a cancelled workflow's do, and nothing more runs.
 */
export async function deleteTemplateAction(
  input: z.infer<typeof templateIdSchema>,
): Promise<ActionResult<{ cancelled: number }>> {
  const parsed = templateIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { data: current } = await supabase
    .from('workflow_templates')
    .select('id, name')
    .eq('id', parsed.data.templateId)
    .maybeSingle()
  if (!current) return { ok: false, error: 'Workflow not found.' }

  const { data: cancelled, error } = await supabase.rpc('delete_workflow_template', {
    p_template_id: parsed.data.templateId,
  })
  if (error) return { ok: false, error: error.message }
  await auditTemplateSweep(cancelled ?? [], 'instance_cancelled', {
    reason: 'template_deleted',
    workflow: current.name,
  })
  const count = cancelled?.length ?? 0
  revalidatePath('/workflows')
  if (count > 0) revalidatePath('/couples')
  return { ok: true, data: { cancelled: count } }
}

/** Copy a template, its steps and its tags into a new draft. */
export async function duplicateTemplateAction(
  input: z.infer<typeof templateIdSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = templateIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }

  const { data: source } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('id', parsed.data.templateId)
    .maybeSingle()
  if (!source) return { ok: false, error: 'Template not found.' }

  const { data: copy, error: copyErr } = await supabase
    .from('workflow_templates')
    .insert({
      user_id: auth.user.id,
      name: `${source.name} (copy)`,
      description: source.description,
      apply_rule_type: source.apply_rule_type,
      apply_rule_config: source.apply_rule_config,
      allow_reapply: source.allow_reapply,
      exit_statuses: source.exit_statuses,
      quiet_hours_start: source.quiet_hours_start,
      quiet_hours_end: source.quiet_hours_end,
      branch_depth_limit: source.branch_depth_limit,
      canvas_viewport: source.canvas_viewport,
      // A copy is always a draft, whatever the original was: activating
      // it is a deliberate act, not something inherited by accident.
      status: 'draft',
    })
    .select('id')
    .single()
  if (copyErr || !copy) return { ok: false, error: copyErr?.message ?? 'failed' }

  const { data: steps } = await supabase
    .from('workflow_template_steps')
    .select('*')
    .eq('template_id', parsed.data.templateId)
    .order('position', { ascending: true })

  // Parents before children so parent_step_id can be remapped onto the
  // copied rows rather than left pointing at the original's steps.
  const rows = steps ?? []
  const idMap = new Map<string, string>()
  for (const layer of [
    rows.filter((s) => s.parent_step_id === null),
    rows.filter((s) => s.parent_step_id !== null),
  ]) {
    if (layer.length === 0) continue
    const { data: inserted } = await supabase
      .from('workflow_template_steps')
      .insert(
        layer.map((s) => ({
          template_id: copy.id,
          position: s.position,
          type: s.type,
          config: s.config,
          title: s.title,
          description: s.description,
          timing: s.timing,
          parent_step_id: s.parent_step_id ? (idMap.get(s.parent_step_id) ?? null) : null,
          branch_path: s.branch_path,
          requires_approval: s.requires_approval,
          disabled: s.disabled,
          canvas_x: s.canvas_x,
          canvas_y: s.canvas_y,
        })),
      )
      .select('id')
    layer.forEach((s, i) => {
      const newId = inserted?.[i]?.id
      if (newId) idMap.set(s.id, newId)
    })
  }

  const { data: tags } = await supabase
    .from('workflow_template_tags')
    .select('tag_id')
    .eq('template_id', parsed.data.templateId)
  if (tags && tags.length > 0) {
    await supabase
      .from('workflow_template_tags')
      .insert(tags.map((t) => ({ template_id: copy.id, tag_id: t.tag_id })))
  }

  revalidatePath('/workflows')
  return { ok: true, data: { id: copy.id } }
}

const viewportSchema = z.object({
  templateId: z.string().uuid(),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }),
})

/** Remember where the user left the canvas. */
export async function saveCanvasViewportAction(
  input: z.infer<typeof viewportSchema>,
): Promise<ActionResult<null>> {
  const parsed = viewportSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_templates')
    .update({ canvas_viewport: parsed.data.viewport as Json })
    .eq('id', parsed.data.templateId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

/* ─── template steps ─────────────────────────────────────────────── */

const upsertStepSchema = z.object({
  stepId: z.string().uuid().optional(),
  templateId: z.string().uuid(),
  position: z.number().int(),
  /** A builder node type: a native step type or a registered action slug. */
  type: z.string().min(1),
  config: z.record(z.string(), z.any()).default({}),
  label: z.string().optional(),
  timing: stepTimingSchema.optional(),
  parentStepId: z.string().uuid().nullable().optional(),
  branchPath: z.enum(['yes', 'no']).nullable().optional(),
  requiresApproval: z.boolean().optional(),
  visibleToCouple: z.boolean().optional(),
  /**
   * The step picker adding a fresh step. An EMPTY starting config (a
   * branch with no condition, a note with no text) is a placeholder the
   * MC is about to fill in, so it skips the runner-schema check; any
   * config with a real field is checked (review I2). Task 34's
   * validator flags an unfinished step on the canvas. Written with a
   * plain insert, so the flag can never overwrite an existing step.
   */
  isNew: z.boolean().optional(),
})

/** Postgres `unique_violation`: here, an add whose id already exists. */
const UNIQUE_VIOLATION = '23505'

/**
 * Is this the picker's empty starting config (`{}` once the stored
 * `actionType` is set aside)?
 *
 * Only that shape skips the save-time check on an add (review I2). It is
 * the one placeholder that fails the runner today (a branch with no
 * condition, a note with no text), and anything with a real field in it
 * is a config the MC or a caller chose, so it is checked like any edit.
 */
function isPlaceholderConfig(config: Record<string, unknown>): boolean {
  return Object.keys(config).every((key) => key === 'actionType')
}

/**
 * Create or update one step on the canvas.
 *
 * A true upsert: the client can supply a UUID it generated for an
 * optimistic insert, so the id stays stable and any follow-up mutation
 * (drag, inline edit) hits the same row whether the server has caught
 * up or not.
 *
 * An edit is parsed against the runner's schema before the write (Task
 * 33): a config the send would reject, a blanked subject say, is refused
 * with the save-time sentence and the stored step is left as it was.
 */
export async function upsertTemplateStepRow(
  input: z.infer<typeof upsertStepSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = upsertStepSchema.safeParse(input)
  if (!parsed.success) {
    // A bad `timing` fails deep inside the discriminated union, so
    // `parsed.error.message` for it is Zod's JSON-stringified issues
    // array: unreadable in a toast. Re-run just that field through the
    // shared schema for the one-line message when that is the cause.
    if (input && typeof input === 'object' && 'timing' in input) {
      const timingResult = parseStepTiming((input as { timing?: unknown }).timing)
      if (!timingResult.ok) return { ok: false, error: `Invalid timing: ${timingResult.error}` }
    }
    return { ok: false, error: parsed.error.message }
  }
  const supabase = await createClient()

  const split = splitStepType(parsed.data.type, parsed.data.config)
  // A manual step's note is authored in the inspector as
  // `config.description`, but it belongs in the column the applied
  // instance snapshots and the couple's checklist reads. Lift it out
  // rather than storing it twice.
  const { description: noteFromConfig, ...restConfig } = split.config as {
    description?: unknown
  } & Record<string, unknown>
  const note = typeof noteFromConfig === 'string' ? noteFromConfig.trim() : ''
  // A Wait has one number: a start offset is folded into its duration
  // and its review flag dropped, so no path can save the two-number Wait
  // the card no longer shows (lib/workflows/wait-step). Normalised before
  // the check below, so the runner judges the config that is written.
  const save = normalizeWaitStep({
    type: split.type,
    config: restConfig,
    ...(parsed.data.timing !== undefined ? { timing: parsed.data.timing } : {}),
    ...(parsed.data.requiresApproval !== undefined
      ? { requiresApproval: parsed.data.requiresApproval }
      : {}),
  })
  if (!parsed.data.isNew || !isPlaceholderConfig(save.config)) {
    const check = validateStepConfig(save.type, save.config)
    if (!check.ok) return { ok: false, error: check.error }
  }
  const row = {
    template_id: parsed.data.templateId,
    position: parsed.data.position,
    type: save.type,
    config: save.config as Json,
    description: note || null,
    title: parsed.data.label ?? '',
    parent_step_id: parsed.data.parentStepId ?? null,
    branch_path: parsed.data.branchPath ?? null,
    ...(save.timing ? { timing: save.timing as Json } : {}),
    ...(save.requiresApproval !== undefined
      ? { requires_approval: save.requiresApproval }
      : {}),
    ...(parsed.data.visibleToCouple !== undefined
      ? { visible_to_couple: parsed.data.visibleToCouple }
      : {}),
  }

  const query = parsed.data.stepId && !parsed.data.isNew
    ? supabase
        .from('workflow_template_steps')
        .upsert({ id: parsed.data.stepId, ...row })
        .select('id')
        .single()
    : supabase
        .from('workflow_template_steps')
        .insert(parsed.data.stepId ? { id: parsed.data.stepId, ...row } : row)
        .select('id')
        .single()

  const { data, error } = await query
  if (error?.code === UNIQUE_VIOLATION && parsed.data.isNew && parsed.data.stepId) {
    // The card's first edit reached the server before the picker's own
    // add (review M2). The step exists and holds the newer edit, so the
    // add is done; overwriting it would lose that edit. Confirmed through
    // the caller's own client so another tenant's id never reads as done.
    const { data: existing } = await supabase
      .from('workflow_template_steps')
      .select('id')
      .eq('id', parsed.data.stepId)
      .eq('template_id', parsed.data.templateId)
      .maybeSingle()
    if (existing) return { ok: true, data: { id: existing.id } }
  }
  if (error || !data) return { ok: false, error: error?.message ?? 'failed' }
  revalidatePath(`/workflows/${parsed.data.templateId}`)
  return { ok: true, data: { id: data.id } }
}

const stepEdgesSchema = z.object({
  stepId: z.string().uuid(),
  parentStepId: z.string().uuid().nullable(),
  branchPath: z.enum(['yes', 'no']).nullable(),
})

/** Re-parent a node after the user redraws a connector. */
export async function updateTemplateStepEdges(
  input: z.infer<typeof stepEdgesSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepEdgesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_template_steps')
    .update({
      parent_step_id: parsed.data.parentStepId,
      branch_path: parsed.data.branchPath,
    })
    .eq('id', parsed.data.stepId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
}

const renumberStepsSchema = z.object({
  updates: z.array(z.object({ stepId: z.string().uuid(), position: z.number().int() })).min(1),
})

/**
 * Rewrite the `position` of a batch of existing steps, with no other
 * column touched.
 *
 * Only called by a mid-list insert once its two neighbours have no
 * integer left between them (see `lib/workflows/insert-step.ts`) - a
 * plain position-only update, not the general `upsertTemplateStepRow`,
 * so it can never clobber a step's type or config while spreading the
 * list back out.
 */
export async function renumberTemplateSteps(
  input: z.infer<typeof renumberStepsSchema>,
): Promise<ActionResult<null>> {
  const parsed = renumberStepsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  for (const update of parsed.data.updates) {
    const { error } = await supabase
      .from('workflow_template_steps')
      .update({ position: update.position })
      .eq('id', update.stepId)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true, data: null }
}

const deleteStepSchema = z.object({
  stepId: z.string().uuid(),
  templateId: z.string().uuid(),
})

export async function deleteTemplateStepRow(
  input: z.infer<typeof deleteStepSchema>,
): Promise<ActionResult<null>> {
  const parsed = deleteStepSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_template_steps')
    .delete()
    .eq('id', parsed.data.stepId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/workflows/${parsed.data.templateId}`)
  return { ok: true, data: null }
}

/* ─── tags ───────────────────────────────────────────────────────── */

const createTagSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().min(1).max(24).default('gray'),
})

export async function createWorkflowTagAction(
  input: z.infer<typeof createTagSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTagSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }
  const { data, error } = await supabase
    .from('workflow_tags')
    .insert({ user_id: auth.user.id, name: parsed.data.name, color: parsed.data.color })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'failed' }
  revalidatePath('/workflows')
  return { ok: true, data: { id: data.id } }
}

const updateTagSchema = z.object({
  tagId: z.string().uuid(),
  name: z.string().min(1).max(40).optional(),
  color: z.string().min(1).max(24).optional(),
  position: z.number().int().optional(),
})

export async function updateWorkflowTagAction(
  input: z.infer<typeof updateTagSchema>,
): Promise<ActionResult<null>> {
  const parsed = updateTagSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const { tagId, name, color, position } = parsed.data
  // Built key by key rather than spread: under exactOptionalPropertyTypes
  // a spread of optional fields carries `| undefined` into the update
  // payload, which PostgREST's generated types reject.
  const patch: { name?: string; color?: string; position?: number } = {}
  if (name !== undefined) patch.name = name
  if (color !== undefined) patch.color = color
  if (position !== undefined) patch.position = position

  const supabase = await createClient()
  const { error } = await supabase.from('workflow_tags').update(patch).eq('id', tagId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

export async function deleteWorkflowTagAction(
  input: { tagId: string },
): Promise<ActionResult<null>> {
  const parsed = z.object({ tagId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_tags')
    .delete()
    .eq('id', parsed.data.tagId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

const setTagsSchema = z.object({
  templateId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()),
})

/** Replace a template's tag set. */
export async function setTemplateTagsAction(
  input: z.infer<typeof setTagsSchema>,
): Promise<ActionResult<null>> {
  const parsed = setTagsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()

  // RLS on the join table checks BOTH sides, so a tag belonging to
  // another tenant is rejected by the insert rather than needing a
  // separate ownership read here.
  const { error: delErr } = await supabase
    .from('workflow_template_tags')
    .delete()
    .eq('template_id', parsed.data.templateId)
  if (delErr) return { ok: false, error: delErr.message }

  if (parsed.data.tagIds.length > 0) {
    const { error } = await supabase
      .from('workflow_template_tags')
      .insert(
        parsed.data.tagIds.map((tagId) => ({
          template_id: parsed.data.templateId,
          tag_id: tagId,
        })),
      )
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

/* ─── library loader ─────────────────────────────────────────────── */

/** One row in the template library. */
export interface TemplateListRow extends WorkflowTemplateRow {
  /** Tag ids attached to this template. */
  tagIds: string[]
  /** How many couples currently have this applied and active. */
  activeInstances: number
  /** How many steps it contains, for the card's "11 steps" line. */
  stepCount: number
}

export interface WorkflowsLibraryPayload {
  templates: TemplateListRow[]
  tags: { id: string; name: string; color: string; position: number }[]
}

/**
 * Single batched read powering the Templates tab.
 *
 * Four reads in parallel, all RLS-scoped because the client is the
 * user's. Counting instances here rather than per row keeps the list
 * to one round trip however many templates the MC has.
 */
export async function loadWorkflowsLibraryAction(): Promise<
  ActionResult<WorkflowsLibraryPayload>
> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }

  const [templatesRes, tagsRes, joinRes, instancesRes, stepsRes] = await Promise.all([
    supabase
      .from('workflow_templates')
      .select('*')
      .order('updated_at', { ascending: false }),
    supabase
      .from('workflow_tags')
      .select('id, name, color, position')
      .order('position', { ascending: true }),
    supabase.from('workflow_template_tags').select('template_id, tag_id'),
    supabase
      .from('workflow_instances')
      .select('template_id')
      .eq('status', 'active')
      .not('template_id', 'is', null),
    // Ids only: the card needs a count, and pulling whole step rows for
    // every template on the page would be the largest read here by far.
    supabase.from('workflow_template_steps').select('template_id'),
  ])

  if (templatesRes.error) return { ok: false, error: templatesRes.error.message }

  const tagsByTemplate = new Map<string, string[]>()
  for (const row of joinRes.data ?? []) {
    const list = tagsByTemplate.get(row.template_id)
    if (list) list.push(row.tag_id)
    else tagsByTemplate.set(row.template_id, [row.tag_id])
  }

  const counts = new Map<string, number>()
  for (const row of instancesRes.data ?? []) {
    if (!row.template_id) continue
    counts.set(row.template_id, (counts.get(row.template_id) ?? 0) + 1)
  }

  const stepCounts = new Map<string, number>()
  for (const row of stepsRes.data ?? []) {
    stepCounts.set(row.template_id, (stepCounts.get(row.template_id) ?? 0) + 1)
  }

  const templates = (templatesRes.data ?? []).map((t) => ({
    ...(t as unknown as WorkflowTemplateRow),
    tagIds: tagsByTemplate.get(t.id) ?? [],
    activeInstances: counts.get(t.id) ?? 0,
    stepCount: stepCounts.get(t.id) ?? 0,
  }))

  return { ok: true, data: { templates, tags: tagsRes.data ?? [] } }
}

/**
 * The MC's own identity and branding, for previewing a canned email in
 * the builder.
 *
 * The template is not attached to a couple, so a preview uses sample
 * couple details, but the *sender* half should be real or the MC is
 * looking at someone else's email signed by someone else. Mirrors
 * `loadMcSnapshot`'s fallbacks so the preview and the send agree on who
 * this is from. Reads the calling user's own metadata: no admin client,
 * no user id parameter.
 */
export async function loadSenderIdentityAction(): Promise<{
  businessName: string
  contactName: string
  email: string
  branding: PublicBranding | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // Read as a bag: `UserMetadata` describes the branding fields, and
  // `display_name` is not one of them.
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const str = (key: string) =>
    typeof metadata[key] === 'string' ? (metadata[key] as string).trim() : ''
  return {
    businessName: str('business_name') || 'Your business',
    contactName: str('display_name') || user?.email?.split('@')[0] || 'You',
    email: user?.email ?? '',
    branding: buildPublicBranding(metadata as UserMetadata),
  }
}
