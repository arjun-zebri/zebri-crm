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

import type {
  ActionResult,
  ApprovalActionConfig,
  BranchPredicate,
  BranchActionConfig,
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
      amount: z.number().int().min(0),
      unit: z.enum(['minutes', 'hours', 'days', 'weeks']),
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
      value: z.any(),
    }),
    z.object({
      kind: z.literal('event_in'),
      op: z.enum(['<', '<=', '>', '>=']),
      days: z.number().int(),
    }),
    z.object({ kind: z.literal('has_paid_deposit') }),
    z.object({ kind: z.literal('has_signed_contract') }),
    z.object({
      kind: z.literal('custom_field'),
      key: z.string(),
      op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'is_set', 'is_unset']),
      value: z.any(),
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
 */
export function computeWaitWakeAt(
  config: WaitActionConfig,
  ctx: RunContext,
  now: Date = new Date(),
): Date {
  switch (config.mode) {
    case 'duration': {
      const m = config.durationMinutes ?? 0
      return new Date(now.getTime() + m * 60_000)
    }
    case 'until_date': {
      if (!config.untilDate) return now
      const d = new Date(config.untilDate.length === 10 ? `${config.untilDate}T09:00:00` : config.untilDate)
      return Number.isNaN(d.getTime()) ? now : d
    }
    case 'relative_to_event': {
      const r = config.relative
      const anchor = ctx.couple?.eventDate
      if (!r || !anchor) return now
      const base = new Date(`${anchor}T09:00:00`)
      const direction = r.direction === 'before' ? -1 : 1
      const unitMs = { minutes: 60_000, hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 }[r.unit]
      return new Date(base.getTime() + direction * r.amount * unitMs)
    }
  }
}

export function evaluateWaitAction(
  config: WaitActionConfig,
  ctx: RunContext,
  now: Date = new Date(),
): ActionResult {
  const wake = computeWaitWakeAt(config, ctx, now)
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
    case 'has_signed_contract':
      return Boolean(ctx.actionResults?.['contract_signed_at']) || Boolean((ctx.triggerEvent.payload as Record<string, unknown>)?.['contract_signed'])
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
