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
import { writeAudit } from '@/lib/workflows/audit'
import { buildStepContext } from '@/lib/workflows/context'
import {
  advanceDueSteps,
  completeStep,
  reopenStep,
  runStepNow,
} from '@/lib/workflows/executor'
import {
  applyTemplate,
  ensureDefaultInstance,
  ensurePersonalInstance,
} from '@/lib/workflows/instantiate'
import {
  countDoneSteps,
  loadDoneSteps,
  loadQueue,
  type QueueFilter,
  type QueueItem,
  type QueueResult,
} from '@/lib/workflows/queue'
import {
  applyReviewEdits,
  buildStepPreview,
  type StepPreview,
} from '@/lib/workflows/review'
import { stepDisplayTitle } from '@/lib/workflows/step-label'
import type { Json } from '@/types/database'
import type { WorkflowInstanceWithSteps, WorkflowStepRow } from '@/types/workflows'

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
): Promise<{ id: string; instance_id: string } | null> {
  const { data } = await supabase
    .from('workflow_steps')
    .select('id, instance_id')
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

  // The snapshot is written with the service-role client: it inserts
  // audit rows, which are SELECT-only for the user.
  const result = await applyTemplate(createAdminClient(), {
    userId: auth.user.id,
    templateId: parsed.data.templateId,
    coupleId: parsed.data.coupleId,
    dedupe: !parsed.data.force,
  })
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

/* ─── step controls ──────────────────────────────────────────────── */

const stepIdSchema = z.object({ stepId: z.string().uuid() })

/** Tick a manual step off, releasing whatever was gated behind it. */
export async function tickStepAction(
  input: z.infer<typeof stepIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  if (!(await ownedStep(supabase, parsed.data.stepId))) {
    return { ok: false, error: 'Step not found.' }
  }
  await completeStep(createAdminClient(), parsed.data.stepId)
  revalidatePath('/couples')
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

/** Un-tick a step, re-gating whatever it released. */
export async function untickStepAction(
  input: z.infer<typeof stepIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  if (!(await ownedStep(supabase, parsed.data.stepId))) {
    return { ok: false, error: 'Step not found.' }
  }
  await reopenStep(createAdminClient(), parsed.data.stepId)
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
  if (!(await ownedStep(supabase, parsed.data.stepId))) {
    return { ok: false, error: 'Step not found.' }
  }
  await completeStep(createAdminClient(), parsed.data.stepId, { skipped: true })
  revalidatePath('/couples')
  revalidatePath('/workflows')
  return { ok: true, data: null }
}

/**
 * Retry a step that errored.
 *
 * Clears the error and puts it back to pending; the next tick picks it
 * up. Guarded to errored rows, so it is a no-op on anything else.
 */
export async function retryStepAction(
  input: z.infer<typeof stepIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  if (!(await ownedStep(supabase, parsed.data.stepId))) {
    return { ok: false, error: 'Step not found.' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('workflow_steps')
    .update({ status: 'pending', error_message: null, completed_at: null })
    .eq('id', parsed.data.stepId)
    .eq('status', 'errored')
  if (error) return { ok: false, error: error.message }
  // Run it now rather than making the MC wait for the next cron tick.
  await advanceDueSteps(admin)
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
      // An ad-hoc to-do carries its own date, or none at all. Its timing
      // is the default so a later recompute of the instance leaves the
      // date the MC typed exactly where they put it.
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

/**
 * What would go out if the MC approved this step.
 *
 * Rendered through the same path the send uses, against the same
 * context, so the preview is the email rather than an approximation of
 * it.
 */
export async function previewStepAction(
  input: z.infer<typeof previewSchema>,
): Promise<ActionResult<StepPreview>> {
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
  const ctx = await buildStepContext(
    admin,
    instanceRow as never,
    step,
  )
  const preview = await buildStepPreview(supabase, step, ctx)
  return { ok: true, data: preview }
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
      .select('id')
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
    const ctx = await buildStepContext(admin, fullInstance as never, step)
    preview = await buildStepPreview(supabase, step, ctx)
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
    },
  }
}

const approveSchema = z.object({
  stepId: z.string().uuid(),
  /** Optional edits to the email before it goes. */
  edits: z
    .object({ subject: z.string().max(300), body: z.string().max(20_000) })
    .optional(),
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
): Promise<ActionResult<null>> {
  const parsed = approveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }

  const supabase = await createClient()
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
    patch.config = applyReviewEdits(step.config, parsed.data.edits)
  }

  const { error } = await supabase
    .from('workflow_steps')
    .update(patch)
    .eq('id', parsed.data.stepId)
  if (error) return { ok: false, error: error.message }

  const ran = await runStepNow(createAdminClient(), parsed.data.stepId)
  if (!ran) {
    return { ok: false, error: 'This step is no longer in a state that can run.' }
  }

  revalidatePath('/workflows')
  revalidatePath('/couples')
  return { ok: true, data: null }
}

const stepMessageSchema = z.object({
  stepId: z.string().uuid(),
  subject: z.string().max(300),
  body: z.string().max(20_000),
})

/**
 * Keep an edited message without sending it.
 *
 * The detail modal opens a send with its rendered words already in the
 * fields, so an MC can fix a line and then snooze it rather than being
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

  const { error } = await supabase
    .from('workflow_steps')
    .update({
      config: applyReviewEdits(step.config, {
        subject: parsed.data.subject,
        body: parsed.data.body,
      }),
    })
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
  const owned = await ownedStep(supabase, parsed.data.stepId)
  if (!owned) return { ok: false, error: 'Step not found.' }

  const { error } = await supabase
    .from('workflow_steps')
    .update({ due_at: parsed.data.dueAt })
    .eq('id', parsed.data.stepId)
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

  const { data: existing } = await supabase
    .from('workflow_steps')
    .select('config')
    .eq('id', parsed.data.stepId)
    .maybeSingle()

  const next = { ...parsed.data.config }
  // Whatever the form hands back, the slug is the stored one.
  const current = ((existing?.config ?? {}) as Record<string, unknown>)['actionType']
  if (typeof current === 'string') next['actionType'] = current

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

/**
 * Cancel an applied workflow.
 *
 * The instance and its steps stay on the couple, marked cancelled, so
 * the MC can see what was stopped and when. The executor skips
 * cancelled instances, so nothing further fires.
 */
export async function cancelInstanceAction(
  input: z.infer<typeof instanceIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = instanceIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_instances')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', parsed.data.instanceId)
    .eq('status', 'active')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/couples')
  return { ok: true, data: null }
}

/** Put a cancelled workflow back into play. */
export async function resumeInstanceAction(
  input: z.infer<typeof instanceIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = instanceIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_instances')
    .update({ status: 'active', completed_at: null })
    .eq('id', parsed.data.instanceId)
    .eq('status', 'cancelled')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/couples')
  return { ok: true, data: null }
}

/** Cancel every active workflow on a couple. The scoped "stop everything". */
export async function cancelCoupleWorkflowsAction(
  input: { coupleId: string },
): Promise<ActionResult<{ cancelled: number }>> {
  const parsed = z.object({ coupleId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('workflow_instances')
    .update(
      { status: 'cancelled', completed_at: new Date().toISOString() },
      { count: 'exact' },
    )
    .eq('couple_id', parsed.data.coupleId)
    .eq('status', 'active')
    // The default instance is the couple's open-ended to-do list, not a
    // sequence. Cancelling it would hide their ad-hoc steps.
    .eq('is_default', false)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/couples')
  return { ok: true, data: { cancelled: count ?? 0 } }
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
    .select('*')
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
    data: instances.map((i) => ({
      ...(i as unknown as WorkflowInstanceWithSteps),
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
  const result = await loadQueue(supabase, auth.user.id, input)
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
