/**
 * Flow-control handlers: wait, branch, stop, sub_flow, approval.
 *
 * These five action types are evaluated by the runner directly
 * rather than going through the action registry. They control the
 * flow of a run (sleep, fork, halt, hand off, gate on user
 * approval) and never emit user-visible side effects on their own.
 *
 * Each handler receives the action config + the run context and
 * returns an {@link ActionResult} the runner interprets:
 *
 *   - `ok`     → advance to the next action
 *   - `sleep`  → suspend the run; the runner writes a row into
 *                automation_waits with wake_at = the requested time
 *   - `error`  → halt with an error message
 *
 * Branches additionally emit a `branch_path` hint that tells the
 * runner which child sublist to descend into.
 *
 * @module lib/automations/conditions
 */

import { z } from 'zod'

import { addDaysToDateString, addMonthsToDateString, zonedTimeToUtc } from '@/lib/scheduling/timezone'
import type {
  ActionResult,
  ApprovalActionConfig,
  BranchPredicate,
  BranchActionConfig,
  CoupleSnapshot,
  RunContext,
  StopActionConfig,
  SubFlowActionConfig,
  WaitActionConfig,
} from '@/types/automations'

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

export const waitConfigSchema = z.object({
  mode: z.enum(['duration', 'until_date', 'relative_to_event']),
  durationMinutes: z.number().int().min(1).max(525_600).optional(),
  untilDate: z.string().optional(),
  relative: z
    .object({
      // Capped at the same ceiling as `durationMinutes`: past a few
      // million months the wake date is not a valid Date and
      // computeWaitWakeAt throws, and SQL's relative wake returns null.
      amount: z.number().int().min(0).max(525_600),
      // `months` is calendar months on the event date (owner ruling
      // 2026-09-27); see computeWaitWakeAt.
      unit: z.enum(['minutes', 'hours', 'days', 'weeks', 'months']),
      direction: z.enum(['before', 'after']),
      anchor: z.enum(['event_date']),
    })
    .optional(),
  respectQuietHours: z.boolean().optional().default(true),
})

export const branchPredicateSchema: z.ZodSchema<BranchPredicate> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal('couple_field'),
      field: z.string(),
      op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'is_set', 'is_unset']),
      // Optional because `is_set` / `is_unset` take no operand, and
      // `z.any()` alone still demands the key be present — a branch
      // saved without it failed the union parse and never ran.
      value: z.any().optional(),
    }),
    z.object({
      kind: z.literal('event_in'),
      op: z.enum(['<', '<=', '>', '>=']),
      days: z.number().int(),
    }),
    z.object({ kind: z.literal('has_paid_deposit') }),
    z.object({ kind: z.literal('has_paid_invoice') }),
    z.object({ kind: z.literal('has_signed_contract') }),
    z.object({
      kind: z.literal('custom_field'),
      key: z.string(),
      op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'is_set', 'is_unset']),
      value: z.any().optional(),
    }),
    z.object({ kind: z.literal('and'), predicates: z.array(branchPredicateSchema) }),
    z.object({ kind: z.literal('or'), predicates: z.array(branchPredicateSchema) }),
    z.object({ kind: z.literal('not'), predicate: branchPredicateSchema }),
  ]),
)

export const branchConfigSchema = z.object({ predicate: branchPredicateSchema })

export const stopConfigSchema = z.object({ reason: z.string().optional() })

export const subFlowConfigSchema = z.object({ automationId: z.string().uuid() })

export const approvalConfigSchema = z.object({
  prompt: z.string().min(1),
  expiresInDays: z.number().int().min(1).max(30).default(3),
  approverEmail: z.string().email(),
})

// ────────────────────────────────────────────────────────────────
// wait
// ────────────────────────────────────────────────────────────────

/**
 * Compute the wake time for a wait action. The runner uses this to
 * decide whether the action has already elapsed (advance immediately)
 * or needs to sleep.
 *
 * Only the couple's wedding date and the MC's timezone are read from the
 * context, so the parameter asks for no more: applying a workflow judges
 * a wait's date with this same function before any run context exists
 * (`isPastWait` in `lib/workflows/apply-skips.ts`).
 *
 * A date-only wake ("2 months before the wedding", "until 1 March") is
 * 09:00 on that day in the MC's timezone. It used to be `T09:00:00`
 * parsed on the server, which runs in UTC, so every such wait woke at
 * 8pm in Sydney (owner report, 2026-10-20). Days, weeks and months shift
 * the calendar date and then take 09:00, so a wait across a daylight-
 * saving switch still lands at 9am on the wall clock; minutes and hours
 * are an instant offset from 09:00 on the wedding day. The SQL recompute
 * (`_workflow_wait_relative_wake_local`, 20261101000000) derives the same
 * instant; keep the two in step.
 *
 * With no wedding date a relative wait answers `now`, as it always has:
 * the callers that need to tell "no date" from "already passed" ask
 * {@link waitNeedsWeddingDate} first.
 */
export function computeWaitWakeAt(
  config: WaitActionConfig,
  ctx: { couple: Pick<CoupleSnapshot, 'eventDate'> | null; timezone: string },
  now: Date = new Date(),
): Date {
  switch (config.mode) {
    case 'duration': {
      const m = config.durationMinutes ?? 0
      return new Date(now.getTime() + m * 60_000)
    }
    case 'until_date': {
      if (!config.untilDate) return now
      const d =
        config.untilDate.length === 10
          ? zonedTimeToUtc(config.untilDate, WAIT_WAKE_TIME, ctx.timezone)
          : new Date(config.untilDate)
      return Number.isNaN(d.getTime()) ? now : d
    }
    case 'relative_to_event': {
      const r = config.relative
      const anchor = ctx.couple?.eventDate
      if (!r || !anchor) return now
      const direction = r.direction === 'before' ? -1 : 1
      if (r.unit === 'minutes' || r.unit === 'hours') {
        const base = zonedTimeToUtc(anchor, WAIT_WAKE_TIME, ctx.timezone)
        const unitMs = r.unit === 'minutes' ? 60_000 : 3_600_000
        return new Date(base.getTime() + direction * r.amount * unitMs)
      }
      // A month has no fixed length, so it is calendar arithmetic on the
      // event's own date, clamped to the end of a shorter month: 31 March
      // minus 1 month is 28 or 29 February.
      const shifted =
        r.unit === 'months'
          ? addMonthsToDateString(anchor, direction * r.amount)
          : addDaysToDateString(anchor, direction * r.amount * (r.unit === 'weeks' ? 7 : 1))
      return zonedTimeToUtc(shifted, WAIT_WAKE_TIME, ctx.timezone)
    }
  }
}

/** The wall-clock time a date-only wait wakes at, in the MC's timezone. */
const WAIT_WAKE_TIME = '09:00'

/**
 * The wake a wait parks on while the couple has no wedding date. Far
 * future, so nothing resumes it but a date arriving: the wedding-date
 * trigger (`_workflow_recompute_wedding_steps`) re-derives a sleeping
 * relative wait's wake from its config the moment one is set.
 */
export const NEEDS_WEDDING_DATE_WAKE = '9999-12-31T00:00:00.000Z'

/**
 * Does this wait count from a wedding date the couple does not have?
 *
 * Such a wait used to finish at once, which released every send behind
 * it on the spot: three "N months before the wedding" check-ins applied
 * to an undated couple all came due together. It parks instead
 * ({@link evaluateWaitAction}), and Upcoming says why.
 */
export function waitNeedsWeddingDate(config: WaitActionConfig, eventDate: string | null | undefined): boolean {
  return config.mode === 'relative_to_event' && Boolean(config.relative) && !eventDate
}

/**
 * Run a wait: finish it, or say how long it sleeps.
 *
 * @param timezone - the MC's IANA timezone (`loadMcTimezone`), which a
 *   date-only wake is resolved in
 */
export function evaluateWaitAction(
  config: WaitActionConfig,
  ctx: RunContext,
  timezone: string,
  now: Date = new Date(),
): ActionResult {
  if (waitNeedsWeddingDate(config, ctx.couple?.eventDate)) {
    return { kind: 'sleep', wakeAt: NEEDS_WEDDING_DATE_WAKE, reason: 'needs_wedding_date' }
  }
  const wake = computeWaitWakeAt(config, { couple: ctx.couple, timezone }, now)
  if (wake.getTime() <= now.getTime()) return { kind: 'ok' }
  return { kind: 'sleep', wakeAt: wake.toISOString(), reason: 'wait' }
}

// ────────────────────────────────────────────────────────────────
// branch
// ────────────────────────────────────────────────────────────────

/**
 * Evaluate a branch predicate against the run context. Returns
 * `'yes'` or `'no'` - the runner uses this to choose which child
 * sublist to descend into.
 */
export function evaluateBranch(predicate: BranchPredicate, ctx: RunContext): 'yes' | 'no' {
  return evaluatePredicate(predicate, ctx) ? 'yes' : 'no'
}

/**
 * Evaluate a predicate and return a boolean. Used by evaluateBranch
 * and exported for testing purposes.
 */
export function evaluatePredicate(pred: BranchPredicate, ctx: RunContext): boolean {
  switch (pred.kind) {
    case 'couple_field': {
      if (!ctx.couple) return false
      const v = readCoupleField(ctx, pred.field)
      return compare(v, pred.op, pred.value)
    }
    case 'event_in': {
      const date = ctx.couple?.eventDate
      if (!date) return false
      const days = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000)
      switch (pred.op) {
        case '<':
          return days < pred.days
        case '<=':
          return days <= pred.days
        case '>':
          return days > pred.days
        case '>=':
          return days >= pred.days
      }
    }
    case 'has_paid_deposit': {
      // "Deposit paid" means the first stage of the invoice's schedule is
      // settled. The previous implementation read ctx.couple.deposit_paid_at,
      // a column the couples table does not have, so it never returned true.
      return Boolean(ctx.invoice?.firstStagePaidAt)
    }
    case 'has_paid_invoice':
      // Settled in full, as opposed to `has_paid_deposit`, which only
      // asks whether the first stage landed.
      return ctx.invoice?.status === 'paid'
    case 'has_signed_contract':
      // `contractSignedAt` is the real answer, loaded with the rest of
      // the context. The other two reads are kept for the trigger that
      // carries a signature in its own payload, but neither was ever
      // written by anything, so on their own this condition could not
      // return true.
      return (
        Boolean(ctx.contractSignedAt) ||
        Boolean(ctx.actionResults?.['contract_signed_at']) ||
        Boolean((ctx.triggerEvent.payload as Record<string, unknown>)?.['contract_signed'])
      )
    case 'custom_field': {
      const value = (ctx.actionResults?.[`custom_field_${pred.key}`] as unknown) ?? null
      return compare(value, pred.op, pred.value)
    }
    case 'and':
      return pred.predicates.every((p) => evaluatePredicate(p, ctx))
    case 'or':
      return pred.predicates.some((p) => evaluatePredicate(p, ctx))
    case 'not':
      return !evaluatePredicate(pred.predicate, ctx)
  }
}

function readCoupleField(ctx: RunContext, field: string): unknown {
  const c = ctx.couple
  if (!c) return null
  switch (field) {
    case 'status':
      return c.status
    case 'event_date':
      return c.eventDate
    case 'venue':
      return c.venue
    case 'lead_source':
      return c.leadSource
    case 'email':
      return c.email
    case 'phone':
      return c.phone
    case 'name':
      return c.name
    default:
      return null
  }
}

function compare(left: unknown, op: string, right: unknown): boolean {
  switch (op) {
    case 'is_set':
      return left != null && left !== ''
    case 'is_unset':
      return left == null || left === ''
    case 'eq':
      return left === right
    case 'neq':
      return left !== right
    case 'contains':
      return typeof left === 'string' && typeof right === 'string' && left.includes(right)
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = toNumber(left)
      const b = toNumber(right)
      if (a == null || b == null) return false
      if (op === 'gt') return a > b
      if (op === 'gte') return a >= b
      if (op === 'lt') return a < b
      return a <= b
    }
    default:
      return false
  }
}

function toNumber(x: unknown): number | null {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null
  if (typeof x === 'string') {
    const n = Number(x)
    return Number.isFinite(n) ? n : null
  }
  return null
}

// ────────────────────────────────────────────────────────────────
// stop
// ────────────────────────────────────────────────────────────────

export function evaluateStopAction(_config: StopActionConfig): ActionResult {
  // The runner treats the `ok` result as "advance"; for a stop
  // action it interprets ok-without-next-action as run-completed.
  // We return a special-cased ok with output marking the stop
  // reason for the audit trail.
  return { kind: 'ok', output: { stopped: true } }
}

// ────────────────────────────────────────────────────────────────
// sub_flow
// ────────────────────────────────────────────────────────────────

/**
 * Sub-flow execution is dispatcher-side: the runner emits a
 * synthetic `automation_events` row with event_type =
 * `manual_fire` and the target automation id in the payload, then
 * the dispatcher opens a new run for it.
 *
 * This handler's responsibility is just to validate the config
 * and return ok - the actual emit is the runner's job using the
 * service-role client.
 */
export function evaluateSubFlowAction(config: SubFlowActionConfig): ActionResult {
  return { kind: 'ok', output: { sub_flow_automation_id: config.automationId } }
}

// ────────────────────────────────────────────────────────────────
// approval
// ────────────────────────────────────────────────────────────────

/**
 * An approval action sends an email to the configured approver,
 * suspends the run, and resumes when the approver clicks
 * through the magic link (handled by /api/automations/approve/[token]).
 */
export function evaluateApprovalAction(
  config: ApprovalActionConfig,
  now: Date = new Date(),
): ActionResult {
  const token = generateApprovalToken()
  const wake = new Date(now.getTime() + config.expiresInDays * 86_400_000)
  return {
    kind: 'sleep',
    wakeAt: wake.toISOString(),
    reason: 'approval',
    token,
    payload: { prompt: config.prompt, approverEmail: config.approverEmail },
  }
}

function generateApprovalToken(): string {
  // 16 bytes of randomness, base36 - plenty for collision avoidance
  // in the automation_waits table (unique index enforces).
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('')
}
