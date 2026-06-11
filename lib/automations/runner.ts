/**
 * Action runner.
 *
 * The other half of the tick. Reads a batch of `running` or
 * just-woken `waiting` runs and advances each one action. An action
 * can:
 *
 *   - succeed (`ok`)        → advance to the next action
 *   - error  (`error`)      → record + flip the run to errored
 *   - sleep  (`sleep`)      → write an automation_waits row,
 *                              flip the run to waiting
 *
 * The runner is the single owner of `automation_runs.status` and
 * `current_action_id` transitions. Every transition is recorded in
 * `automation_audit_log` so a failed run is debuggable from the
 * couple-profile view.
 *
 * Branches are evaluated here too - when an action's type is
 * `branch`, the runner reads the predicate, picks the 'yes' or
 * 'no' child list, and descends.
 *
 * @module lib/automations/runner
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { sendAlert } from '@/lib/alerts/send-alert'
import type {
  ActionResult,
  ApprovalActionConfig,
  AutomationActionRow,
  AutomationEventRow,
  AutomationRunRow,
  BranchActionConfig,
  BranchPath,
  StopActionConfig,
  SubFlowActionConfig,
  WaitActionConfig,
} from '@/types/automations'
import type { Database } from '@/types/database'

import { getActionSpec } from './actions'
import {
  approvalConfigSchema,
  branchConfigSchema,
  evaluateApprovalAction,
  evaluateBranch,
  evaluateStopAction,
  evaluateSubFlowAction,
  evaluateWaitAction,
  stopConfigSchema,
  subFlowConfigSchema,
  waitConfigSchema,
} from './conditions'
import { configErrorMessage } from './config-errors'
import { buildRunContext } from './context'
import { nextAllowedSendAt, resolveQuietHours } from './quiet-hours'

const ACTION_BUDGET_PER_TICK = 200

export interface RunnerResult {
  actionsExecuted: number
  runsCompleted: number
  runsErrored: number
  runsSlept: number
}

/**
 * Advance every live run by one action, up to ACTION_BUDGET_PER_TICK
 * total actions across all runs.
 */
export async function advanceLiveRuns(supabase: SupabaseClient<Database>): Promise<RunnerResult> {
  // Wake any waits that are due first.
  await wakeDueWaits(supabase)

  const { data: runs } = await supabase
    .from('automation_runs' as never)
    .select('*')
    .eq('status', 'running')
    .order('started_at', { ascending: true })
    .limit(ACTION_BUDGET_PER_TICK)

  const result: RunnerResult = {
    actionsExecuted: 0,
    runsCompleted: 0,
    runsErrored: 0,
    runsSlept: 0,
  }

  for (const r of (runs ?? []) as AutomationRunRow[]) {
    if (result.actionsExecuted >= ACTION_BUDGET_PER_TICK) break
    try {
      const advanced = await advanceOne(supabase, r)
      result.actionsExecuted += 1
      if (advanced === 'completed') result.runsCompleted += 1
      else if (advanced === 'errored') result.runsErrored += 1
      else if (advanced === 'slept') result.runsSlept += 1
    } catch (err) {
      await failRun(supabase, r, err instanceof Error ? err.message : String(err))
      result.runsErrored += 1
    }
  }

  return result
}

async function wakeDueWaits(supabase: SupabaseClient<Database>): Promise<void> {
  const now = new Date().toISOString()
  const { data: due } = await supabase
    .from('automation_waits' as never)
    .select('id, run_id')
    .is('consumed_at', null)
    .lte('wake_at', now)
    .limit(500)

  for (const row of (due ?? []) as { id: string; run_id: string }[]) {
    await supabase.from('automation_waits' as never).update({ consumed_at: now } as never).eq('id', row.id)
    await supabase
      .from('automation_runs' as never)
      .update({ status: 'running' } as never)
      .eq('id', row.run_id)
      .eq('status', 'waiting')
  }
}

type AdvanceOutcome = 'advanced' | 'completed' | 'errored' | 'slept'

async function advanceOne(
  supabase: SupabaseClient<Database>,
  run: AutomationRunRow,
): Promise<AdvanceOutcome> {
  if (!run.current_action_id) {
    await completeRun(supabase, run)
    return 'completed'
  }

  const action = await loadAction(supabase, run.current_action_id)
  if (!action) {
    await failRun(supabase, run, 'current_action_id points at missing action')
    return 'errored'
  }

  const event = await loadEvent(supabase, run.event_id)
  if (!event) {
    await failRun(supabase, run, 'triggering event missing')
    return 'errored'
  }

  if (action.disabled) {
    // Skip + record + advance.
    await audit(supabase, run, action, 'action_skipped', { reason: 'disabled' })
    return advanceToNext(supabase, run, action, null)
  }

  await audit(supabase, run, action, 'action_started')

  const ctx = await buildRunContext(supabase, run, event)

  let result: ActionResult
  switch (action.type) {
    case 'wait': {
      const parsed = waitConfigSchema.safeParse(action.config)
      if (!parsed.success) {
        await failRun(supabase, run, configErrorMessage('Wait', parsed.error))
        return 'errored'
      }
      result = applyQuietHours(
        evaluateWaitAction(parsed.data as WaitActionConfig, ctx),
        ctx,
        parsed.data.respectQuietHours,
      )
      break
    }
    case 'branch': {
      const parsed = branchConfigSchema.safeParse(action.config)
      if (!parsed.success) {
        await failRun(supabase, run, configErrorMessage('Branch', parsed.error))
        return 'errored'
      }
      const path = evaluateBranch((parsed.data as BranchActionConfig).predicate, ctx)
      result = { kind: 'ok', output: { branch_taken: path } }
      const nextOutcome = await advanceToNext(supabase, run, action, path)
      await audit(supabase, run, action, 'action_completed', { branch_taken: path })
      return nextOutcome
    }
    case 'stop': {
      const parsed = stopConfigSchema.safeParse(action.config)
      if (!parsed.success) {
        await failRun(supabase, run, configErrorMessage('Stop', parsed.error))
        return 'errored'
      }
      result = evaluateStopAction(parsed.data as StopActionConfig)
      await audit(supabase, run, action, 'action_completed', { reason: parsed.data.reason ?? null })
      await completeRun(supabase, run, parsed.data.reason)
      return 'completed'
    }
    case 'sub_flow': {
      const parsed = subFlowConfigSchema.safeParse(action.config)
      if (!parsed.success) {
        await failRun(supabase, run, configErrorMessage('Run another automation', parsed.error))
        return 'errored'
      }
      await emitManualFire(supabase, run, (parsed.data as SubFlowActionConfig).automationId)
      result = evaluateSubFlowAction(parsed.data as SubFlowActionConfig)
      break
    }
    case 'approval': {
      const parsed = approvalConfigSchema.safeParse(action.config)
      if (!parsed.success) {
        await failRun(supabase, run, configErrorMessage('Approval', parsed.error))
        return 'errored'
      }
      result = evaluateApprovalAction(parsed.data as ApprovalActionConfig)
      break
    }
    default: {
      // Registered action — dispatch via the action registry.
      result = await runRegisteredAction(action, ctx)
    }
  }

  return applyResult(supabase, run, action, result)
}

async function runRegisteredAction(
  action: AutomationActionRow,
  ctx: Awaited<ReturnType<typeof buildRunContext>>,
): Promise<ActionResult> {
  const spec = getActionSpec(action.type)
  if (!spec) return { kind: 'error', message: `unknown action ${action.type}` }
  const parsed = spec.configSchema.safeParse(action.config)
  if (!parsed.success) return { kind: 'error', message: configErrorMessage(spec.ui.label, parsed.error) }
  return spec.handler(ctx, parsed.data as never)
}

function applyQuietHours(
  result: ActionResult,
  ctx: Awaited<ReturnType<typeof buildRunContext>>,
  respect: boolean | undefined,
): ActionResult {
  if (!respect || result.kind !== 'sleep' || result.reason !== 'wait') return result
  const automationRow = (ctx.triggerEvent.payload as Record<string, unknown>)['automation_quiet_hours'] as
    | { start?: string | null; end?: string | null }
    | undefined
  const window = resolveQuietHours(
    automationRow?.start ?? null,
    automationRow?.end ?? null,
    ctx.mc,
    ctx.couple?.timezone ?? null,
  )
  if (!window) return result
  const wake = new Date(result.wakeAt)
  const corrected = nextAllowedSendAt(wake, window)
  if (corrected.getTime() === wake.getTime()) return result
  return { ...result, wakeAt: corrected.toISOString(), reason: 'quiet_hours' }
}

async function applyResult(
  supabase: SupabaseClient<Database>,
  run: AutomationRunRow,
  action: AutomationActionRow,
  result: ActionResult,
): Promise<AdvanceOutcome> {
  switch (result.kind) {
    case 'ok':
      await audit(supabase, run, action, 'action_completed', result.output as Record<string, unknown>)
      await mergeActionOutput(supabase, run, action, result.output)
      return advanceToNext(supabase, run, action, null)
    case 'sleep': {
      await supabase.from('automation_waits' as never).insert({
        run_id: run.id,
        action_id: action.id,
        user_id: run.user_id,
        wake_at: result.wakeAt,
        reason: result.reason,
        token: result.token ?? null,
        payload: result.payload ?? {},
      } as never)
      await supabase
        .from('automation_runs' as never)
        .update({ status: 'waiting' } as never)
        .eq('id', run.id)
      await audit(supabase, run, action, result.reason === 'approval' ? 'approval_requested' : 'quiet_hours_deferred', {
        wake_at: result.wakeAt,
      })
      return 'slept'
    }
    case 'error':
      await audit(supabase, run, action, 'action_errored', { message: result.message })
      await failRun(supabase, run, result.message)
      return 'errored'
  }
}

async function advanceToNext(
  supabase: SupabaseClient<Database>,
  run: AutomationRunRow,
  action: AutomationActionRow,
  branchTaken: BranchPath | null,
): Promise<AdvanceOutcome> {
  const next = await findNextAction(supabase, action, branchTaken, run.automation_id)
  if (!next) {
    await completeRun(supabase, run)
    return 'completed'
  }
  await supabase
    .from('automation_runs' as never)
    .update({ current_action_id: next.id } as never)
    .eq('id', run.id)
  return 'advanced'
}

/**
 * Find the next action to execute.
 *
 *   - If we just evaluated a branch, descend into its first
 *     'yes'/'no' child.
 *   - Otherwise, find the next sibling at the same level (same
 *     parent_action_id, same branch_path, position > ours).
 *   - If no sibling, walk up: continue from the parent's next
 *     sibling.
 *   - When walking out reaches the top level with no next sibling,
 *     return null → run completes.
 */
async function findNextAction(
  supabase: SupabaseClient<Database>,
  action: AutomationActionRow,
  branchTaken: BranchPath | null,
  automationId: string,
): Promise<AutomationActionRow | null> {
  if (branchTaken) {
    const { data: child } = await supabase
      .from('automation_actions' as never)
      .select('*')
      .eq('parent_action_id', action.id)
      .eq('branch_path', branchTaken)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (child) return child as AutomationActionRow
    // Empty branch path - fall through and look for siblings of
    // the branch action itself.
  }

  // Find sibling at the same level.
  let current: AutomationActionRow | null = action
  while (current) {
    const sibling = await findNextSibling(supabase, current, automationId)
    if (sibling) return sibling
    if (!current.parent_action_id) return null
    current = await loadAction(supabase, current.parent_action_id)
  }
  return null
}

async function findNextSibling(
  supabase: SupabaseClient<Database>,
  action: AutomationActionRow,
  automationId: string,
): Promise<AutomationActionRow | null> {
  const query = supabase
    .from('automation_actions' as never)
    .select('*')
    .eq('automation_id', automationId)
    .gt('position', action.position)
    .order('position', { ascending: true })
    .limit(1)
  const scoped = action.parent_action_id
    ? query.eq('parent_action_id', action.parent_action_id).eq('branch_path', action.branch_path ?? '')
    : query.is('parent_action_id', null)
  const { data } = await scoped.maybeSingle()
  return (data as AutomationActionRow | null) ?? null
}

// ────────────────────────────────────────────────────────────────
// Persistence helpers
// ────────────────────────────────────────────────────────────────

async function loadAction(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<AutomationActionRow | null> {
  const { data } = await supabase
    .from('automation_actions' as never)
    .select('*')
    .eq('id', id)
    .single()
  return (data as AutomationActionRow | null) ?? null
}

async function loadEvent(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<AutomationEventRow | null> {
  const { data } = await supabase
    .from('automation_events' as never)
    .select('*')
    .eq('id', id)
    .single()
  return (data as AutomationEventRow | null) ?? null
}

async function audit(
  supabase: SupabaseClient<Database>,
  run: AutomationRunRow,
  action: AutomationActionRow | null,
  event: string,
  details?: unknown,
): Promise<void> {
  await supabase.from('automation_audit_log' as never).insert({
    automation_id: run.automation_id,
    run_id: run.id,
    action_id: action?.id ?? null,
    user_id: run.user_id,
    event,
    details: details ?? {},
  } as never)
}

async function mergeActionOutput(
  supabase: SupabaseClient<Database>,
  run: AutomationRunRow,
  action: AutomationActionRow,
  output: unknown,
): Promise<void> {
  if (!output) return
  const payload = (run.last_payload as Record<string, unknown> | null) ?? {}
  const actionResults = (payload['action_results'] as Record<string, unknown>) ?? {}
  actionResults[action.id] = output
  await supabase
    .from('automation_runs' as never)
    .update({ last_payload: { ...payload, action_results: actionResults } } as never)
    .eq('id', run.id)
}

async function completeRun(
  supabase: SupabaseClient<Database>,
  run: AutomationRunRow,
  reason?: string,
): Promise<void> {
  await supabase
    .from('automation_runs' as never)
    .update({ status: 'completed', completed_at: new Date().toISOString(), current_action_id: null } as never)
    .eq('id', run.id)
  await audit(supabase, run, null, 'run_completed', reason ? { reason } : {})
}

async function failRun(
  supabase: SupabaseClient<Database>,
  run: AutomationRunRow,
  message: string,
): Promise<void> {
  await supabase
    .from('automation_runs' as never)
    .update({ status: 'errored', error_message: message, completed_at: new Date().toISOString() } as never)
    .eq('id', run.id)
  await audit(supabase, run, null, 'run_errored', { message })
  // Best-effort Slack alert; doesn't block run state.
  void sendAlert({
    type: 'app_error',
    severity: 'error',
    source: 'automations.runner',
    message: `automation ${run.automation_id} errored: ${message}`,
  })
}

async function emitManualFire(
  supabase: SupabaseClient<Database>,
  run: AutomationRunRow,
  targetAutomationId: string,
): Promise<void> {
  await supabase.rpc('emit_automation_event' as never, {
    p_user_id: run.user_id,
    p_source_table: 'automation_runs',
    p_source_id: run.id,
    p_event_type: 'manual_fire',
    p_payload: { automation_id: targetAutomationId, parent_run_id: run.id } as never,
    p_couple_id: run.couple_id,
  } as never)
}
