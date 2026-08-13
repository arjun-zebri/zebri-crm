/**
 * AI copilot tool executors — the only mutation path the copilot has.
 *
 * Each executor runs against the **user-scoped** Supabase client (RLS
 * enforces tenant isolation; an automation the caller doesn't own
 * simply doesn't resolve) and validates every model-authored config
 * through `tool-schemas.ts` before anything touches the DB, so the
 * copilot can never persist a step the engine wouldn't accept.
 *
 * Safety rails:
 *   - mutating tools require `status = 'draft'` — the model is told to
 *     ask the user to pause/unpublish first,
 *   - read tools work in any status (explain flows),
 *   - node positions in the DAG are computed here (max+1) and the
 *     parent chain is spliced on insert/remove; the model never sets
 *     canvas coordinates (auto-layout owns those).
 *
 * Errors are returned as `{ ok: false, error }` (never thrown) so the
 * tool loop can relay them to the model for self-correction.
 *
 * @module lib/automations/ai-copilot/tool-executors
 */
import { z } from 'zod'

import type { ActionType, TriggerType } from '@/types/automations'

import { validateActionConfig, validateTriggerConfig } from './tool-schemas'

/* ─── types ──────────────────────────────────────────────────────── */

/**
 * Minimal query surface the executors need. Structural (rather than
 * the full SupabaseClient type) so unit tests can script it. The
 * builder chain is typed as `unknown`-returning and cast at the call
 * sites, which keeps `any` out of the module surface.
 */
export interface CopilotDb {
  from(table: string): CopilotQueryBuilder
}

/**
 * Chainable query-builder surface (subset of supabase-js). Every
 * chain method returns the builder; terminal awaits resolve to
 * `{ data, error }`.
 */
export interface CopilotQueryBuilder extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  select(columns: string): CopilotQueryBuilder
  insert(values: Record<string, unknown>): CopilotQueryBuilder
  update(values: Record<string, unknown>): CopilotQueryBuilder
  delete(): CopilotQueryBuilder
  eq(column: string, value: unknown): CopilotQueryBuilder
  is(column: string, value: unknown): CopilotQueryBuilder
  order(column: string, options?: { ascending: boolean }): CopilotQueryBuilder
  maybeSingle(): CopilotQueryBuilder
  single(): CopilotQueryBuilder
}

/** Per-request execution context for one automation. */
export interface CopilotContext {
  automationId: string
  supabase: CopilotDb
}

/** Uniform tool outcome relayed back into the model loop. */
export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string }

/** The tools the copilot exposes in Phase A. */
export type CopilotToolName =
  | 'read_automation'
  | 'set_trigger'
  | 'add_action'
  | 'update_action_config'
  | 'remove_action'
  | 'list_email_templates'

/* ─── tool input schemas ─────────────────────────────────────────── */

const setTriggerInput = z.object({
  triggerType: z.string().min(1),
  triggerConfig: z.record(z.string(), z.any()).default({}),
})

const addActionInput = z.object({
  type: z.string().min(1),
  config: z.record(z.string(), z.any()).default({}),
  /**
   * Step to insert after. Omit/null appends to the end of the main
   * flow. Pointing at a branch step (with `branchPath`) appends to
   * that side of the branch instead.
   */
  afterActionId: z.string().uuid().nullish(),
  /** Which side of a branch to add to — only with a branch afterActionId. */
  branchPath: z.enum(['yes', 'no']).nullish(),
  /**
   * Insert as the FIRST step instead of appending — of the main flow,
   * or (with a branch afterActionId + branchPath) of that branch side.
   */
  atStart: z.boolean().nullish(),
  label: z.string().max(120).nullish(),
})

const updateActionInput = z.object({
  actionId: z.string().uuid(),
  config: z.record(z.string(), z.any()).optional(),
  label: z.string().max(120).nullish(),
})

const removeActionInput = z.object({ actionId: z.string().uuid() })

/**
 * OpenAI-facing JSON Schemas for each tool's parameters, exported for
 * the LLM client. `config` shapes stay open objects here — the real
 * per-type validation happens in `tool-schemas.ts`, and errors flow
 * back to the model as tool results.
 */
export const COPILOT_TOOL_PARAMETERS: Record<CopilotToolName, Record<string, unknown>> = {
  read_automation: { type: 'object', properties: {}, additionalProperties: false },
  set_trigger: {
    type: 'object',
    properties: {
      triggerType: { type: 'string', description: 'A trigger type from the catalogue.' },
      triggerConfig: { type: 'object', description: 'Config matching the trigger type schema.' },
    },
    required: ['triggerType'],
    additionalProperties: false,
  },
  add_action: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'An action type from the catalogue (incl. wait/branch/stop/approval).' },
      config: { type: 'object', description: 'Config matching the action type schema.' },
      afterActionId: {
        type: ['string', 'null'],
        description:
          'Step id to insert after. Omit/null appends to the end of the main flow. Point at a branch step (with branchPath) to add inside that branch.',
      },
      branchPath: {
        type: ['string', 'null'],
        enum: ['yes', 'no', null],
        description: 'Only when afterActionId is a branch step: which side to add the step to.',
      },
      atStart: {
        type: ['boolean', 'null'],
        description:
          'Insert as the FIRST step (right after the trigger) instead of appending. With a branch afterActionId + branchPath, first in that branch side. Not valid with a non-branch afterActionId.',
      },
      label: { type: ['string', 'null'], description: 'Short human label for the canvas node.' },
    },
    required: ['type'],
    additionalProperties: false,
  },
  update_action_config: {
    type: 'object',
    properties: {
      actionId: { type: 'string' },
      config: { type: 'object', description: 'Full replacement config for the action.' },
      label: { type: ['string', 'null'] },
    },
    required: ['actionId'],
    additionalProperties: false,
  },
  remove_action: {
    type: 'object',
    properties: { actionId: { type: 'string' } },
    required: ['actionId'],
    additionalProperties: false,
  },
  list_email_templates: { type: 'object', properties: {}, additionalProperties: false },
}

/* ─── shared reads ───────────────────────────────────────────────── */

interface AutomationHead {
  id: string
  status: string
  name: string
  trigger_type: TriggerType
  trigger_config: Record<string, unknown>
}

interface ActionNode {
  id: string
  position: number
  type: ActionType
  config?: Record<string, unknown>
  parent_action_id: string | null
  branch_path: 'yes' | 'no' | null
  label?: string | null
}

async function loadAutomation(ctx: CopilotContext): Promise<AutomationHead | null> {
  const { data } = await ctx.supabase
    .from('automations')
    .select('id, status, name, trigger_type, trigger_config')
    .eq('id', ctx.automationId)
    .maybeSingle()
  return (data as AutomationHead | null) ?? null
}

async function loadActions(ctx: CopilotContext): Promise<ActionNode[]> {
  const { data } = await ctx.supabase
    .from('automation_actions')
    .select('id, position, type, config, parent_action_id, branch_path, label')
    .eq('automation_id', ctx.automationId)
    .order('position', { ascending: true })
  return (data as ActionNode[] | null) ?? []
}

/**
 * Load the automation and refuse mutation unless it's a draft. The
 * error strings double as the message the model relays to the user.
 */
async function requireDraft(
  ctx: CopilotContext,
): Promise<{ ok: true; automation: AutomationHead } | { ok: false; error: string }> {
  const automation = await loadAutomation(ctx)
  if (!automation) return { ok: false, error: 'Automation not found.' }
  if (automation.status !== 'draft') {
    return {
      ok: false,
      error: `This automation is ${automation.status}. Ask the user to pause it (set it back to draft) before making changes.`,
    }
  }
  return { ok: true, automation }
}

/* ─── executors ──────────────────────────────────────────────────── */

async function readAutomation(ctx: CopilotContext): Promise<ToolResult> {
  const automation = await loadAutomation(ctx)
  if (!automation) return { ok: false, error: 'Automation not found.' }
  const actions = await loadActions(ctx)
  return {
    ok: true,
    data: {
      name: automation.name,
      status: automation.status,
      trigger: { type: automation.trigger_type, config: automation.trigger_config },
      actions: actions.map((a) => ({
        id: a.id,
        type: a.type,
        label: a.label ?? null,
        config: a.config ?? {},
        parentActionId: a.parent_action_id,
        branchPath: a.branch_path,
        position: a.position,
      })),
    },
  }
}

async function setTrigger(ctx: CopilotContext, input: unknown): Promise<ToolResult> {
  const parsed = setTriggerInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const guard = await requireDraft(ctx)
  if (!guard.ok) return guard
  const valid = validateTriggerConfig(parsed.data.triggerType as TriggerType, parsed.data.triggerConfig)
  if (!valid.ok) return valid
  const { error } = await ctx.supabase
    .from('automations')
    .update({ trigger_type: parsed.data.triggerType, trigger_config: valid.config })
    .eq('id', ctx.automationId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { triggerType: parsed.data.triggerType } }
}

/** Siblings of one slot — same parent + branch side, position order. */
function slotSiblings(
  actions: ActionNode[],
  parentId: string | null,
  branchPath: 'yes' | 'no' | null,
): ActionNode[] {
  return actions
    .filter((a) => a.parent_action_id === parentId && (a.branch_path ?? null) === branchPath)
    .sort((a, b) => a.position - b.position)
}

/**
 * Add a step following the engine's slot model: sequence = siblings
 * ordered by `position`; `parent_action_id` + `branch_path` are set
 * together only for steps inside a branch side (the DB's
 * `automation_actions_branch_consistency` constraint).
 */
async function addAction(ctx: CopilotContext, input: unknown): Promise<ToolResult> {
  const parsed = addActionInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const guard = await requireDraft(ctx)
  if (!guard.ok) return guard
  const valid = validateActionConfig(parsed.data.type as ActionType, parsed.data.config)
  if (!valid.ok) return valid

  const actions = await loadActions(ctx)
  const afterId = parsed.data.afterActionId ?? null
  const branchPath = parsed.data.branchPath ?? null
  const atStart = parsed.data.atStart ?? false

  /** First position in a slot, minus a gap (runs before everything). */
  const headPosition = (siblings: ActionNode[]) => (siblings[0]?.position ?? 200) - 100

  // Resolve the target slot + position from the reference step.
  let slotParent: string | null = null
  let slotBranch: 'yes' | 'no' | null = null
  let position: number

  if (!afterId) {
    if (branchPath) {
      return { ok: false, error: 'branchPath needs afterActionId pointing at a branch step.' }
    }
    const siblings = slotSiblings(actions, null, null)
    position = atStart
      ? headPosition(siblings)
      : (siblings[siblings.length - 1]?.position ?? 0) + 100
  } else {
    const after = actions.find((a) => a.id === afterId)
    if (!after) return { ok: false, error: 'afterActionId does not exist on this automation.' }

    if (after.type === 'branch') {
      if (!branchPath) {
        return {
          ok: false,
          error: 'That step is a branch. Pass branchPath "yes" or "no" to choose a side.',
        }
      }
      slotParent = after.id
      slotBranch = branchPath
      const siblings = slotSiblings(actions, after.id, branchPath)
      position = atStart
        ? headPosition(siblings)
        : (siblings[siblings.length - 1]?.position ?? 0) + 100
    } else {
      if (atStart) {
        return {
          ok: false,
          error: 'atStart cannot combine with a non-branch afterActionId. Use one or the other.',
        }
      }
      if (branchPath) {
        return { ok: false, error: 'branchPath is only valid when afterActionId is a branch step.' }
      }
      // Insert into the reference step's own slot right after it,
      // shifting later siblings out of the way first.
      slotParent = after.parent_action_id
      slotBranch = after.branch_path ?? null
      const siblings = slotSiblings(actions, slotParent, slotBranch)
      for (const sibling of siblings.filter((s) => s.position > after.position)) {
        const { error } = await ctx.supabase
          .from('automation_actions')
          .update({ position: sibling.position + 200 })
          .eq('id', sibling.id)
        if (error) return { ok: false, error: error.message }
      }
      position = after.position + 100
    }
  }

  const { data, error } = await ctx.supabase
    .from('automation_actions')
    .insert({
      automation_id: ctx.automationId,
      position,
      type: parsed.data.type,
      config: valid.config,
      label: parsed.data.label ?? null,
      parent_action_id: slotParent,
      branch_path: slotBranch,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Insert failed.' }

  return { ok: true, data: { id: (data as { id: string }).id, position } }
}

async function updateActionConfig(ctx: CopilotContext, input: unknown): Promise<ToolResult> {
  const parsed = updateActionInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const guard = await requireDraft(ctx)
  if (!guard.ok) return guard

  const { data: row } = await ctx.supabase
    .from('automation_actions')
    .select('id, type, config')
    .eq('id', parsed.data.actionId)
    .eq('automation_id', ctx.automationId)
    .maybeSingle()
  const action = row as { id: string; type: ActionType; config: Record<string, unknown> } | null
  if (!action) return { ok: false, error: 'Action not found on this automation.' }

  const patch: Record<string, unknown> = {}
  if (parsed.data.config !== undefined) {
    const valid = validateActionConfig(action.type, parsed.data.config)
    if (!valid.ok) return valid
    patch.config = valid.config
  }
  if (parsed.data.label !== undefined) patch.label = parsed.data.label
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'Nothing to update. Provide config and/or label.' }
  }

  const { error } = await ctx.supabase
    .from('automation_actions')
    .update(patch)
    .eq('id', action.id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { id: action.id } }
}

async function removeAction(ctx: CopilotContext, input: unknown): Promise<ToolResult> {
  const parsed = removeActionInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const guard = await requireDraft(ctx)
  if (!guard.ok) return guard

  const actions = await loadActions(ctx)
  const target = actions.find((a) => a.id === parsed.data.actionId)
  if (!target) return { ok: false, error: 'Action not found on this automation.' }

  // Only branch steps have children (parent_action_id points at them).
  // Those children move into the removed step's own slot — inheriting
  // BOTH fields together keeps the branch_consistency constraint —
  // sequenced just after where the branch sat.
  const children = actions
    .filter((a) => a.parent_action_id === target.id)
    .sort((a, b) => a.position - b.position)
  for (const [index, child] of children.entries()) {
    const { error } = await ctx.supabase
      .from('automation_actions')
      .update({
        parent_action_id: target.parent_action_id,
        branch_path: target.branch_path ?? null,
        position: target.position + index + 1,
      })
      .eq('id', child.id)
    if (error) return { ok: false, error: error.message }
  }

  const { error } = await ctx.supabase
    .from('automation_actions')
    .delete()
    .eq('id', target.id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { removed: target.id } }
}

/**
 * List the MC's saved (unarchived) email templates so the model can
 * resolve "the enquiry acknowledgement template" to a templateId by
 * NAME — MCs never know template UUIDs. RLS scopes the read.
 */
async function listEmailTemplates(ctx: CopilotContext): Promise<ToolResult> {
  const { data, error } = await ctx.supabase
    .from('email_templates')
    .select('id, name')
    .is('archived_at', null)
    .order('name', { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data as Array<{ id: string; name: string }> | null) ?? [] }
}

/* ─── dispatch ───────────────────────────────────────────────────── */

/**
 * Execute one copilot tool call. Unknown tool names return an error
 * result (never throw) so a hallucinated tool degrades into a message
 * the model can recover from.
 */
export async function executeCopilotTool(
  name: CopilotToolName,
  input: unknown,
  ctx: CopilotContext,
): Promise<ToolResult> {
  switch (name) {
    case 'read_automation':
      return readAutomation(ctx)
    case 'set_trigger':
      return setTrigger(ctx, input)
    case 'add_action':
      return addAction(ctx, input)
    case 'update_action_config':
      return updateActionConfig(ctx, input)
    case 'remove_action':
      return removeAction(ctx, input)
    case 'list_email_templates':
      return listEmailTemplates(ctx)
    default:
      return { ok: false, error: `Unknown tool "${String(name)}".` }
  }
}
