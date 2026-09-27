/**
 * Server actions for applied workflow instances.
 *
 * Everything that operates on a couple's live checklist rather than on
 * the reusable definition: applying a template, ticking and skipping
 * steps, adding an ad-hoc to-do, retrying a step that errored.
 *
 * Ticking goes through {@link completeStep} rather than a bare status
 * update. That is not incidental: a direct `update({ status: 'done' })`
 * would set the status but never recompute `due_at` on the steps gated
 * behind it, so every automated step anchored `after_previous` would sit
 * unschedulable forever.
 *
 * @module app/(dashboard)/workflows/instance-actions
 */
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { inMemoryLimiter } from '@/lib/api/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { actionFailureMessage } from '@/lib/workflows/action-failure'
import {
  draftStepsFromTemplate,
  previewApplyInputSchema,
  projectApply,
  type ApplyPreview,
} from '@/lib/workflows/apply-projection'
import { writeAudit, writeAuditMany } from '@/lib/workflows/audit'
import { buildStepContext } from '@/lib/workflows/context'
import {
  completeInstanceIfDone,
  completeStep,
  reopenStep,
  runStepNow,
} from '@/lib/workflows/executor'
import {
  applyTemplate,
  ensureDefaultInstance,
  ensurePersonalInstance,
} from '@/lib/workflows/instantiate'
import { loadTemplatePreflight, preflightRefusal } from '@/lib/workflows/preflight'
import {
  countDoneSteps,
  loadDoneSteps,
  loadQueue,
  type QueueFilter,
  type QueueItem,
  type QueueResult,
} from '@/lib/workflows/queue'
import { DB_UNREACHABLE } from '@/lib/workflows/read-failure'
import { blockedReason, type ReleaseStep } from '@/lib/workflows/release'
import { settleOverdueForResume } from '@/lib/workflows/resume'
import { resumeRefusal } from '@/lib/workflows/resume-eligibility'
import {
  findLiveTwin,
  restoreCancelledSteps,
  undoRestore,
} from '@/lib/workflows/resume-stopped'
import {
  applyReviewEditsFor,
  buildStepPreview,
  type ReviewEdits,
  type StepPreview,
} from '@/lib/workflows/review'
import { reviewEditsSchema } from '@/lib/workflows/review-edits-schema'
import { partialSendFailure, type PartialSendFailure } from '@/lib/workflows/send-outcome'
import { validateStepConfig } from '@/lib/workflows/step-config-validation'
import { stepDisplayTitle } from '@/lib/workflows/step-label'
import { isAutomated } from '@/lib/workflows/steps'
import { loadWeddingDate } from '@/lib/workflows/wedding-date'
import type { Json } from '@/types/database'
import type {
  WorkflowInstanceWithSteps,
  WorkflowStepRow,
  WorkflowTemplateStepRow,
} from '@/types/workflows'

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

// Per-user cap on manual applies: each can fan out real sends, so this
// stops a click-loop from hammering Resend. Keyed by user id, not IP,
// because server actions have no Request to read an address from.
const applyLimiter = inMemoryLimiter({ windowMs: 60_000, max: 20 })

/** Confirm the caller owns the couple. RLS makes the read the check. */
async function ownsCouple(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coupleId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('couples')
    .select('id')
    .eq('id', coupleId)
    .maybeSingle()
  return Boolean(data)
}

/** Confirm the caller owns the instance, and return its couple. */
async function ownedInstance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  instanceId: string,
): Promise<{ id: string; couple_id: string | null } | null> {
  const { data } = await supabase
    .from('workflow_instances')
    .select('id, couple_id')
    .eq('id', instanceId)
    .maybeSingle()
  return data ?? null
}

/** Confirm the caller owns the step, via its instance. */
async function ownedStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stepId: string,
): Promise<{ id: string; instance_id: string; status: string } | null> {
  const { data } = await supabase
    .from('workflow_steps')
    .select('id, instance_id, status')
    .eq('id', stepId)
    .maybeSingle()
  return data ?? null
}

/* ─── applying ───────────────────────────────────────────────────── */

const applySchema = z.object({
  templateId: z.string().uuid(),
  coupleId: z.string().uuid(),
  /** Apply again even though this template is already on the couple. */
  force: z.boolean().default(false),
})

/**
 * Apply a template to a couple from the picker.
 *
 * Passes `dedupe: !force`, so a repeat apply is refused unless the MC
 * deliberately confirms it. The dispatcher never sets `force`: an
 * automatic re-apply means duplicate emails.
 *
 * Refused, with every unfinished step named, while the Turn on
 * pre-flight finds anything (Task 34): a draft can be applied by hand,
 * and it must be finished first all the same.
 */
export async function applyTemplateToCoupleAction(
  input: z.infer<typeof applySchema>,
): Promise<ActionResult<{ instanceId: string }>> {
  const parsed = applySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }

  const rl = await applyLimiter.check(auth.user.id)
  if (!rl.allowed) {
    return { ok: false, error: 'Too many applies. Wait a moment and try again.' }
  }

  if (!(await ownsCouple(supabase, parsed.data.coupleId))) {
    return { ok: false, error: 'Couple not found.' }
  }

  // RLS read doubles as the template ownership check.
  const { data: template } = await supabase
    .from('workflow_templates')
    .select('id, status')
    .eq('id', parsed.data.templateId)
    .maybeSingle()
  if (!template) return { ok: false, error: 'Workflow not found.' }
  if (template.status === 'archived') {
    return { ok: false, error: 'That workflow is archived.' }
  }

  // Enrolling a couple by hand runs the same steps a Turn on would, so
  // it passes the same pre-flight (Task 34): an unfinished step errors,
  // or means nothing, for this couple too. Fails closed on a read error.
  let stepsRevision: number
  try {
    const checked = await loadTemplatePreflight(supabase, template.id)
    if (checked.problems.length > 0) return { ok: false, error: preflightRefusal(checked.problems, 'apply') }
    stepsRevision = checked.stepsRevision
  } catch (err) {
    return { ok: false, error: actionFailureMessage(err, 'applyTemplateToCoupleAction.preflight') }
  }

  // The snapshot is written with the service-role client: it inserts
  // audit rows, which are SELECT-only for the user.
  // A read before the insert now throws rather than answering "not
  // found" (Task 36); caught here so the picker gets a sentence.
  let result: Awaited<ReturnType<typeof applyTemplate>>
  try {
    result = await applyTemplate(createAdminClient(), {
      userId: auth.user.id,
      templateId: parsed.data.templateId,
      coupleId: parsed.data.coupleId,
      dedupe: !parsed.data.force,
      // The snapshot must be of the steps the pre-flight passed: a step
      // blanked in between would be copied onto the couple unchecked
      // (Task 34 re-review, Minor 2). applyTemplate refuses when the
      // revision moved.
      expectedStepsRevision: stepsRevision,
    })
  } catch (err) {
    return { ok: false, error: actionFailureMessage(err, 'applyTemplateToCoupleAction') }
  }
  if ('error' in result) return { ok: false, error: result.error }

  revalidatePath('/couples')
  revalidatePath('/workflows')
  return { ok: true, data: { instanceId: result.instanceId } }
}

/** Active, non-archived templates for the "Apply workflow" picker. */
export async function loadApplicableTemplatesAction(): Promise<
  ActionResult<{ id: string; name: string; description: string | null; tagIds: string[] }[]>
> {
  const supabase = await createClient()
  const [templatesRes, joinRes] = await Promise.all([
    supabase
      .from('workflow_templates')
      .select('id, name, description')
      .neq('status', 'archived')
      .order('name', { ascending: true }),
    supabase.from('workflow_template_tags').select('template_id, tag_id'),
  ])
  if (templatesRes.error) return { ok: false, error: templatesRes.error.message }

  const byTemplate = new Map<string, string[]>()
  for (const row of joinRes.data ?? []) {
    const list = byTemplate.get(row.template_id)
    if (list) list.push(row.tag_id)
    else byTemplate.set(row.template_id, [row.tag_id])
  }

  return {
    ok: true,
    data: (templatesRes.data ?? []).map((t) => ({
      ...t,
      tagIds: byTemplate.get(t.id) ?? [],
    })),
  }
}

const PREVIEW_DEFAULT_TIMEZONE = 'Australia/Sydney'

/**
 * The Start preview: the workflow's calendar for this couple, before it
 * starts, with the steps the apply would skip flagged as such.
 *
 * Everything is read through the caller's own RLS client, so the reads
 * are the tenant check: another MC's workflow or couple reads as not
 * found. Nothing is written. The rows come from the same pure plan the
 * apply writes (`lib/workflows/apply-projection`), so "will be skipped"
 * is a promise the apply keeps. Mirrors what `applyTemplate` snapshots:
 * enabled steps only, dated from now.
 */
export async function previewApplyAction(
  input: z.infer<typeof previewApplyInputSchema>,
): Promise<ActionResult<ApplyPreview>> {
  const parsed = previewApplyInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }

  if (!(await ownsCouple(supabase, parsed.data.coupleId))) {
    return { ok: false, error: 'Couple not found.' }
  }
  const { data: template } = await supabase
    .from('workflow_templates')
    .select('id, name, status')
    .eq('id', parsed.data.templateId)
    .maybeSingle()
  if (!template) return { ok: false, error: 'Workflow not found.' }
  if (template.status === 'archived') {
    return { ok: false, error: 'That workflow is archived.' }
  }

  const [stepsRes, weddingDate, settingsRes] = await Promise.all([
    supabase
      .from('workflow_template_steps')
      .select('*')
      .eq('template_id', template.id)
      .eq('disabled', false)
      .order('position', { ascending: true }),
    loadWeddingDate(supabase, parsed.data.coupleId),
    supabase
      .from('user_public_settings')
      .select('timezone')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
  ])
  if (stepsRes.error) return { ok: false, error: stepsRes.error.message }

  const now = new Date()
  const rows = projectApply(
    draftStepsFromTemplate((stepsRes.data ?? []) as unknown as WorkflowTemplateStepRow[]),
    {
      weddingDate,
      appliedAt: now.toISOString(),
      timezone: settingsRes.data?.timezone ?? PREVIEW_DEFAULT_TIMEZONE,
    },
    now,
  )
  return { ok: true, data: { templateName: template.name, weddingDate, rows } }
}

/* ─── step controls ──────────────────────────────────────────────── */

const stepIdSchema = z.object({ stepId: z.string().uuid() })

/**
 * The refusal for a step on a stopped workflow. Ticking, skipping,
 * reopening or re-dating it would make a stopped workflow's step look
 * live (or done) while nothing will run it; resuming is the way back.
 */
const STOPPED_STEP = 'This step belongs to a stopped workflow. Resume the workflow first.'

/** Own the step and it is not on a stopped workflow, or the refusal. */
async function liveOwnedStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stepId: string,
): Promise<{ ok: true; step: { id: string; instance_id: string } } | { ok: false; error: string }> {
  const step = await ownedStep(supabase, stepId)
  if (!step) return { ok: false, error: 'Step not found.' }
  if (step.status === 'cancelled') return { ok: false, error: STOPPED_STEP }
  return { ok: true, step }
}

/** The refusal for running a step on a workflow that is paused, finished or stopped. */
const NOT_RUNNING = 'This workflow is not running. Resume it first.'

/**
 * {@link liveOwnedStep}, and its workflow is running (`active`). For the
 * two actions that make a step run now, approve and retry: on a paused
 * or stopped workflow they would clear the MC's approval gate or put a
 * failed step back to pending, and the send would go the moment the
 * workflow came back, outside the resume's settle.
 */
async function runningOwnedStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stepId: string,
): Promise<{ ok: true; step: { id: string; instance_id: string } } | { ok: false; error: string }> {
  const live = await liveOwnedStep(supabase, stepId)
  if (!live.ok) return live
  const { data: instance, error } = await supabase
    .from('workflow_instances')
    .select('status')
    .eq('id', live.step.instance_id)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (instance?.status === 'cancelled') return { ok: false, error: STOPPED_STEP }
  if (instance?.status !== 'active') return { ok: false, error: NOT_RUNNING }
  return live
}

/**
 * Why an automated step cannot be sent or given a date yet, or null when
 * it can. Read through the caller's own client, so RLS scopes it.
 *
 * Upcoming lists every send, including ones still behind a to-do, a Wait
 * or an undecided branch. A date on one of those is run on sight by the
 * engine, and Send runs it at once, so either would send it out of
 * order. Manual steps are never run by the engine and are not asked.
 */
async function automatedBlockedReason(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stepId: string,
): Promise<{ ok: true; reason: string | null } | { ok: false; error: string }> {
  const { data: step, error } = await supabase
    .from('workflow_steps')
    .select('id, instance_id, position, type, status, timing, parent_step_id, branch_path, title, config, completed_at')
    .eq('id', stepId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!step) return { ok: false, error: 'Step not found.' }
  if (!isAutomated(step.type)) return { ok: true, reason: null }
  const { data: lane, error: laneError } = await supabase
    .from('workflow_steps')
    .select('id, position, type, status, timing, parent_step_id, branch_path, title, config, completed_at')
    .eq('instance_id', step.instance_id)
  if (laneError) return { ok: false, error: laneError.message }
  const rows = (lane ?? []) as unknown as ReleaseStep[]
  return { ok: true, reason: blockedReason(step as unknown as ReleaseStep, rows) }
}

/** Tick a manual step off, releasing whatever was gated behind it. */
export async function tickStepAction(
  input: z.infer<typeof stepIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const owned = await liveOwnedStep(supabase, parsed.data.stepId)
  if (!owned.ok) return owned
  // Caught at the boundary (review I2): a throw here reached the MC as
  // Next's generic render error, or as nothing. An `unsettled` tick is
  // still a landed tick; the tick's heal pass re-dates what it released.
  try {
    await completeStep(createAdminClient(), parsed.data.stepId)
  } catch (err) {
    return { ok: false, error: actionFailureMessage(err, 'tickStepAction') }
  }
  revalidatePath('/couples')
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

/**
 * Un-tick a step, re-gating whatever it released. On a finished workflow
 * that is now off or deleted, an automated step is refused and a manual
 * one reopens with the workflow paused (see {@link reopenStep}).
 */
export async function untickStepAction(
  input: z.infer<typeof stepIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const owned = await liveOwnedStep(supabase, parsed.data.stepId)
  if (!owned.ok) return owned
  let reopened: Awaited<ReturnType<typeof reopenStep>>
  try {
    reopened = await reopenStep(createAdminClient(), parsed.data.stepId)
  } catch (err) {
    return { ok: false, error: actionFailureMessage(err, 'untickStepAction') }
  }
  if (!reopened.ok) return reopened
  revalidatePath('/couples')
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

/**
 * Skip a step.
 *
 * A skipped step still releases what was anchored after it: skipping a
 * to-do must not strand the rest of the workflow.
 */
export async function skipStepAction(
  input: z.infer<typeof stepIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const owned = await liveOwnedStep(supabase, parsed.data.stepId)
  if (!owned.ok) return owned
  try {
    await completeStep(createAdminClient(), parsed.data.stepId, { skipped: true })
  } catch (err) {
    return { ok: false, error: actionFailureMessage(err, 'skipStepAction') }
  }
  revalidatePath('/couples')
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

/**
 * Retry a step that errored.
 *
 * Clears the error and puts it back to pending; the next tick picks it
 * up. Guarded to errored rows, so it is a no-op on anything else, and
 * refused unless the workflow is running ({@link runningOwnedStep}).
 *
 * Resets `attempt_count` to 0: the MC retrying by hand is a fresh
 * decision, not the executor's own backoff. Without the reset, a step
 * that had already spent its automatic attempts would come back due,
 * fail once, and be re-buried immediately instead of getting the full
 * set of retries the manual retry implies.
 */
export async function retryStepAction(
  input: z.infer<typeof stepIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const owned = await runningOwnedStep(supabase, parsed.data.stepId)
  if (!owned.ok) return owned
  // A failed send whose to-do the MC has since un-ticked is behind that
  // to-do again. Put back to pending with its old, past date, the next
  // tick would send it anyway, out of order, so it is refused here with
  // the reason, before anything is written.
  const released = await automatedBlockedReason(supabase, parsed.data.stepId)
  if (!released.ok) return released
  if (released.reason) return { ok: false, error: released.reason }
  const admin = createAdminClient()
  const { error } = await admin
    .from('workflow_steps')
    .update({ status: 'pending', error_message: null, completed_at: null, attempt_count: 0 })
    .eq('id', parsed.data.stepId)
    .eq('status', 'errored')
  if (error) return { ok: false, error: error.message }
  // Run this one step, not the whole world. `advanceDueSteps(admin)`
  // with no owner ran every tenant's due steps inside one MC's request.
  try {
    await runStepNow(admin, parsed.data.stepId)
  } catch (err) {
    return { ok: false, error: actionFailureMessage(err, 'retryStepAction') }
  }
  revalidatePath('/couples')
  return { ok: true, data: null }
}

const deleteStepSchema = z.object({ stepId: z.string().uuid() })

/** Remove a step from a couple's checklist entirely. */
export async function deleteInstanceStepAction(
  input: z.infer<typeof deleteStepSchema>,
): Promise<ActionResult<null>> {
  const parsed = deleteStepSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_steps')
    .delete()
    .eq('id', parsed.data.stepId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/couples')
  return { ok: true, data: null }
}

const addStepSchema = z.object({
  coupleId: z.string().uuid(),
  title: z.string().min(1).max(200),
  dueAt: z.string().datetime().nullable().optional(),
  /** Defaults to the couple's default ("General") instance. */
  instanceId: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
})

/**
 * Add an ad-hoc to-do to a couple.
 *
 * With no `instanceId` it lands on the couple's default instance, which
 * is why no standalone task concept is needed: "call the venue about
 * parking" is a step like any other.
 */
export async function addAdHocStepAction(
  input: z.infer<typeof addStepSchema>,
): Promise<ActionResult<{ stepId: string }>> {
  const parsed = addStepSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }
  if (!(await ownsCouple(supabase, parsed.data.coupleId))) {
    return { ok: false, error: 'Couple not found.' }
  }

  let instanceId = parsed.data.instanceId
  if (instanceId) {
    const owned = await ownedInstance(supabase, instanceId)
    if (!owned) return { ok: false, error: 'Workflow not found.' }
  } else {
    instanceId = await ensureDefaultInstance(
      createAdminClient(),
      auth.user.id,
      parsed.data.coupleId,
    )
  }

  // Append: one past the highest position in the instance's top level.
  const { data: last } = await supabase
    .from('workflow_steps')
    .select('position')
    .eq('instance_id', instanceId)
    .is('parent_step_id', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: (last?.position ?? -1) + 1,
      type: 'todo',
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      config: {} as Json,
      status: 'pending',
      due_at: parsed.data.dueAt ?? null,
      // An ad-hoc to-do carries its own date, or none at all. With none it
      // is held (as "Take the date off" holds a step): its default timing
      // would otherwise date it from the step before it on the next
      // recompute, and it would show overdue at once and feed
      // `step_overdue` into other workflows. A date the MC typed is not
      // held, so a later recompute can still move it, as any date can.
      due_held_at: parsed.data.dueAt ? null : new Date().toISOString(),
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' } as Json,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'failed' }

  revalidatePath('/couples')
  revalidatePath('/workflows')
  return { ok: true, data: { stepId: data.id } }
}

/* ─── personal to-dos ────────────────────────────────────────────── */

const personalStepSchema = z.object({
  title: z.string().min(1).max(200),
  dueAt: z.string().datetime().nullable().optional(),
  description: z.string().max(2000).optional(),
})

/**
 * Add a to-do that belongs to no couple.
 *
 * "Renew my celebrant registration", "order new business cards". The
 * personal instance is created on first use, which is why nothing seeds
 * it: an MC who never writes one never gets an empty list.
 */
export async function addPersonalStepAction(
  input: z.infer<typeof personalStepSchema>,
): Promise<ActionResult<{ stepId: string }>> {
  const parsed = personalStepSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }

  const instanceId = await ensurePersonalInstance(createAdminClient(), auth.user.id)

  const { data: last } = await supabase
    .from('workflow_steps')
    .select('position')
    .eq('instance_id', instanceId)
    .is('parent_step_id', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('workflow_steps')
    .insert({
      instance_id: instanceId,
      position: (last?.position ?? -1) + 1,
      type: 'todo',
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      config: {} as Json,
      status: 'pending',
      due_at: parsed.data.dueAt ?? null,
      timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' } as Json,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'failed' }

  revalidatePath('/workflows')
  return { ok: true, data: { stepId: data.id } }
}

/* ─── review before send ─────────────────────────────────────────── */

const previewSchema = z.object({ stepId: z.string().uuid() })

// The detail modal re-previews as the MC types (debounced), and each
// render rebuilds the full run context, auth record included. Same cap as
// the Compose email preview: it stops a stuck loop, not a person.
const previewLimiter = inMemoryLimiter({ windowMs: 60_000, max: 120 })

const previewStepSchema = z.object({
  stepId: z.string().uuid(),
  /**
   * The MC's unsaved edits, per field. Same bounds as the approve action,
   * whose write this previews.
   */
  edits: reviewEditsSchema.optional(),
})

/**
 * What would go out if the MC approved this step, optionally with the
 * edits they have typed but not saved.
 *
 * Rendered through the same chain the send uses, against the same
 * context, so the preview is the email rather than an approximation of
 * it. Read-only: nothing is sent, logged or minted.
 */
export async function previewStepAction(
  input: z.infer<typeof previewStepSchema>,
): Promise<ActionResult<StepPreview>> {
  const parsed = previewStepSchema.safeParse(input)
  // The first issue's own message: this lands in the preview's caption,
  // where Zod's serialised issue list would be a JSON blob.
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid edits.' }

  // The caller's own client: RLS makes this read the ownership check.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  const { allowed } = await previewLimiter.check(user.id)
  if (!allowed) return { ok: false, error: 'Too many previews. Try again in a minute.' }
  const { data: stepRow } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('id', parsed.data.stepId)
    .maybeSingle()
  const step = stepRow as unknown as WorkflowStepRow | null
  if (!step) return { ok: false, error: 'Step not found.' }

  const admin = createAdminClient()
  const { data: instanceRow } = await admin
    .from('workflow_instances')
    .select('*')
    .eq('id', step.instance_id)
    .maybeSingle()
  if (!instanceRow) return { ok: false, error: 'Workflow not found.' }

  // The context builder needs the service-role client (it reads the MC's
  // auth record for the signature), but the preview itself is read
  // through the caller's own client so RLS still decides what they see.
  try {
    const ctx = await buildStepContext(
      admin,
      instanceRow as never,
      step,
    )
    const preview = await buildStepPreview(supabase, step, ctx, parsed.data.edits as ReviewEdits | undefined)
    return { ok: true, data: preview }
  } catch (err) {
    // A context read that failed (review I2): the caption shows why.
    return { ok: false, error: actionFailureMessage(err, 'previewStepAction') }
  }
}

/** Everything the detail modal shows about one step. */
export interface StepDetail {
  stepId: string
  title: string
  description: string | null
  type: string
  /**
   * The action's own slug for an `action` step (`send_email`, …), null
   * for every native type. What the config form is chosen by.
   */
  actionType: string | null
  /** The step's stored config, so its fields can be edited before it runs. */
  config: Record<string, unknown>
  status: string
  /** Why it failed, when it did. */
  errorMessage: string | null
  /**
   * Set when a send step finished having reached only some of its
   * recipients (audit M6). The step reads as done, so this is what tells
   * the MC otherwise. Derived from the step's output.
   */
  sendWarning: PartialSendFailure | null
  dueAt: string | null
  requiresApproval: boolean
  /** Null for a loose to-do, which belongs to no workflow. */
  instanceName: string | null
  coupleId: string | null
  coupleName: string | null
  weddingDate: string | null
  /** 1-based position among its instance's steps, for "step 4 of 11". */
  stepIndex: number
  stepTotal: number
  /** Rendered email, when this step sends one. */
  preview: StepPreview | null
  /**
   * Why an automated step cannot be sent or snoozed yet ("This step
   * waits for "Call the venue" to finish first."), or null when it can.
   * The modal hides Send and Snooze and says this instead. See
   * `lib/workflows/release`.
   */
  blockedReason: string | null
}

/**
 * Load one step in full, for the detail modal.
 *
 * The list rows deliberately carry only what a row shows. Opening one
 * is where the MC decides what to do with it, and that decision needs
 * the rendered message and where the step sits in its workflow, neither
 * of which is worth fetching for forty rows nobody opens.
 */
export async function loadStepDetailAction(
  input: z.infer<typeof previewSchema>,
): Promise<ActionResult<StepDetail>> {
  const parsed = previewSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
  const { data: stepRow } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('id', parsed.data.stepId)
    .maybeSingle()
  const step = stepRow as unknown as WorkflowStepRow | null
  if (!step) return { ok: false, error: 'Step not found.' }

  // Siblings give both the total and this step's place in it. Ordered
  // the same way the checklist renders, so "step 4 of 11" agrees with
  // what the MC counted on the couple's profile.
  const [{ data: instanceRow }, { data: siblings }] = await Promise.all([
    supabase
      .from('workflow_instances')
      .select('name, is_default, couple_id, couples(name, event_date)')
      .eq('id', step.instance_id)
      .maybeSingle(),
    supabase
      .from('workflow_steps')
      .select('id, position, type, status, timing, parent_step_id, branch_path, title, config, completed_at')
      .eq('instance_id', step.instance_id)
      .order('position', { ascending: true }),
  ])

  const instance = instanceRow as {
    name: string
    is_default: boolean
    couple_id: string | null
    couples: { name: string; event_date: string | null } | null
  } | null

  const ids = (siblings ?? []).map((row) => row.id)
  const index = ids.indexOf(step.id)
  const stepConfig = (step.config ?? {}) as Record<string, unknown>

  // The preview needs the service-role client for the sender half of
  // the context (the MC's auth record); the render itself still goes
  // through the caller's own client, so RLS decides what it can read.
  let preview: StepPreview | null = null
  const admin = createAdminClient()
  const { data: fullInstance } = await admin
    .from('workflow_instances')
    .select('*')
    .eq('id', step.instance_id)
    .maybeSingle()
  if (fullInstance) {
    // Caught (review I2): the detail load's ErrorState shows the message,
    // and a thrown one arrives as Next's generic render error.
    try {
      const ctx = await buildStepContext(admin, fullInstance as never, step)
      preview = await buildStepPreview(supabase, step, ctx)
    } catch (err) {
      return { ok: false, error: actionFailureMessage(err, 'loadStepDetailAction') }
    }
  }

  return {
    ok: true,
    data: {
      stepId: step.id,
      title: stepDisplayTitle(step),
      description: step.description,
      type: step.type,
      actionType:
        step.type === 'action' && typeof stepConfig['actionType'] === 'string'
          ? (stepConfig['actionType'] as string)
          : null,
      config: stepConfig,
      status: step.status,
      errorMessage: step.error_message,
      sendWarning: step.status === 'done' ? partialSendFailure(step.output) : null,
      dueAt: step.due_at,
      requiresApproval: step.requires_approval,
      // The default instance is called "General", a workflow the MC
      // never made. A loose to-do belongs to no sequence, so it says
      // nothing rather than inventing one.
      instanceName: instance && !instance.is_default ? instance.name : null,
      coupleId: instance?.couple_id ?? null,
      coupleName: instance?.couples?.name ?? null,
      weddingDate: instance?.couples?.event_date ?? null,
      stepIndex: index < 0 ? 1 : index + 1,
      stepTotal: ids.length || 1,
      preview,
      // Only a live automated step can be sent or snoozed out of order;
      // a finished or failed one has nothing to refuse.
      blockedReason:
        isAutomated(step.type) && (step.status === 'pending' || step.status === 'waiting')
          ? blockedReason(step as unknown as ReleaseStep, (siblings ?? []) as unknown as ReleaseStep[])
          : null,
    },
  }
}

/** Why an edit to a step whose saved template is gone cannot be kept. */
const TEMPLATE_MISSING = 'The saved template this email uses could not be found.'

const approveSchema = z.object({
  stepId: z.string().uuid(),
  /** Optional edits to the email before it goes, per field. */
  edits: reviewEditsSchema.optional(),
})

/**
 * Approve a held send, optionally with edits, and run it now.
 *
 * The MC pressed Send after reading it, so it goes immediately rather
 * than waiting for the next tick. Edits are written onto the step, never
 * onto the saved email template: they are fixing this one message for
 * this one couple.
 */
export async function approveStepAction(
  input: z.infer<typeof approveSchema>,
): Promise<ActionResult<{ notice: string } | null>> {
  const parsed = approveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
  // Checked before the gate is cleared: clearing it on a paused workflow
  // would leave the send approved and due, and it would go out the moment
  // the workflow came back.
  const owned = await runningOwnedStep(supabase, parsed.data.stepId)
  if (!owned.ok) return owned
  // Before the gate is cleared, so a refusal leaves the step as it was.
  const released = await automatedBlockedReason(supabase, parsed.data.stepId)
  if (!released.ok) return released
  if (released.reason) return { ok: false, error: released.reason }
  const { data: stepRow } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('id', parsed.data.stepId)
    .maybeSingle()
  const step = stepRow as unknown as WorkflowStepRow | null
  if (!step) return { ok: false, error: 'Step not found.' }

  const patch: { requires_approval: boolean; config?: Json } = {
    requires_approval: false,
  }
  if (parsed.data.edits) {
    const config = await applyReviewEditsFor(supabase, step.config, parsed.data.edits as ReviewEdits)
    if (!config) return { ok: false, error: TEMPLATE_MISSING }
    // Checked before the gate is cleared and before the send: an edit the
    // runner would reject (a blanked subject) is refused here, naming the
    // field, with the hold and the stored message untouched.
    const check = validateStepConfig(step.type, config)
    if (!check.ok) return { ok: false, error: check.error }
    patch.config = config
  }

  const { error } = await supabase
    .from('workflow_steps')
    .update(patch)
    .eq('id', parsed.data.stepId)
    // Also in the write, so a stop landing after the check above wins.
    .neq('status', 'cancelled')
  if (error) return { ok: false, error: error.message }

  let ran: Awaited<ReturnType<typeof runStepNow>>
  try {
    ran = await runStepNow(createAdminClient(), parsed.data.stepId)
  } catch (err) {
    // A throw before the step finished; a claimed step is already marked
    // errored, and a failed completion write says it may have sent.
    return { ok: false, error: actionFailureMessage(err, 'approveStepAction') }
  }
  if (!ran) {
    return { ok: false, error: 'This step is no longer in a state that can run.' }
  }

  revalidatePath('/workflows')
  revalidatePath('/couples')
  // The email went, but finishing the step did not (review I2). A success,
  // not a failure: a second press would find the step done, and the
  // tick's heal pass finishes the bookkeeping.
  return { ok: true, data: ran === 'unsettled' ? { notice: SENT_UNSETTLED } : null }
}

/** What Send & complete says when the send went and finishing it did not. */
const SENT_UNSETTLED = 'Sent. Finishing the step failed; it will retry.'

const stepMessageSchema = z.object({
  stepId: z.string().uuid(),
  /** Only the fields the MC changed. */
  edits: reviewEditsSchema,
})

/**
 * Keep an edited message without sending it.
 *
 * The detail modal opens a send with its own words already in the
 * editor, so an MC can fix a line and then snooze it rather than being
 * forced to choose between sending now and losing the edit. Same write
 * {@link approveStepAction} performs, minus the send and minus clearing
 * the approval gate.
 */
export async function saveStepMessageAction(
  input: z.infer<typeof stepMessageSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
  const { data: stepRow } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('id', parsed.data.stepId)
    .maybeSingle()
  const step = stepRow as unknown as WorkflowStepRow | null
  if (!step) return { ok: false, error: 'Step not found.' }

  const config = await applyReviewEditsFor(supabase, step.config, parsed.data.edits as ReviewEdits)
  if (!config) return { ok: false, error: TEMPLATE_MISSING }
  // A saved message is the one that sends: refuse one the send would
  // error on, rather than find out when it is due.
  const check = validateStepConfig(step.type, config)
  if (!check.ok) return { ok: false, error: check.error }
  const { error } = await supabase
    .from('workflow_steps')
    .update({ config })
    .eq('id', parsed.data.stepId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/workflows')
  revalidatePath('/couples')
  return { ok: true, data: null }
}

/* ─── rescheduling and renaming ──────────────────────────────────── */

const rescheduleSchema = z.object({
  stepId: z.string().uuid(),
  /** New due instant, or null to take the date off entirely. */
  dueAt: z.string().datetime().nullable(),
})

/**
 * Move one step's due date.
 *
 * Snoozing and rescheduling are the same operation with a different
 * button on top. The step's `timing` is deliberately left alone: a
 * wedding-relative step the MC nudges by a day should still follow the
 * wedding if the couple moves it, and only this one date changes.
 */
export async function rescheduleStepAction(
  input: z.infer<typeof rescheduleSchema>,
): Promise<ActionResult<null>> {
  const parsed = rescheduleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
  const live = await liveOwnedStep(supabase, parsed.data.stepId)
  if (!live.ok) return live
  const owned = live.step
  // Setting a date on a send still behind an earlier step would run it
  // on that date, out of order. Taking the date off (a hold) never sends,
  // so it stays allowed.
  if (parsed.data.dueAt !== null) {
    const released = await automatedBlockedReason(supabase, parsed.data.stepId)
    if (!released.ok) return released
    if (released.reason) return { ok: false, error: released.reason }
  }

  const { error } = await supabase
    .from('workflow_steps')
    .update({
      due_at: parsed.data.dueAt,
      // Taking the date off holds the step: no recompute re-dates it and
      // the engine never claims it (`due_held_at`, 20261023700000). A
      // null date alone was put back by the next recompute of the
      // instance, and the executor sent what the MC had held. Setting a
      // date lifts the hold.
      due_held_at: parsed.data.dueAt === null ? new Date().toISOString() : null,
    })
    .eq('id', parsed.data.stepId)
    // Also in the write, so a stop landing after the read above wins.
    .neq('status', 'cancelled')
  if (error) return { ok: false, error: error.message }

  const instance = await ownedInstance(supabase, owned.instance_id)
  await writeAudit(createAdminClient(), {
    userId: (await supabase.auth.getUser()).data.user?.id ?? '',
    instanceId: owned.instance_id,
    stepId: parsed.data.stepId,
    coupleId: instance?.couple_id ?? null,
    event: 'step_rescheduled',
    detail: { dueAt: parsed.data.dueAt },
  })

  revalidatePath('/workflows')
  revalidatePath('/couples')
  return { ok: true, data: null }
}

const renameStepSchema = z.object({
  stepId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
})

/** Rename a step on a couple's checklist, or edit its note. */
export async function renameStepAction(
  input: z.infer<typeof renameStepSchema>,
): Promise<ActionResult<null>> {
  const parsed = renameStepSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_steps')
    .update({
      title: parsed.data.title,
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
    })
    .eq('id', parsed.data.stepId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/workflows')
  revalidatePath('/couples')
  return { ok: true, data: null }
}

const stepConfigSchema = z.object({
  stepId: z.string().uuid(),
  config: z.record(z.string(), z.unknown()),
})

/**
 * Rewrite one step's config before it runs.
 *
 * The builder configures the template; this configures the copy that
 * was taken of it, for this couple. An MC reading a step in their day
 * and finding the wrong stage on it should be able to fix that step
 * rather than the workflow every future couple will get.
 *
 * The action's own slug stays put: changing what a step *is* is a
 * builder decision, not a thing to do from the queue.
 */
export async function updateStepConfigAction(
  input: z.infer<typeof stepConfigSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepConfigSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
  const owned = await ownedStep(supabase, parsed.data.stepId)
  if (!owned) return { ok: false, error: 'Step not found.' }

  const { data: existing, error: readError } = await supabase
    .from('workflow_steps')
    .select('type, config')
    .eq('id', parsed.data.stepId)
    .maybeSingle()
  if (readError) return { ok: false, error: DB_UNREACHABLE }
  if (!existing) return { ok: false, error: 'Step not found.' }

  const next = { ...parsed.data.config }
  // Whatever the form hands back, the slug is the stored one.
  const current = ((existing.config ?? {}) as Record<string, unknown>)['actionType']
  if (typeof current === 'string') next['actionType'] = current

  // Parsed against the runner's schema before the write (Task 33): a
  // config the send would reject is refused now, naming the field the
  // send would have failed on, and the stored config is left as it was.
  const check = validateStepConfig(existing.type, next)
  if (!check.ok) return { ok: false, error: check.error }

  const { error } = await supabase
    .from('workflow_steps')
    .update({ config: next as Json })
    .eq('id', parsed.data.stepId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/workflows')
  revalidatePath('/couples')
  return { ok: true, data: null }
}

/* ─── instance controls ──────────────────────────────────────────── */

const instanceIdSchema = z.object({ instanceId: z.string().uuid() })

/** The refusal when the same workflow was started again on the couple. */
const ALREADY_RUNNING =
  'This workflow is already running for this couple. Stop that one before resuming this.'

/** Words for the audit rows a stop writes, shared by both stop actions. */
const MANUAL_STOP = { reason: 'manual' } as const

/**
 * Cancel an applied workflow.
 *
 * The instance and its steps stay on the couple, marked cancelled, so
 * the MC can see what was stopped and when, and can resume it. The flip
 * records `cancelled_reason: 'manual'`, and a trigger marks its pending
 * and waiting steps `cancelled` in the same statement (20261011000000).
 * The executor skips cancelled instances, so nothing further fires.
 *
 * Guarded on running or paused, and a zero-row update is refused: RLS
 * filters another tenant's instance to zero rows, and reporting that as
 * done would tell the caller something stopped when nothing did.
 */
export async function cancelInstanceAction(
  input: z.infer<typeof instanceIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = instanceIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflow_instances')
    .update({
      status: 'cancelled',
      cancelled_reason: 'manual',
      completed_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.instanceId)
    // A paused workflow can be stopped for good as well; otherwise the
    // only way to end one would be to resume it first, which could run
    // something in between.
    .in('status', ['active', 'paused'])
    // The couple's own to-do list and the MC's personal one are not
    // sequences: stopping them would hide loose to-dos with no workflow
    // on screen to resume from.
    .eq('is_default', false)
    .eq('is_personal', false)
    .select('id, user_id, couple_id')
  if (error) return { ok: false, error: error.message }
  const stopped = data?.[0]
  if (!stopped) {
    return { ok: false, error: 'Only a running or paused workflow you started can be stopped.' }
  }
  await writeAudit(createAdminClient(), {
    userId: stopped.user_id,
    instanceId: stopped.id,
    coupleId: stopped.couple_id,
    event: 'instance_cancelled',
    detail: MANUAL_STOP,
  })
  revalidatePath('/couples')
  return { ok: true, data: null }
}

/**
 * Pause a running workflow.
 *
 * Nothing on a paused instance runs: the executor only picks up steps on
 * `active` instances. Its manual to-dos leave the work queue too, and
 * stay on the couple's tab marked paused, which is where it is resumed.
 * Guarded on `active`, so pausing a finished, stopped or already paused
 * workflow is refused rather than reported as done.
 */
export async function pauseInstanceAction(
  input: z.infer<typeof instanceIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = instanceIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  // RLS scopes the update to the caller's own rows, so another tenant's
  // instance matches nothing and lands in the same refusal below.
  const { data, error } = await supabase
    .from('workflow_instances')
    // `manual` tells this pause apart from one made by turning the whole
    // workflow off: turning it back on offers to resume only those.
    .update({ status: 'paused', paused_reason: 'manual' })
    .eq('id', parsed.data.instanceId)
    .eq('status', 'active')
    // The couple's own to-do list and the MC's personal one hold loose
    // to-dos, not a sequence. Pausing them would take those to-dos off
    // the queue with no workflow on screen to resume from.
    .eq('is_default', false)
    .eq('is_personal', false)
    .select('id, user_id, couple_id')
  if (error) return { ok: false, error: error.message }
  const paused = data?.[0]
  if (!paused) {
    return { ok: false, error: 'Only a running workflow you started can be paused.' }
  }
  await writeAudit(createAdminClient(), {
    userId: paused.user_id,
    instanceId: paused.id,
    coupleId: paused.couple_id,
    event: 'instance_paused',
  })
  revalidatePath('/couples')
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

/**
 * Put a paused or stopped workflow back into play.
 *
 * Anything that came due while it was not running is skipped, with an
 * audit line, before the instance goes live: resuming must never send a
 * backlog in one burst. The full rule is in {@link settleOverdueForResume}.
 * Anything still in the future keeps its date.
 *
 * A stopped workflow's steps were marked `cancelled` when it stopped, so
 * they are restored to `pending` (and re-dated) first, then settled; the
 * order is in `lib/workflows/resume-stopped`. Refused, in the words of
 * {@link resumeRefusal}: a setup that died, a deleted workflow, and an
 * apply still building. Also refused when the same workflow was started
 * again on the couple since.
 */
export async function resumeInstanceAction(
  input: z.infer<typeof instanceIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = instanceIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()

  // Read through the caller's client first: RLS makes this the ownership
  // check, and the skips below go through the service role.
  const { data: row } = await supabase
    .from('workflow_instances')
    .select(
      'id, user_id, status, paused_reason, cancelled_reason, template_id, couple_id, dedupe_key, workflow_templates(status)',
    )
    .eq('id', parsed.data.instanceId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Workflow not found.' }
  const current = { ...row, template_status: row.workflow_templates?.status ?? null }
  const refusal = resumeRefusal(current)
  if (refusal) return { ok: false, error: refusal }
  const from = current.status as 'paused' | 'cancelled'
  if (from === 'cancelled' && (await findLiveTwin(supabase, current))) {
    return { ok: false, error: ALREADY_RUNNING }
  }

  // Restore, then skip, then flip. Skipping before the flip closes the
  // window where the instance is active with its backlog still due, and
  // a tick landing in it sends exactly what this is here to prevent.
  const admin = createAdminClient()
  // Fail closed: a restore or settle that could not finish must not be
  // followed by the flip, or the backlog it did not judge goes live and
  // sends on the next tick. The instance is still paused or stopped here,
  // so refusing costs the MC one retry and sends nothing.
  try {
    if (from === 'cancelled') await restoreCancelledSteps(admin, current.id)
    await settleOverdueForResume(admin, current.id, from)
  } catch (err) {
    console.error('[workflows] resume could not settle the backlog', current.id, err)
    // A workflow that stays stopped keeps reading stopped.
    if (from === 'cancelled') await undoRestore(admin, current.id)
    return { ok: false, error: 'That workflow could not be resumed. Try again in a moment.' }
  }

  // The flip is conditional on the template still being on, read `for
  // share` in the same statement (20261011100000): a Turn off landing
  // after the check above cannot slip in before it.
  const { data: outcome, error } = await supabase.rpc('resume_workflow_instance', {
    p_instance_id: current.id,
    p_from: from,
  })
  if (error || outcome !== 'active') {
    // A workflow that stays stopped keeps reading stopped.
    if (from === 'cancelled') await undoRestore(admin, current.id)
    if (error?.code === '23505') return { ok: false, error: ALREADY_RUNNING }
    if (error) return { ok: false, error: error.message }
    if (outcome === 'template_off') {
      return { ok: false, error: 'Turn this workflow on first, then resume it.' }
    }
    return { ok: false, error: 'That workflow changed while resuming. Refresh and try again.' }
  }
  const resumed = { id: current.id, user_id: current.user_id, couple_id: current.couple_id }

  await writeAudit(admin, {
    userId: resumed.user_id,
    instanceId: resumed.id,
    coupleId: resumed.couple_id,
    event: 'instance_resumed',
  })
  // Resuming may have skipped the last outstanding steps, which leaves
  // nothing to finish the workflow on its own. The resume itself has
  // landed, so a failed completion is logged, not returned: an active
  // instance with nothing outstanding is what the tick's heal pass
  // completes (`workflow_stranded_instances`).
  try {
    await completeInstanceIfDone(admin, resumed.id)
  } catch (err) {
    actionFailureMessage(err, 'resumeInstanceAction.complete')
  }
  revalidatePath('/couples')
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

/** Cancel every running or paused workflow on a couple. The scoped "stop everything". */
export async function cancelCoupleWorkflowsAction(
  input: { coupleId: string },
): Promise<ActionResult<{ cancelled: number }>> {
  const parsed = z.object({ coupleId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  // Another tenant's couple matches no rows under RLS; refuse rather than
  // report "stopped 0" as a success.
  if (!(await ownsCouple(supabase, parsed.data.coupleId))) {
    return { ok: false, error: 'Couple not found.' }
  }
  const { data, error } = await supabase
    .from('workflow_instances')
    // The trigger in 20261011000000 cancels each one's open steps.
    .update({
      status: 'cancelled',
      cancelled_reason: 'manual',
      completed_at: new Date().toISOString(),
    })
    .eq('couple_id', parsed.data.coupleId)
    // "Stop everything" includes paused workflows: they are still live
    // enrolments the MC would expect this to end.
    .in('status', ['active', 'paused'])
    // The default instance is the couple's open-ended to-do list, not a
    // sequence. Cancelling it would hide their ad-hoc steps.
    .eq('is_default', false)
    .select('id, user_id, couple_id')
  if (error) return { ok: false, error: error.message }
  const stopped = data ?? []
  await writeAuditMany(
    createAdminClient(),
    stopped.map((row) => ({
      userId: row.user_id,
      instanceId: row.id,
      coupleId: row.couple_id,
      event: 'instance_cancelled' as const,
      detail: MANUAL_STOP,
    })),
  )
  revalidatePath('/couples')
  return { ok: true, data: { cancelled: stopped.length } }
}

/* ─── couple loader ──────────────────────────────────────────────── */

/** Every applied workflow on a couple, with its steps. */
export async function loadCoupleWorkflowsAction(
  input: { coupleId: string },
): Promise<ActionResult<WorkflowInstanceWithSteps[]>> {
  const parsed = z.object({ coupleId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()

  const { data: instances, error } = await supabase
    .from('workflow_instances')
    // The template's status decides whether Resume is offered.
    .select('*, workflow_templates(status)')
    .eq('couple_id', parsed.data.coupleId)
    .order('is_default', { ascending: false })
    .order('applied_at', { ascending: true })
  if (error) return { ok: false, error: error.message }
  if (!instances || instances.length === 0) return { ok: true, data: [] }

  // One steps read for every instance rather than one per instance.
  const { data: steps } = await supabase
    .from('workflow_steps')
    .select('*')
    .in(
      'instance_id',
      instances.map((i) => i.id),
    )
    .order('position', { ascending: true })

  const byInstance = new Map<string, WorkflowStepRow[]>()
  for (const raw of (steps ?? []) as unknown as WorkflowStepRow[]) {
    // Named here rather than in the row component, so the couple's
    // list, the queue and the detail modal cannot end up calling one
    // step three different things.
    const step = { ...raw, title: stepDisplayTitle(raw) }
    const list = byInstance.get(step.instance_id)
    if (list) list.push(step)
    else byInstance.set(step.instance_id, [step])
  }

  return {
    ok: true,
    data: instances.map(({ workflow_templates: template, ...i }) => ({
      ...(i as unknown as WorkflowInstanceWithSteps),
      template_status: (template?.status ?? null) as WorkflowInstanceWithSteps['template_status'],
      steps: byInstance.get(i.id) ?? [],
    })),
  }
}

/* ─── the work queue ─────────────────────────────────────────────── */

/**
 * Steps due across every couple, grouped into overdue, today and
 * upcoming.
 *
 * RLS-scoped through the caller's own client, so the user id is read
 * from the session rather than accepted as a parameter: taking it as an
 * argument would invite a caller to pass someone else's.
 */
export async function loadQueueAction(
  input: QueueFilter = {},
): Promise<ActionResult<QueueResult>> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }
  // The MC's quiet hours move a Wait's end, and with it every send
  // behind it; they live on the session user, the same fields the engine
  // reads (`loadMcSnapshot`).
  const meta = (auth.user.user_metadata ?? {}) as Record<string, unknown>
  const appMeta = (auth.user.app_metadata ?? {}) as Record<string, unknown>
  const result = await loadQueue(supabase, auth.user.id, input, undefined, {
    mcQuietHours: {
      quietHoursStart: typeof meta['quiet_hours_start'] === 'string' ? meta['quiet_hours_start'] : null,
      quietHoursEnd: typeof meta['quiet_hours_end'] === 'string' ? meta['quiet_hours_end'] : null,
      quietHoursTimezone:
        (typeof meta['timezone'] === 'string' ? meta['timezone'] : null) ??
        (typeof appMeta['timezone'] === 'string' ? appMeta['timezone'] : null),
    },
  })
  return { ok: true, data: result }
}

/**
 * Everything ticked or skipped in the last 90 days.
 *
 * Only called when the MC opens the Done strip: a list nobody has asked
 * for is not worth a round trip on every page load.
 *
 * RLS-scoped through the caller's own client, and the user id comes from
 * the session for the same reason it does above.
 */
export async function loadDoneAction(): Promise<ActionResult<QueueItem[]>> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }
  return { ok: true, data: await loadDoneSteps(supabase, auth.user.id) }
}

/** How many rows the Done strip is hiding, so it can label itself. */
export async function countDoneAction(): Promise<ActionResult<number>> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'unauthorized' }
  return { ok: true, data: await countDoneSteps(supabase, auth.user.id) }
}
