/**
 * To-do + calendar actions.
 *
 * create_task / update_task - write `todo` steps on the couple's default
 *                             applied workflow
 * create_calendar_event    - a dated to-do step (the app surfaces dated
 *                            steps and couple events on the calendar;
 *                            there is no calendar_events table)
 * create_reminder          - alias of create_calendar_event
 *
 * The four action slugs are deliberately unchanged: every converted
 * workflow still holds configs saved against them, so the handler bodies
 * moved to `workflow_steps` while the vocabulary stayed put.
 *
 * @module lib/automations/actions/task
 */

import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { ensureDefaultInstance, ensurePersonalInstance } from '@/lib/workflows/instantiate'
import { computeDueAt, localMidnight } from '@/lib/workflows/timing'
import type { ActionType, RunContext } from '@/types/automations'
import type { Database } from '@/types/database'
import { DEFAULT_STEP_TIMING } from '@/types/workflows'

import { renderTemplate } from '../variables'

import type { ActionSpec } from './index'

/** Fallback when the MC has never saved a timezone. */
const DEFAULT_TIMEZONE = 'Australia/Sydney'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * The instance a generated to-do belongs on: the couple's default
 * workflow, or the MC's personal list when the step is running with no
 * couple in context.
 */
async function targetInstanceId(
  supabase: AdminClient,
  ctx: RunContext,
): Promise<string> {
  return ctx.couple?.id
    ? ensureDefaultInstance(supabase, ctx.userId, ctx.couple.id)
    : ensurePersonalInstance(supabase, ctx.userId)
}

/** The MC's working timezone, for resolving a date to local midnight. */
async function loadTimezone(supabase: AdminClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.timezone ?? DEFAULT_TIMEZONE
}

/** Append a step to the end of an instance, so generated work lands last. */
async function nextPosition(supabase: AdminClient, instanceId: string): Promise<number> {
  const { data } = await supabase
    .from('workflow_steps')
    .select('position')
    .eq('instance_id', instanceId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.position ?? 0) + 1
}

/** Insert one generated to-do step and return its id. */
async function insertTodoStep(
  supabase: AdminClient,
  instanceId: string,
  fields: { title: string; description: string | null; dueAt: string | null },
): Promise<{ id: string } | { error: string }> {
  const row: Database['public']['Tables']['workflow_steps']['Insert'] = {
    instance_id: instanceId,
    position: await nextPosition(supabase, instanceId),
    type: 'todo',
    config: {},
    title: fields.title,
    description: fields.description,
    // A generated to-do is due when it says it is, not when its
    // predecessor finishes, so it never sits behind an unrelated step.
    timing: fields.dueAt
      ? { mode: 'apply_relative', amount: 0, unit: 'days' }
      : DEFAULT_STEP_TIMING,
    due_at: fields.dueAt,
    status: 'pending',
  }
  const { data, error } = await supabase
    .from('workflow_steps')
    .insert(row)
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'failed to create the to-do' }
  return { id: data.id }
}

// ────────────────────────────────────────────────────────────────
// create_task
// ────────────────────────────────────────────────────────────────

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  /** Offset from the event date (overrides dueDate if provided). */
  relativeToEvent: z
    .object({
      direction: z.enum(['before', 'after']),
      amount: z.number().int().min(0),
      unit: z.enum(['days', 'weeks']),
    })
    .optional(),
  // The old category / priority / assignTo / linkedDocument fields
  // were declared but never read (the invented enums didn't even
  // match the user-defined task option tables). Passthrough keeps
  // configs saved against them parsing.
}).passthrough()

const createTask: ActionSpec<z.infer<typeof createTaskSchema>> = {
  type: 'create_task',
  configSchema: createTaskSchema,
  async handler(ctx, config) {
    const supabase = createAdminClient()
    const instanceId = await targetInstanceId(supabase, ctx)
    const timezone = await loadTimezone(supabase, ctx.userId)
    const dueAt = await resolveDueAt(ctx, config, timezone)
    const result = await insertTodoStep(supabase, instanceId, {
      title: renderTemplate(config.title, ctx),
      description: config.description ? renderTemplate(config.description, ctx) : null,
      dueAt,
    })
    if ('error' in result) return { kind: 'error', message: result.error }
    // `task_id` is kept as the output key so an `update_task` step saved
    // before the cutover still finds what the step before it created.
    return { kind: 'ok', output: { task_id: result.id, step_id: result.id, due_at: dueAt } }
  },
  ui: { category: 'general', label: 'Create to-do', description: 'Add a to-do for yourself', icon: 'ListPlus' },
}

// ────────────────────────────────────────────────────────────────
// update_task
// ────────────────────────────────────────────────────────────────

// The old appendNote / reassignTo / pushDueDateBy fields are gone:
// the handler patches status / title / description / dueDate and
// nothing else. Passthrough keeps configs saved against them parsing.
const updateTaskSchema = z.object({
  /** When unset, reads the most recent create_task output from the run. */
  taskId: z.string().uuid().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
}).passthrough()

const updateTask: ActionSpec<z.infer<typeof updateTaskSchema>> = {
  type: 'update_task',
  configSchema: updateTaskSchema,
  async handler(ctx, config) {
    const supabase = createAdminClient()
    const stepId = config.taskId ?? findLatestStepId(ctx)
    if (!stepId) return { kind: 'error', message: 'no to-do id provided and none from earlier steps' }

    const patch: Database['public']['Tables']['workflow_steps']['Update'] = {}
    if (config.status) {
      // The three legacy statuses collapse onto the checklist binary.
      patch.status = config.status === 'done' ? 'done' : 'pending'
      patch.completed_at = config.status === 'done' ? new Date().toISOString() : null
    }
    if (config.title) patch.title = renderTemplate(config.title, ctx)
    if (config.description) patch.description = renderTemplate(config.description, ctx)
    if (config.dueDate) {
      const timezone = await loadTimezone(supabase, ctx.userId)
      patch.due_at = localMidnight(config.dueDate, timezone)
    }

    // Scoped through the instance: a step carries no user_id of its own,
    // so tenancy is enforced by the instance it belongs to.
    const { data: owned } = await supabase
      .from('workflow_steps')
      .select('id, workflow_instances!inner(user_id)')
      .eq('id', stepId)
      .eq('workflow_instances.user_id', ctx.userId)
      .maybeSingle()
    if (!owned) return { kind: 'error', message: 'that to-do does not exist' }

    const { error } = await supabase.from('workflow_steps').update(patch).eq('id', stepId)
    if (error) return { kind: 'error', message: error.message }
    return { kind: 'ok', output: { task_id: stepId, step_id: stepId } }
  },
  ui: { category: 'general', label: 'Update to-do', description: 'Update a to-do created earlier', icon: 'ListChecks' },
}

// ────────────────────────────────────────────────────────────────
// create_calendar_event
// ────────────────────────────────────────────────────────────────

const createCalendarEventSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().optional(),
  /** HH:MM start time. */
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  /** HH:MM end time. */
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  /** Address or virtual link. */
  location: z.string().optional(),
  /** Bucket for filtering. */
  category: z.enum(['consultation', 'rehearsal', 'ceremony', 'followup', 'travel', 'admin', 'other']).optional(),
  /** Auto-send a calendar invite to the couple's primary email. */
  inviteCouple: z.boolean().optional(),
  /** Colour-tag for the calendar surface. */
  colorTag: z.string().optional(),
  /** Reminder hours before the start time (separate from create_reminder). */
  reminderHoursBefore: z.number().int().min(0).max(168).optional(),
  /** Notification channel for reminders. */
  notificationChannel: z.enum(['email', 'slack', 'in_app']).optional(),
}).passthrough()

const createCalendarEvent: ActionSpec<z.infer<typeof createCalendarEventSchema>> = {
  type: 'create_calendar_event',
  configSchema: createCalendarEventSchema,
  async handler(ctx, config) {
    // The calendar surface is fed by date-bearing rows (dated steps plus
    // couple events), so a calendar-event action is a dated to-do step.
    const supabase = createAdminClient()
    const instanceId = await targetInstanceId(supabase, ctx)
    const timezone = await loadTimezone(supabase, ctx.userId)
    const result = await insertTodoStep(supabase, instanceId, {
      title: renderTemplate(config.title, ctx),
      description: config.notes ? renderTemplate(config.notes, ctx) : null,
      dueAt: localMidnight(config.date, timezone),
    })
    if ('error' in result) return { kind: 'error', message: result.error }
    return {
      kind: 'ok',
      output: { calendar_task_id: result.id, task_id: result.id, step_id: result.id },
    }
  },
  ui: { category: 'calendar', label: 'Create calendar event', description: 'Add an event to your calendar', icon: 'CalendarPlus' },
}

// ────────────────────────────────────────────────────────────────
// create_reminder
// ────────────────────────────────────────────────────────────────

const createReminder: ActionSpec<z.infer<typeof createCalendarEventSchema>> = {
  type: 'create_reminder',
  configSchema: createCalendarEventSchema,
  async handler(ctx, config) {
    // Reminders are tasks with a due date in the calendar view.
    return createCalendarEvent.handler(ctx, config)
  },
  ui: { category: 'calendar', label: 'Create reminder', description: 'A reminder to yourself on a future date', icon: 'BellRing' },
}

// ────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────

/**
 * When a generated to-do is due, as an instant.
 *
 * Relative-to-event offsets go through {@link computeDueAt} rather than
 * millisecond arithmetic on a parsed date: adding 86,400,000 ms across a
 * DST boundary lands on the wrong day, which is the bug class this
 * codebase keeps paying for.
 */
async function resolveDueAt(
  ctx: RunContext,
  config: z.infer<typeof createTaskSchema>,
  timezone: string,
): Promise<string | null> {
  if (config.relativeToEvent && ctx.couple?.eventDate) {
    return computeDueAt(
      {
        mode: 'wedding_relative',
        direction: config.relativeToEvent.direction,
        amount: config.relativeToEvent.amount,
        unit: config.relativeToEvent.unit,
      },
      {
        weddingDate: ctx.couple.eventDate,
        appliedAt: new Date().toISOString(),
        previousCompletedAt: null,
        timezone,
      },
    )
  }
  if (config.dueDate) return localMidnight(config.dueDate, timezone)
  return null
}

/**
 * The step id an earlier step in this run created.
 *
 * Still reads `task_id`, because every `update_task` config saved before
 * the cutover expects that key and the handlers write both.
 */
function findLatestStepId(ctx: RunContext): string | null {
  for (const actionId of Object.keys(ctx.actionResults).reverse()) {
    const r = ctx.actionResults[actionId] as Record<string, unknown> | null
    if (r && typeof r['step_id'] === 'string') return r['step_id']
    if (r && typeof r['task_id'] === 'string') return r['task_id']
  }
  return null
}

export const taskActions: Partial<Record<ActionType, ActionSpec<any>>> = {
  create_task: createTask,
  update_task: updateTask,
  create_calendar_event: createCalendarEvent,
  create_reminder: createReminder,
}
