/**
 * `task_overdue` time-based emitter (A5).
 *
 * Fires when a task that isn't done (`status != 'done'`) has sat past
 * its `due_date` for the threshold configured on an active
 * `task_overdue` automation. The threshold is
 * `max(1, daysOverdueMin ?? 1)` — see {@link taskOverdueThresholdDays}
 * — so "overdue" always means strictly past the due date; the due
 * date itself is not yet overdue. This matches the design note left in
 * `20260604000100_create_automation_db_triggers.sql`: a task is
 * overdue when `due_date < today AND status != 'done'`, computed by
 * the tick (no DB trigger captures it). Direct sibling of the A2
 * `quote_overdue` / A4 `invoice_overdue` emitters.
 *
 * Unlike quotes/invoices, a task need not belong to a couple — the
 * emitted event's `couple_id` is the task's `related_couple_id`, which
 * may be null. The dispatcher fans those out the same way.
 *
 * # Emit semantics
 *
 *   - One event per (task, threshold, calendar day). A task fires once
 *     when it crosses each active threshold — not every day it remains
 *     overdue. Two automations with the same threshold share one
 *     event; different thresholds get separate events on their
 *     respective days.
 *   - Payload carries `days_overdue` so the trigger's match() can
 *     narrow to "this automation's threshold" — same pattern as
 *     `quote_overdue` / `invoice_overdue`.
 *   - Idempotency: an event with the same
 *     (`source_id`, `event_type`, `days_overdue`) already emitted
 *     today is skipped.
 *
 * # Known limitations
 *
 *   - The `taskCategory`, `taskPriority`, `assignedTo` and
 *     `dueWithinDays*` config fields are accepted by the schema but
 *     **not enforced** here. `task_type` is a free-form per-user tag
 *     (not the fixed `taskCategory` enum), tasks carry no assignee
 *     column, and a "due within N days" filter is meaningless for an
 *     already-overdue task. The payload still carries `priority` /
 *     `task_type` for downstream template variables.
 *   - Day boundaries are UTC (same caveat as `quote_due`).
 *   - Fires forward only: a task already deeper overdue than the
 *     threshold when the automation is activated will not retro-fire.
 *
 * @module lib/automations/time-emitters/task-overdue
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getTriggerSpec,
  taskOverdueThresholdDays,
} from '@/lib/automations/triggers'
import type { Database } from '@/types/database'

import type { TimeEmitter } from './index'

/** A task row that could potentially fire. */
interface CandidateTask {
  id: string
  user_id: string
  related_couple_id: string | null
  related_event_id: string | null
  title: string
  due_date: string | null
  status: string
  priority: string | null
  task_type: string | null
}

/** Lower bound for "today" in UTC, for the per-day dedupe window. */
function startOfUtcDay(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString()
}

/**
 * Render the `due_date` value (a Postgres `date`, ISO `YYYY-MM-DD`)
 * for a task that is exactly `daysOverdue` days past its due date
 * today.
 */
function dueDateForOverdueDays(daysOverdue: number): string {
  const today = new Date()
  const target = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  target.setUTCDate(target.getUTCDate() - daysOverdue)
  return target.toISOString().slice(0, 10)
}

/**
 * Resolve the effective overdue threshold from a raw trigger_config
 * jsonb. Defers to the trigger spec's Zod schema so saved-but-empty
 * configs behave like the defaults (the A1 picker regression).
 * Returns null if the config is unrecoverably invalid, or describes
 * an impossible window (max below the effective min) that match()
 * could never accept.
 */
function parseThreshold(config: unknown): number | null {
  const spec = getTriggerSpec('task_overdue')
  if (!spec) return null
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) return null
  const data = parsed.data as {
    daysOverdueMin?: number
    daysOverdueMax?: number
  }
  const threshold = taskOverdueThresholdDays(data)
  if (data.daysOverdueMax !== undefined && threshold > data.daysOverdueMax) {
    return null
  }
  return threshold
}

/**
 * Collect every (user, threshold) pair across active `task_overdue`
 * automations — the emitter only emits combinations something will
 * actually match.
 */
async function collectActiveThresholds(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, Set<number>>> {
  const { data, error } = await supabase
    .from('automations' as never)
    .select('user_id, trigger_config')
    .eq('status', 'active')
    .eq('trigger_type', 'task_overdue')

  if (error) {
    throw new Error(`load task_overdue automations: ${error.message}`)
  }

  const grouped = new Map<string, Set<number>>()
  for (const row of (data ?? []) as Array<{
    user_id: string
    trigger_config: unknown
  }>) {
    const threshold = parseThreshold(row.trigger_config)
    if (threshold === null) continue
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, new Set())
    grouped.get(row.user_id)!.add(threshold)
  }
  return grouped
}

/**
 * Has an event already been emitted today for this
 * (task, days_overdue) bucket? Prevents re-emit across ticks within
 * the same calendar day.
 */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  taskId: string,
  daysOverdue: number,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events' as never)
    .select('id, payload')
    .eq('source_table', 'tasks')
    .eq('source_id', taskId)
    .eq('event_type', 'task_overdue')
    .gte('created_at', dayStart)
    .limit(50)

  if (error) throw new Error(`dedupe lookup: ${error.message}`)
  // Narrow by payload field in JS — JSON path operators aren't
  // ergonomic via PostgREST, and the per-day window is already tiny.
  for (const row of (data ?? []) as Array<{
    id: string
    payload: { days_overdue?: unknown } | null
  }>) {
    if (Number(row.payload?.days_overdue) === daysOverdue) return true
  }
  return false
}

/**
 * Find tasks for `userId` that cross the `daysOverdue` threshold
 * today. A task is a candidate when it isn't done — draft-equivalent
 * states `todo` and `in_progress` both still need chasing; only
 * `done` tasks are settled.
 */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  daysOverdue: number,
): Promise<CandidateTask[]> {
  const targetDate = dueDateForOverdueDays(daysOverdue)
  const { data, error } = await supabase
    .from('tasks')
    .select(
      'id, user_id, related_couple_id, related_event_id, title, due_date, status, priority, task_type',
    )
    .eq('user_id', userId)
    .neq('status', 'done')
    .eq('due_date', targetDate)

  if (error) throw new Error(`load tasks: ${error.message}`)
  return (data ?? []) as CandidateTask[]
}

/**
 * Emit a single `task_overdue` event. The RPC bypasses RLS via
 * SECURITY DEFINER — correct for a system-initiated tick. `couple_id`
 * is the task's `related_couple_id` and may be null.
 */
async function emit(
  supabase: SupabaseClient<Database>,
  task: CandidateTask,
  daysOverdue: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: task.user_id,
    p_source_table: 'tasks',
    p_source_id: task.id,
    p_event_type: 'task_overdue',
    p_payload: {
      task_id: task.id,
      title: task.title,
      due_date: task.due_date,
      status: task.status,
      priority: task.priority,
      task_type: task.task_type,
      related_couple_id: task.related_couple_id,
      related_event_id: task.related_event_id,
      days_overdue: daysOverdue,
    } as never,
    p_couple_id: task.related_couple_id,
  } as never)
  if (error) throw new Error(`emit task_overdue: ${error.message}`)
}

/**
 * The exported emitter. Reads active automations, fans out per
 * (user, threshold) pair, dedupes per day, emits matching events.
 */
export const taskOverdueEmitter: TimeEmitter = {
  type: 'task_overdue',
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const grouped = await collectActiveThresholds(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, thresholds] of grouped) {
      for (const daysOverdue of thresholds) {
        const candidates = await loadCandidates(supabase, userId, daysOverdue)
        for (const task of candidates) {
          if (
            await alreadyEmittedToday(supabase, task.id, daysOverdue, dayStart)
          ) {
            continue
          }
          await emit(supabase, task, daysOverdue)
          emitted += 1
        }
      }
    }
    return emitted
  },
}
