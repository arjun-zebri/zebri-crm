/**
 * Server actions for saved payment schedules and per-invoice stage rows.
 *
 * Every write goes through the authenticated server client, so RLS is the
 * authority on ownership; none of these actions filter by `user_id` in
 * application code beyond stamping it on insert.
 *
 * @module app/(dashboard)/payments/schedule-actions
 */
'use server'

import { z } from 'zod'

import { validateForSave } from '@/lib/payments/resolve-stages'
import { createClient } from '@/lib/supabase/server'
import type { PaymentSchedule, ResolvedStage, TemplateStage } from '@/types/payment-schedule'

const templateStageSchema = z.object({
  label: z.string().min(1).max(80),
  amountType: z.enum(['percent', 'fixed', 'remainder']),
  amountValue: z.number().nonnegative().nullable(),
  dueOffsetDays: z.number().int().min(0).max(3650),
})

const resolvedStageSchema = templateStageSchema
  .omit({ dueOffsetDays: true })
  .extend({
    position: z.number().int().min(1),
    amountCents: z.number().int().nonnegative(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })

/**
 * Throw the resolver's save-time validation as a readable error.
 */
function assertSavable(stages: TemplateStage[]): void {
  const errors = validateForSave(stages)
  if (errors.length === 0) return
  if (errors.some((e) => e.code === 'single_stage')) {
    throw new Error('A schedule needs at least two stages: a single stage is the same as no schedule.')
  }
  throw new Error(`Schedule is not valid: ${errors.map((e) => e.code).join(', ')}`)
}

/**
 * Every saved schedule for the current MC, stages included, ordered by name.
 */
export async function listSchedules(): Promise<PaymentSchedule[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payment_schedules')
    .select('id, name, is_default, payment_schedule_stages(position, label, amount_type, amount_value, due_offset_days)')
    .order('name')
  if (error) throw new Error(`Could not load schedules: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    stages: [...row.payment_schedule_stages]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        label: s.label,
        amountType: s.amount_type as TemplateStage['amountType'],
        amountValue: s.amount_value === null ? null : Number(s.amount_value),
        dueOffsetDays: s.due_offset_days,
      })),
  }))
}

/**
 * Create a saved schedule from the stages currently on an invoice.
 */
export async function createSchedule(input: {
  name: string
  stages: TemplateStage[]
}): Promise<{ id: string }> {
  const parsed = z
    .object({ name: z.string().min(1).max(80), stages: z.array(templateStageSchema) })
    .parse(input)
  assertSavable(parsed.stages)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: schedule, error } = await supabase
    .from('payment_schedules')
    .insert({ user_id: user.id, name: parsed.name, is_default: false })
    .select('id')
    .single()
  if (error || !schedule) throw new Error(`Could not create the schedule: ${error?.message ?? 'unknown'}`)

  await insertStages(supabase, user.id, schedule.id, parsed.stages)
  return { id: schedule.id }
}

/**
 * Rename a schedule, replace its stages, or both.
 */
export async function updateSchedule(input: {
  id: string
  name?: string
  stages?: TemplateStage[]
}): Promise<void> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(80).optional(),
      stages: z.array(templateStageSchema).optional(),
    })
    .parse(input)
  if (parsed.stages) assertSavable(parsed.stages)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  if (parsed.name !== undefined) {
    const { error } = await supabase
      .from('payment_schedules')
      .update({ name: parsed.name })
      .eq('id', parsed.id)
    if (error) throw new Error(`Could not rename the schedule: ${error.message}`)
  }

  if (parsed.stages) {
    // Template stages carry no payment state, so a wholesale replace is safe
    // here in a way it is not for invoice stages.
    await supabase.from('payment_schedule_stages').delete().eq('schedule_id', parsed.id)
    await insertStages(supabase, user.id, parsed.id, parsed.stages)
  }
}

/**
 * Delete a saved schedule. Invoices already stamped from it are unaffected.
 */
export async function deleteSchedule(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('payment_schedules')
    .delete()
    .eq('id', z.string().uuid().parse(id))
  if (error) throw new Error(`Could not delete the schedule: ${error.message}`)
}

/**
 * Move the default flag onto one schedule.
 *
 * Clears every other flag first: the partial unique index would otherwise
 * reject the update, and clearing-then-setting is the only ordering that works
 * without a deferrable constraint.
 */
export async function setDefaultSchedule(id: string): Promise<void> {
  const scheduleId = z.string().uuid().parse(id)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  await supabase
    .from('payment_schedules')
    .update({ is_default: false })
    .eq('user_id', user.id)
    .eq('is_default', true)

  const { error } = await supabase
    .from('payment_schedules')
    .update({ is_default: true })
    .eq('id', scheduleId)
  if (error) throw new Error(`Could not set the default schedule: ${error.message}`)
}

/**
 * Persist the invoice's stage rows.
 *
 * Paid stages are never deleted or rewritten: money has moved against them, so
 * the incoming list only governs unpaid positions. Any unpaid row not present
 * in the incoming list is removed.
 */
export async function replaceInvoiceStages(input: {
  invoiceId: string
  stages: ResolvedStage[]
}): Promise<void> {
  const parsed = z
    .object({ invoiceId: z.string().uuid(), stages: z.array(resolvedStageSchema) })
    .parse(input)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: existing } = await supabase
    .from('invoice_payment_stages')
    .select('id, position, paid_at')
    .eq('invoice_id', parsed.invoiceId)

  const paidPositions = new Set(
    (existing ?? []).filter((r) => r.paid_at !== null).map((r) => r.position),
  )

  const unpaidIds = (existing ?? []).filter((r) => r.paid_at === null).map((r) => r.id)
  if (unpaidIds.length > 0) {
    await supabase.from('invoice_payment_stages').delete().in('id', unpaidIds)
  }

  const rows = parsed.stages
    .filter((s) => !paidPositions.has(s.position))
    .map((s) => ({
      user_id: user.id,
      invoice_id: parsed.invoiceId,
      position: s.position,
      label: s.label,
      amount_type: s.amountType,
      amount_value: s.amountValue,
      amount_cents: s.amountCents,
      due_date: s.dueDate,
    }))

  if (rows.length === 0) return
  // Uniform keys on every row: supabase-js drops rows silently when the shape
  // varies across a bulk insert.
  const { error } = await supabase.from('invoice_payment_stages').insert(rows)
  if (error) throw new Error(`Could not save the payment schedule: ${error.message}`)
}

/**
 * Record a manual (non-Stripe) payment against one stage.
 */
export async function markStagePaid(stageId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('invoice_payment_stages')
    .update({ paid_at: new Date().toISOString() })
    .eq('id', z.string().uuid().parse(stageId))
    .is('paid_at', null)
  if (error) throw new Error(`Could not mark the stage paid: ${error.message}`)
}

/**
 * Shared insert for template stages, keeping key shape uniform.
 */
async function insertStages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  scheduleId: string,
  stages: TemplateStage[],
): Promise<void> {
  if (stages.length === 0) return
  const { error } = await supabase.from('payment_schedule_stages').insert(
    stages.map((s, i) => ({
      user_id: userId,
      schedule_id: scheduleId,
      position: i + 1,
      label: s.label,
      amount_type: s.amountType,
      amount_value: s.amountValue,
      due_offset_days: s.dueOffsetDays,
    })),
  )
  if (error) throw new Error(`Could not save the schedule stages: ${error.message}`)
}
