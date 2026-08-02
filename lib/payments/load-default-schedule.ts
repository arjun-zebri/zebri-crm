/**
 * Load and resolve an MC's default payment schedule against an invoice total.
 *
 * Fetches the schedule, sorts stages by position (PostgREST gives no order
 * guarantee on nested relations), maps to TemplateStage format, validates
 * and resolves, and returns a discriminated result.
 *
 * Sorting is done in TypeScript, not in the query, so correctness does not
 * depend on subtle query-string forms.
 *
 * @module lib/payments/load-default-schedule
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveStages } from '@/lib/payments/resolve-stages'
import type { TemplateStage, ResolvedStage } from '@/types/payment-schedule'

/** Outcome of loading and resolving the default schedule. */
export type LoadScheduleResult =
  | { ok: true; firstStage: ResolvedStage | null }
  | { ok: false; reason: 'read_error' | 'validation_error'; error?: unknown }
  | { ok: false; reason: 'no_schedule' }

/**
 * Load the MC's default payment schedule and resolve its first stage.
 *
 * Policy decisions left to the caller: a read_error means the route aborts
 * and the modal surfaces a toast. A validation_error is logged but render
 * as dash. A no_schedule is silently dash.
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - The MC's user ID
 * @param totalCents - Invoice total in cents
 * @param issueDate - ISO YYYY-MM-DD date
 */
export async function loadDefaultScheduleFirstStage(
  supabase: SupabaseClient,
  userId: string,
  totalCents: number,
  issueDate: string,
): Promise<LoadScheduleResult> {
  const { data, error } = await supabase
    .from('payment_schedules')
    .select('id, payment_schedule_stages(position, label, amount_type, amount_value, due_offset_value, due_offset_unit, due_offset_anchor)')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()

  // Distinguish: read error (infrastructure), no schedule (data), validation
  // error (data corruption). Only read errors should abort.
  if (error) {
    return { ok: false, reason: 'read_error', error }
  }

  if (!data) {
    return { ok: false, reason: 'no_schedule' }
  }

  // PostgREST gives no order guarantee on nested relations without an explicit
  // order clause. Sort the stages by position in TypeScript so correctness
  // does not depend on a query-string form that is easy to get wrong and
  // impossible to notice when it fails.
  const stages = (data.payment_schedule_stages ?? [])
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      label: s.label,
      amountType: s.amount_type as 'percent' | 'fixed' | 'remainder',
      amountValue: s.amount_value,
      offsetValue: s.due_offset_value,
      offsetUnit: s.due_offset_unit as 'day' | 'week' | 'month',
      offsetAnchor: s.due_offset_anchor as 'issue' | 'due',
    })) as TemplateStage[]

  const resolved = resolveStages(stages, totalCents, issueDate)
  if (!resolved.ok) {
    return { ok: false, reason: 'validation_error', error: resolved.errors }
  }

  return {
    ok: true,
    firstStage: resolved.stages[0] ?? null,
  }
}
