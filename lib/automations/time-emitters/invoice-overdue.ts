/**
 * `invoice_overdue` time-based emitter (A4).
 *
 * Fires when an invoice with status `'sent'` or `'deposit_paid'` (i.e. a balance
 * is still outstanding — it hasn't been fully paid or cancelled) has sat past its
 * due date for the threshold configured on an active `invoice_overdue` automation.
 * The threshold is `max(1, daysOverdueMin ?? 1)` — see
 * {@link invoiceOverdueThresholdDays} — so "overdue" always means strictly past
 * the due date; the due date itself belongs to `invoice_due` with `days: 0`.
 *
 * Operates on two sources:
 *
 * 1. **Payment stages**: When an invoice has N payment stages, each unpaid stage
 *    (paid_at is null) on a `'sent'` or `'deposit_paid'` invoice can fire when
 *    its due_date falls past the threshold. The emitter includes stage metadata
 *    in the payload so downstream triggers and templates can distinguish the
 *    balance by position and label.
 * 2. **Stageless invoices**: Invoices with no stage rows (legacy single-payment
 *    model) fire off their own top-level `due_date`, exactly as before. This is
 *    backward compatible with existing automations and single-payment invoices.
 *
 * Direct sibling of the A2 `quote_overdue` emitter.
 *
 * # Emit semantics
 *
 *   - One event per (invoice-or-stage, threshold, calendar day). An invoice or
 *     stage fires once when it crosses each active threshold — not every day it
 *     remains overdue. When two stages of the same invoice fall overdue on the
 *     same day, they emit two separate events (deduped by stage_id in addition
 *     to days_overdue).
 *   - Payload carries `days_overdue` so the trigger's match() can narrow to
 *     "this automation's threshold" — same pattern as `quote_overdue`'s
 *     `days_overdue` and `invoice_due`'s `days_until_due`.
 *   - Payload carries stage metadata (stage_id, stage_label, stage_position,
 *     stage_count, stage_amount_cents) when firing for a stage. All fields are
 *     null for stageless invoices.
 *   - Idempotency: an event with the same
 *     (`source_id`, `event_type`, `days_overdue`, `stage_id`) already emitted
 *     today is skipped. Across ticks this means each stage/invoice gets at most
 *     one event per (threshold, day).
 *
 * # Why deposit_paid is included
 *
 *   The invoice status flips to `'deposit_paid'` the moment the first stage is
 *   paid. Filtering only `'sent'` would mean the remaining balance is never
 *   chased. Filtering both `'sent'` and `'deposit_paid'` keeps reminders live
 *   until every stage is settled (status becomes `'paid'`).
 *
 * # Known limitations
 *
 *   - `isFinalBalance` and `daysUntilEventOp`/`daysUntilEventValue` config
 *     fields are accepted by the schema but **not enforced** here — final-balance
 *     tracking is out of A4's scope.
 *   - Day boundaries are UTC (same caveat as `quote_due`).
 *   - Fires forward only: an invoice already deeper overdue than the threshold
 *     when the automation is activated will not retro-fire.
 *
 * @module lib/automations/time-emitters/invoice-overdue
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getTriggerSpec,
  invoiceOverdueThresholdDays,
} from '@/lib/automations/triggers'
import type { Database } from '@/types/database'

import type { TimeEmitter } from './index'

/** An invoice-or-stage that could fire today. */
interface Candidate {
  invoiceId: string
  userId: string
  coupleId: string | null
  invoiceNumber: string | null
  subtotal: number | null
  dueDate: string | null
  /** Null for a stageless invoice firing off its own due_date. */
  stageId: string | null
  stageLabel: string | null
  stagePosition: number | null
  stageCount: number | null
  stageAmountCents: number | null
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
 * for an invoice that is exactly `daysOverdue` days past its due date
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
 * could never accept — those automations are skipped rather than
 * having events emitted that nothing will route.
 */
function parseThreshold(config: unknown): number | null {
  const spec = getTriggerSpec('invoice_overdue')
  if (!spec) return null
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) return null
  const data = parsed.data as {
    daysOverdueMin?: number
    daysOverdueMax?: number
  }
  const threshold = invoiceOverdueThresholdDays(data)
  if (data.daysOverdueMax !== undefined && threshold > data.daysOverdueMax) {
    return null
  }
  return threshold
}

/**
 * Collect every (user, threshold) pair across active
 * `invoice_overdue` automations — the emitter only emits combinations
 * something will actually match.
 */
async function collectActiveThresholds(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, Set<number>>> {
  const { data, error } = await supabase
    .from('automations' as never)
    .select('user_id, trigger_config')
    .eq('status', 'active')
    .eq('trigger_type', 'invoice_overdue')

  if (error) {
    throw new Error(`load invoice_overdue automations: ${error.message}`)
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
 * (invoice-or-stage, days_overdue) bucket? Prevents re-emit across ticks
 * within the same calendar day.
 *
 * Why stage_id must be part of the dedupe: when two stages of the same invoice
 * fall overdue on the same day, they must emit two separate events. Deduping only
 * on (source_id, days_overdue) would collapse them into one.
 */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  invoiceId: string,
  daysOverdue: number,
  stageId: string | null,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events' as never)
    .select('id, payload')
    .eq('source_table', 'invoices')
    .eq('source_id', invoiceId)
    .eq('event_type', 'invoice_overdue')
    .gte('created_at', dayStart)
    .limit(50)

  if (error) throw new Error(`dedupe lookup: ${error.message}`)
  // Narrow by payload field in JS — JSON path operators aren't
  // ergonomic via PostgREST, and the per-day window is already tiny.
  for (const row of (data ?? []) as Array<{
    id: string
    payload: { days_overdue?: unknown; stage_id?: unknown } | null
  }>) {
    if (
      Number(row.payload?.days_overdue) === daysOverdue &&
      (row.payload?.stage_id ?? null) === stageId
    ) {
      return true
    }
  }
  return false
}

/**
 * Candidates for `userId` at the given overdue threshold.
 *
 * Two sources, because both must keep working:
 *
 *  1. Unpaid stage rows falling overdue on the target date, on invoices that are
 *     still `sent` or part paid. `deposit_paid` is included deliberately: the old
 *     `status = 'sent'` filter meant an invoice went silent the moment its first
 *     payment landed, so the balance was never chased.
 *  2. Invoices with no stage rows at all, firing off their own `due_date`
 *     exactly as before. A single-payment invoice has no stage to anchor on.
 */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  daysOverdue: number,
): Promise<Candidate[]> {
  const targetDate = dueDateForOverdueDays(daysOverdue)

  const { data: stageRows, error: stageError } = await supabase
    .from('invoice_payment_stages')
    .select(
      'id, invoice_id, position, label, amount_cents, due_date, invoices!inner(id, user_id, couple_id, invoice_number, subtotal, status)',
    )
    .eq('user_id', userId)
    .is('paid_at', null)
    .eq('due_date', targetDate)
  if (stageError) throw new Error(`load invoice stages: ${stageError.message}`)

  const eligible = (stageRows ?? []).filter((row) => {
    const status = (row.invoices as { status: string }).status
    return status === 'sent' || status === 'deposit_paid'
  })

  // stage_count is needed for the isFinalBalance narrowing in triggers.ts.
  const counts = new Map<string, number>()
  if (eligible.length > 0) {
    const { data: allStages } = await supabase
      .from('invoice_payment_stages')
      .select('invoice_id')
      .in('invoice_id', [...new Set(eligible.map((r) => r.invoice_id))])
    for (const row of allStages ?? []) {
      counts.set(row.invoice_id, (counts.get(row.invoice_id) ?? 0) + 1)
    }
  }

  const fromStages: Candidate[] = eligible.map((row) => {
    const inv = row.invoices as {
      user_id: string
      couple_id: string | null
      invoice_number: string | null
      subtotal: number | null
    }
    return {
      invoiceId: row.invoice_id,
      userId: inv.user_id,
      coupleId: inv.couple_id,
      invoiceNumber: inv.invoice_number,
      subtotal: inv.subtotal,
      dueDate: row.due_date,
      stageId: row.id,
      stageLabel: row.label,
      stagePosition: row.position,
      stageCount: counts.get(row.invoice_id) ?? 1,
      stageAmountCents: row.amount_cents,
    }
  })

  const { data: stageless, error: stagelessError } = await supabase
    .from('invoices')
    .select('id, user_id, couple_id, invoice_number, due_date, subtotal')
    .eq('user_id', userId)
    .eq('status', 'sent')
    .eq('due_date', targetDate)
  if (stagelessError) throw new Error(`load invoices: ${stagelessError.message}`)

  const withStages = new Set<string>()
  if ((stageless ?? []).length > 0) {
    const { data } = await supabase
      .from('invoice_payment_stages')
      .select('invoice_id')
      .in('invoice_id', (stageless ?? []).map((i) => i.id))
    for (const row of data ?? []) withStages.add(row.invoice_id)
  }

  const fromInvoices: Candidate[] = (stageless ?? [])
    .filter((i) => !withStages.has(i.id))
    .map((i) => ({
      invoiceId: i.id,
      userId: i.user_id,
      coupleId: i.couple_id,
      invoiceNumber: i.invoice_number,
      subtotal: i.subtotal,
      dueDate: i.due_date,
      stageId: null,
      stageLabel: null,
      stagePosition: null,
      stageCount: null,
      stageAmountCents: null,
    }))

  return [...fromStages, ...fromInvoices]
}

/**
 * Emit a single `invoice_overdue` event for an invoice-or-stage at the given
 * threshold. The RPC bypasses RLS via SECURITY DEFINER, which is exactly what
 * we want — the tick is system-initiated.
 */
async function emit(
  supabase: SupabaseClient<Database>,
  candidate: Candidate,
  daysOverdue: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: candidate.userId,
    p_source_table: 'invoices',
    p_source_id: candidate.invoiceId,
    p_event_type: 'invoice_overdue',
    p_payload: {
      invoice_id: candidate.invoiceId,
      invoice_number: candidate.invoiceNumber,
      couple_id: candidate.coupleId,
      due_date: candidate.dueDate,
      subtotal: candidate.subtotal,
      days_overdue: daysOverdue,
      stage_id: candidate.stageId,
      stage_label: candidate.stageLabel,
      stage_position: candidate.stagePosition,
      stage_count: candidate.stageCount,
      stage_amount_cents: candidate.stageAmountCents,
    } as never,
    p_couple_id: candidate.coupleId,
  } as never)
  if (error) throw new Error(`emit invoice_overdue: ${error.message}`)
}

/**
 * The exported emitter. Reads active automations, fans out per
 * (user, threshold) pair, dedupes per day, emits matching events.
 */
export const invoiceOverdueEmitter: TimeEmitter = {
  type: 'invoice_overdue',
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const grouped = await collectActiveThresholds(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, thresholds] of grouped) {
      for (const daysOverdue of thresholds) {
        const candidates = await loadCandidates(supabase, userId, daysOverdue)
        for (const candidate of candidates) {
          if (
            await alreadyEmittedToday(
              supabase,
              candidate.invoiceId,
              daysOverdue,
              candidate.stageId,
              dayStart,
            )
          ) {
            continue
          }
          await emit(supabase, candidate, daysOverdue)
          emitted += 1
        }
      }
    }
    return emitted
  },
}
