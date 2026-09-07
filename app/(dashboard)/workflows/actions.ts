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
import { createClient } from '@/lib/supabase/server'
import { joinApplyRule } from '@/lib/workflows/apply-rules'
import { splitStepType } from '@/lib/workflows/steps'
import type { Json } from '@/types/database'
import type { WorkflowTemplateRow } from '@/types/workflows'

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

const setStatusSchema = z.object({
  templateId: z.string().uuid(),
  status: z.enum(['draft', 'active', 'archived']),
})

/**
 * Move a template between draft, active and archived.
 *
 * There is no `paused`: the automations model had one, but a template
 * that should stop applying is a draft again, and one that should not
 * be offered at all is archived. Two states covered what three did.
 */
export async function setTemplateStatusAction(
  input: z.infer<typeof setStatusSchema>,
): Promise<ActionResult<null>> {
  const parsed = setStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_templates')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.templateId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/workflows')
  return { ok: true, data: null }
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
 */
export async function setApplyRuleAction(
  input: z.infer<typeof setApplyRuleSchema>,
): Promise<ActionResult<null>> {
  const parsed = setApplyRuleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const rule = joinApplyRule(parsed.data.applyRuleType, parsed.data.applyRuleConfig)
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

const templateIdSchema = z.object({ templateId: z.string().uuid() })

/**
 * Delete a template.
 *
 * Applied instances survive: `workflow_instances.template_id` is
 * `on delete set null`, so a couple's live checklist is never destroyed
 * by tidying up the library.
 */
export async function deleteTemplateAction(
  input: z.infer<typeof templateIdSchema>,
): Promise<ActionResult<null>> {
  const parsed = templateIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_templates')
    .delete()
    .eq('id', parsed.data.templateId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/workflows')
  return { ok: true, data: null }
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
  timing: z.record(z.string(), z.any()).optional(),
  parentStepId: z.string().uuid().nullable().optional(),
  branchPath: z.enum(['yes', 'no']).nullable().optional(),
  requiresApproval: z.boolean().optional(),
  visibleToCouple: z.boolean().optional(),
})

/**
 * Create or update one step on the canvas.
 *
 * A true upsert: the client can supply a UUID it generated for an
 * optimistic insert, so the id stays stable and any follow-up mutation
 * (drag, inline edit) hits the same row whether the server has caught
 * up or not.
 */
export async function upsertTemplateStepRow(
  input: z.infer<typeof upsertStepSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = upsertStepSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
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
  const row = {
    template_id: parsed.data.templateId,
    position: parsed.data.position,
    type: split.type,
    config: restConfig as Json,
    description: note || null,
    title: parsed.data.label ?? '',
    parent_step_id: parsed.data.parentStepId ?? null,
    branch_path: parsed.data.branchPath ?? null,
    ...(parsed.data.timing ? { timing: parsed.data.timing as Json } : {}),
    ...(parsed.data.requiresApproval !== undefined
      ? { requires_approval: parsed.data.requiresApproval }
      : {}),
    ...(parsed.data.visibleToCouple !== undefined
      ? { visible_to_couple: parsed.data.visibleToCouple }
      : {}),
  }

  const query = parsed.data.stepId
    ? supabase
        .from('workflow_template_steps')
        .upsert({ id: parsed.data.stepId, ...row })
        .select('id')
        .single()
    : supabase.from('workflow_template_steps').insert(row).select('id').single()

  const { data, error } = await query
  if (error || !data) return { ok: false, error: error?.message ?? 'failed' }
  revalidatePath(`/workflows/${parsed.data.templateId}`)
  return { ok: true, data: { id: data.id } }
}

const stepPositionSchema = z.object({
  stepId: z.string().uuid(),
  positionX: z.number(),
  positionY: z.number(),
})

/** Persist a node's canvas coordinates after a drag. */
export async function updateTemplateStepPosition(
  input: z.infer<typeof stepPositionSchema>,
): Promise<ActionResult<null>> {
  const parsed = stepPositionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflow_template_steps')
    .update({ canvas_x: parsed.data.positionX, canvas_y: parsed.data.positionY })
    .eq('id', parsed.data.stepId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: null }
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
