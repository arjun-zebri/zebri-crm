/**
 * Task + calendar actions.
 *
 * create_task / update_task - write to public.tasks
 * create_calendar_event    - write a date-anchored task entry (the
 *                            app surfaces tasks with a due date on
 *                            the calendar; there is no separate
 *                            calendar_events table in 14a)
 * create_reminder          - alias of create_task with a calendar
 *                            flag so the UI can show it under the
 *                            "reminders" lane
 *
 * @module lib/automations/actions/task
 */

import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, ActionType, RunContext } from '@/types/automations'

import { renderTemplate } from '../variables'

import type { ActionSpec } from './index'

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
    const dueDate = resolveDueDate(ctx, config)
    const title = renderTemplate(config.title, ctx)
    const description = config.description ? renderTemplate(config.description, ctx) : null
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: ctx.userId,
        title,
        description,
        due_date: dueDate,
        status: 'todo',
        related_couple_id: ctx.couple?.id ?? null,
      } as never)
      .select('id')
      .single()
    if (error || !data) return { kind: 'error', message: error?.message ?? 'failed to create task' }
    return { kind: 'ok', output: { task_id: data.id, due_date: dueDate } }
  },
  ui: { category: 'general', label: 'Create task', description: 'Add a task for yourself', icon: 'ListPlus' },
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
    const taskId = config.taskId ?? findLatestTaskId(ctx)
    if (!taskId) return { kind: 'error', message: 'no task id provided and none from earlier actions' }
    const patch: Record<string, unknown> = {}
    if (config.status) patch.status = config.status
    if (config.title) patch.title = renderTemplate(config.title, ctx)
    if (config.description) patch.description = renderTemplate(config.description, ctx)
    if (config.dueDate) patch.due_date = config.dueDate
    const { error } = await supabase
      .from('tasks')
      .update(patch as never)
      .eq('id', taskId)
      .eq('user_id', ctx.userId)
    if (error) return { kind: 'error', message: error.message }
    return { kind: 'ok', output: { task_id: taskId } }
  },
  ui: { category: 'general', label: 'Update task', description: 'Update an existing task', icon: 'ListChecks' },
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
    // The app's calendar surface is fed by date-bearing rows
    // (tasks with a due date + couple events). 14a routes a
    // calendar-event-creating action through tasks since that's
    // the only surface that renders on the calendar today.
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: ctx.userId,
        title: renderTemplate(config.title, ctx),
        description: config.notes ? renderTemplate(config.notes, ctx) : null,
        due_date: config.date,
        status: 'todo',
        related_couple_id: ctx.couple?.id ?? null,
      } as never)
      .select('id')
      .single()
    if (error || !data) return { kind: 'error', message: error?.message ?? 'failed' }
    return { kind: 'ok', output: { calendar_task_id: data.id } }
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

function resolveDueDate(ctx: RunContext, config: z.infer<typeof createTaskSchema>): string | null {
  if (config.relativeToEvent && ctx.couple?.eventDate) {
    const base = new Date(`${ctx.couple.eventDate}T00:00:00`)
    const direction = config.relativeToEvent.direction === 'before' ? -1 : 1
    const days = config.relativeToEvent.unit === 'weeks'
      ? config.relativeToEvent.amount * 7
      : config.relativeToEvent.amount
    const due = new Date(base.getTime() + direction * days * 86_400_000)
    return due.toISOString().slice(0, 10)
  }
  if (config.dueDate) return config.dueDate
  return null
}

function findLatestTaskId(ctx: RunContext): string | null {
  for (const actionId of Object.keys(ctx.actionResults).reverse()) {
    const r = ctx.actionResults[actionId] as Record<string, unknown> | null
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
