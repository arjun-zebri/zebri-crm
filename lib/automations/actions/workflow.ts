/**
 * Workflow actions.
 *
 * start_workflow - open another of the MC's workflows on this couple, and
 *                  (by default) end the one this step is in.
 *
 * This is how an MC lays their process out as a line of workflows
 * ("Booked", then "Planning", then "Final details") and moves a couple
 * from one to the next. Dubsado, ActiveCampaign, GoHighLevel and HubSpot
 * all offer the same step.
 *
 * Ending the current workflow is not done here. The handler only reports
 * it in its output (`ended_workflow`); the executor reads that after the
 * step's completion has landed and skips what is left
 * (`lib/workflows/end-instance`). Doing it here would end the workflow
 * even when the completion write then failed and the step is retried.
 *
 * @module lib/automations/actions/workflow
 */

import { z } from 'zod'

import { sendAlert } from '@/lib/alerts/send-alert'
import { createAdminClient } from '@/lib/supabase/admin'
import { CHAIN_TOO_DEEP, MAX_CHAIN_DEPTH } from '@/lib/workflows/chain'
import type { ActionResult, ActionType } from '@/types/automations'

import type { ActionSpec } from './index'

/**
 * `workflow` is the template id. Named for the field rather than the
 * column so a blank one reads "Workflow is required" on the card, not
 * "Template id is required". `endCurrent` defaults on: the step is a
 * hand-off, and a couple sitting in two stage workflows at once is the
 * exception.
 */
const startWorkflowSchema = z
  .object({
    workflow: z.string().min(1),
    endCurrent: z.boolean().default(true),
  })
  .passthrough()

/** The config after parsing, as the handler reads it. */
export type StartWorkflowConfig = z.infer<typeof startWorkflowSchema>

/** A failure retrying cannot fix: only the MC changing the step can. */
function refuse(message: string): ActionResult {
  return { kind: 'error', message, recoverable: false }
}

const startWorkflow: ActionSpec<StartWorkflowConfig> = {
  type: 'start_workflow',
  configSchema: startWorkflowSchema,
  async handler(ctx, config) {
    if (!ctx.coupleId) {
      return refuse('Start workflow needs a couple, and this workflow is not on one.')
    }
    // `automationId` is the running template's id. A workflow starting
    // itself is refused outright rather than left to the dedupe, which a
    // workflow set to allow re-applying would wave through.
    if (config.workflow === ctx.automationId) {
      return refuse('A workflow cannot start itself. Choose a different workflow.')
    }

    const depth = (ctx.chainDepth ?? 0) + 1
    if (depth > MAX_CHAIN_DEPTH) {
      await sendAlert({
        type: 'workflow_chain_failed',
        severity: 'warn',
        userId: ctx.userId,
        coupleId: ctx.coupleId,
        instanceId: ctx.instanceId,
        reason: 'depth_limit',
        message: `start_workflow at depth ${depth}`,
      }).catch(() => undefined)
      return refuse(CHAIN_TOO_DEEP)
    }

    const supabase = createAdminClient()
    // Owner-scoped read. The engine runs on the service role, so RLS is
    // not what keeps a config pointing at another MC's workflow out; this
    // filter is. `applyTemplate` filters the same way, but reading here
    // first gives the MC a sentence that names the problem.
    const { data: target, error: targetError } = await supabase
      .from('workflow_templates')
      .select('id, name, status')
      .eq('id', config.workflow)
      .eq('user_id', ctx.userId)
      .maybeSingle()
    // A failed read is worth retrying; a missing row is not.
    if (targetError) return { kind: 'error', message: targetError.message }
    if (!target || target.status === 'archived') {
      return refuse('The workflow this step starts has been deleted. Choose another one.')
    }

    // Loaded on call, not at the top: the workflows engine imports this
    // registry, and `instantiate` sits on that same engine, so a static
    // import here closes a module cycle.
    const { applyTemplate } = await import('@/lib/workflows/instantiate')
    const result = await applyTemplate(supabase, {
      userId: ctx.userId,
      templateId: target.id,
      coupleId: ctx.coupleId,
      // Same rule as a trigger: never a second live copy on one couple.
      // Retrying after a lost outcome write lands here too, harmlessly.
      dedupe: true,
      chainDepth: depth,
    })

    const base = { workflow_id: target.id, workflow_name: target.name, ended_workflow: config.endCurrent }
    if ('instanceId' in result) {
      // Turned off while it was being built: it waits, paused, for Turn
      // on to offer it back, so the hand-off still happened.
      const started = result.pausedReason !== 'template_off'
      return { kind: 'ok', output: { ...base, started, instance_id: result.instanceId } }
    }
    if (result.skipped === 'template_off') {
      return refuse(`${target.name} is turned off, so it could not start. Turn it on, then try again.`)
    }
    // Already on this couple, or stopped (an exit rule) while it was
    // being built. Neither is a failure of this step: the couple is
    // where the MC wanted them, or somewhere a rule moved them on from.
    if (result.skipped === 'stopped' || result.error === 'already applied to this couple') {
      return { kind: 'ok', output: { ...base, started: false, reason: result.skipped ?? 'already_applied' } }
    }
    // Anything else (the build failed and was rolled back) is safe to
    // retry: the half-built instance was cancelled, releasing the dedupe.
    return { kind: 'error', message: `Could not start ${target.name}: ${result.error}` }
  },
  ui: {
    category: 'flow',
    label: 'Start workflow',
    description: 'Move the couple on to another workflow',
    icon: 'Workflow',
  },
}

/** Workflow actions, keyed by slug, for the action registry. */
export const workflowActions: Partial<Record<ActionType, ActionSpec<StartWorkflowConfig>>> = {
  start_workflow: startWorkflow,
}
