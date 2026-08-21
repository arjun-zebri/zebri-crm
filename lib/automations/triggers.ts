/**
 * Trigger registry: one entry per supported trigger type.
 *
 * Each entry knows three things:
 *
 *   - its config Zod schema (validated at automation-save time
 *     by the builder + on read in the dispatcher),
 *   - how to `match` a published event against a user-configured
 *     instance (so the same DB-trigger event can fan out to
 *     multiple automations, each with its own narrowing),
 *   - UI metadata for the builder's trigger picker.
 *
 * The Trigger-type strings here are the canonical contract with
 * `emit_automation_event` payloads in
 * `20260604000100_create_automation_db_triggers.sql` (and the
 * `20260605000000_*` / `20260605000200_*` extensions that add
 * events / contacts / contract revoke-expire + event_date in
 * couple stage payloads). Adding a new trigger means:
 * (a) wire its emit site (DB trigger, webhook, or tick) and
 * (b) add an entry here.
 *
 * @module lib/automations/triggers
 */

import { z } from 'zod'

import type { AutomationEventRow, TriggerType } from '@/types/automations'

import {
  COMPARISON_OPS,
  CONSULTATION_LOCATIONS,
  CONSULTATION_OUTCOMES,
  CONSULTATION_TYPES,
  CONTACT_CATEGORIES,
  DAY_OF_WEEK_BUCKETS,
  EMAIL_ENGAGEMENT_KINDS,
  EVENT_CHANGE_FIELDS,
  EVENT_TYPES,
  MONTHS,
  PAYMENT_FAILURE_REASONS,
  PORTAL_COMPLETION_RANGES,
  PORTAL_SECTIONS,
  SEASONS,
  TIME_UNITS,
  WEBHOOK_SOURCES,
  compareNumber,
  dateMatchesDayOfWeek,
  monthOfDate,
  seasonOfDate,
  type ComparisonOp,
  type DayOfWeekBucket,
} from './trigger-constants'

export interface TriggerUi {
  category:
    | 'lead'
    | 'pipeline'
    | 'calendar'
    | 'consultation'
    | 'portal'
    | 'task'
    | 'payment'
    | 'contract'
    | 'contact'
    | 'engagement'
    | 'compliance'
    | 'billing'
    | 'integration'
    | 'meta'
    | 'manual'
  label: string
  description: string
  icon: string
}

export interface TriggerSpec<Config = unknown> {
  type: TriggerType
  configSchema: z.ZodSchema<Config>
  match: (event: AutomationEventRow, config: Config) => boolean
  ui: TriggerUi
}

/** Helper: untyped read of the payload that's safe in match() bodies. */
function p(event: AutomationEventRow): Record<string, unknown> {
  return (event.payload as Record<string, unknown>) ?? {}
}

const empty = z.object({}).passthrough()

/**
 * Apply an amount filter to a payload field. Returns true when no
 * threshold is configured (filter absent = match all).
 */
function amountMatches(
  payload: Record<string, unknown>,
  field: string,
  op: ComparisonOp | undefined,
  value: number | undefined,
): boolean {
  if (op === undefined || value === undefined) return true
  const raw = payload[field]
  const num = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isNaN(num)) return false
  return compareNumber(num, op, value)
}

/**
 * Compare "days from now until `date`" against a threshold. A past
 * date gives a negative count, so "at most 7 days" matches something
 * already overdue, which is what an MC expects from that phrasing.
 *
 * Returns false for an absent or unparseable date: a filter on how
 * far away something is cannot be satisfied by something with no date.
 */
function daysFromNowMatches(
  date: string | null,
  op: ComparisonOp,
  value: number,
): boolean {
  if (!date) return false
  const ts = new Date(date).getTime()
  if (Number.isNaN(ts)) return false
  const days = Math.floor((ts - Date.now()) / (1000 * 60 * 60 * 24))
  return compareNumber(days, op, value)
}

/**
 * Days-until-event filter, anchored on an ISO date in the payload.
 * Couple-shaped payloads carry the wedding under `event_date`; event
 * rows carry their own date under `date`, hence the field parameter.
 */
function daysUntilEventMatches(
  payload: Record<string, unknown>,
  op: ComparisonOp | undefined,
  value: number | undefined,
  field: string = 'event_date',
): boolean {
  if (op === undefined || value === undefined) return true
  const raw = payload[field]
  return daysFromNowMatches(raw ? String(raw) : null, op, value)
}

/**
 * The wedding-date filter family, shared by every trigger whose
 * payload carries an `event_date`.
 *
 * Optionals are spelled `?: T | undefined` so a caller passing a
 * `z.infer`-derived config still satisfies this under
 * `exactOptionalPropertyTypes`; Zod always emits the `| undefined`.
 */
interface EventDateConfig {
  hasEventDate?: boolean | undefined
  dayOfWeek?: DayOfWeekBucket | undefined
  eventMonth?: string | undefined
  season?: string | undefined
}

/**
 * Apply the has-a-date / day / month / season filters to a payload
 * carrying `event_date`. Absent filters match everything.
 *
 * The date-derived three are strict about a missing date: a couple
 * with no wedding date yet hasn't got a December wedding, so it must
 * not match one.
 */
function eventDateMatches(
  payload: Record<string, unknown>,
  config: EventDateConfig,
  field: string = 'event_date',
): boolean {
  const eventDate = payload[field] ? String(payload[field]) : null

  if (config.hasEventDate !== undefined && config.hasEventDate !== Boolean(eventDate)) {
    return false
  }
  if (config.dayOfWeek && config.dayOfWeek !== 'any') {
    if (!eventDate) return false
    if (!dateMatchesDayOfWeek(eventDate, config.dayOfWeek)) return false
  }
  if (config.eventMonth && monthOfDate(eventDate) !== config.eventMonth) return false
  if (config.season && config.season !== 'any' && seasonOfDate(eventDate) !== config.season) {
    return false
  }
  return true
}

/**
 * Zod fragments for the shared filter families. Spread these into a
 * spec's `z.object({...})` rather than redeclaring the fields, so
 * every trigger agrees on the config keys the chip UI writes.
 */
const eventDateConfigShape = {
  hasEventDate: z.boolean().optional(),
  dayOfWeek: z.enum(DAY_OF_WEEK_BUCKETS).optional(),
  // `''` is the inspector's "added but nothing chosen yet" value;
  // MONTHS has no neutral member the way the other enums have 'any'.
  eventMonth: z.union([z.enum(MONTHS), z.literal('')]).optional(),
  season: z.enum(SEASONS).optional(),
}

const daysUntilEventShape = {
  daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
  daysUntilEventValue: z.number().int().optional(),
}

// ────────────────────────────────────────────────────────────────
// Lead / enquiry
// ────────────────────────────────────────────────────────────────

const newEnquiry: TriggerSpec<{
  leadSource?: string
  daysUntilEventOp?: ComparisonOp
  daysUntilEventValue?: number
  hasEventDate?: boolean
  dayOfWeek?: DayOfWeekBucket
  eventMonth?: string
  season?: string
  initialStatus?: string
}> = {
  type: 'new_enquiry',
  configSchema: z.object({
    // Deliberately a free string rather than `z.enum(LEAD_SOURCES)`:
    // `couples.lead_source` is a plain text column, and an automation
    // saved against a source that later disappears from the list must
    // keep loading (it simply stops matching) instead of failing
    // validation and blocking every save on the automation.
    leadSource: z.string().optional(),
    daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
    daysUntilEventValue: z.number().int().optional(),
    hasEventDate: z.boolean().optional(),
    dayOfWeek: z.enum(DAY_OF_WEEK_BUCKETS).optional(),
    // `''` is the inspector's "added but nothing chosen yet" value, and
    // MONTHS has no neutral member of its own the way DAY_OF_WEEK_BUCKETS
    // and SEASONS have `'any'`. The matcher reads it as no narrowing.
    eventMonth: z.union([z.enum(MONTHS), z.literal('')]).optional(),
    season: z.enum(SEASONS).optional(),
    initialStatus: z.string().optional(),
  }).passthrough(),
  // Every filter below is enforced against the `new_enquiry` payload
  // emitted by `tg_couples_emit_new_enquiry` (couple_id, couple_name,
  // lead_source, status, event_date). Filters with no backing data
  // (budget tier, referring contact, venue) were removed rather than
  // left inert: a filter that can never match reads as a broken app.
  match(event, config) {
    const payload = p(event)
    if (config.leadSource && payload.lead_source !== config.leadSource) return false
    if (config.initialStatus && payload.status !== config.initialStatus) return false
    if (!daysUntilEventMatches(payload, config.daysUntilEventOp, config.daysUntilEventValue)) return false
    return eventDateMatches(payload, config)
  },
  ui: {
    category: 'lead',
    label: 'New enquiry',
    description: 'When a couple is added to your CRM',
    icon: 'UserPlus',
  },
}

const leadInactive: TriggerSpec<{
  days: number
  status?: string
  lastActivityType?: 'any' | 'no_email_reply' | 'no_portal_visit' | 'no_quote_view'
  excludeIfDoNotContact?: boolean
  excludeIfReplied?: boolean
}> = {
  type: 'lead_inactive',
  configSchema: z.object({
    days: z.number().int().min(1).max(180),
    status: z.string().optional(),
    lastActivityType: z.enum(['any', 'no_email_reply', 'no_portal_visit', 'no_quote_view']).optional(),
    excludeIfDoNotContact: z.boolean().optional(),
    excludeIfReplied: z.boolean().optional(),
  }).passthrough(),
  // Status narrowing happens at the tick-emit site because match()
  // can't see the couple snapshot. We keep the option here for the
  // future tick implementation to read.
  match: () => true,
  ui: {
    category: 'lead',
    label: 'Lead inactive',
    description: 'When a couple has had no activity for X days',
    icon: 'MoonStar',
  },
}

const customFieldChanged: TriggerSpec<{
  key?: string
  valueOp?: ComparisonOp
  valueNumber?: number
  valueText?: string
  previousValueText?: string
  changedBy?: 'any' | 'mc' | 'system' | 'couple_portal'
}> = {
  type: 'custom_field_changed',
  configSchema: z.object({
    key: z.string().optional(),
    valueOp: z.enum(COMPARISON_OPS).optional(),
    valueNumber: z.number().optional(),
    valueText: z.string().optional(),
    previousValueText: z.string().optional(),
    changedBy: z.enum(['any', 'mc', 'system', 'couple_portal']).optional(),
  }).passthrough(),
  match(event, config) {
    const payload = p(event)
    if (config.key && payload.key !== config.key) return false
    if (config.valueOp !== undefined && config.valueNumber !== undefined) {
      const raw = payload.value
      const num = typeof raw === 'number' ? raw : Number(raw)
      if (Number.isNaN(num)) return false
      if (!compareNumber(num, config.valueOp, config.valueNumber)) return false
    }
    return true
  },
  ui: {
    category: 'lead',
    label: 'Custom field changed',
    description: "When a couple's custom field changes value",
    icon: 'Settings2',
  },
}

// ────────────────────────────────────────────────────────────────
// Pipeline (couples)
// ────────────────────────────────────────────────────────────────

const coupleStageChanged: TriggerSpec<{
  toStatus?: string
  fromStatus?: string
  leadSource?: string
  daysUntilEventOp?: ComparisonOp
  daysUntilEventValue?: number
  hasEventDate?: boolean
  dayOfWeek?: DayOfWeekBucket
  eventMonth?: string
  season?: string
}> = {
  type: 'couple_stage_changed',
  configSchema: z.object({
    // Statuses and lead source are free strings, not enums: both are
    // user-owned values (`couple_statuses` rows, `couples.lead_source`
    // text), and an automation saved against one that later disappears
    // has to keep parsing in the dispatcher. It simply stops matching
    // rather than failing validation and disabling the automation.
    toStatus: z.string().optional(),
    fromStatus: z.string().optional(),
    leadSource: z.string().optional(),
    daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
    daysUntilEventValue: z.number().int().optional(),
    hasEventDate: z.boolean().optional(),
    dayOfWeek: z.enum(DAY_OF_WEEK_BUCKETS).optional(),
    // `''` is the inspector's "added but nothing chosen yet" value, and
    // MONTHS has no neutral member of its own the way DAY_OF_WEEK_BUCKETS
    // and SEASONS have `'any'`. The matcher reads it as no narrowing.
    eventMonth: z.union([z.enum(MONTHS), z.literal('')]).optional(),
    season: z.enum(SEASONS).optional(),
  }).passthrough(),
  // Every filter below is enforced against the payload emitted by
  // `tg_couples_emit_stage_changed` (couple_id, couple_name,
  // from_status, to_status, lead_source, event_date). `timeInPreviousStage*`
  // and `triggeredBy` were removed rather than left inert: nothing
  // records when a couple entered its previous stage, and the DB
  // trigger cannot see whether an MC, an automation or the portal
  // made the change.
  match(event, config) {
    const payload = p(event)
    if (config.toStatus && payload.to_status !== config.toStatus) return false
    if (config.fromStatus && payload.from_status !== config.fromStatus) return false
    if (config.leadSource && payload.lead_source !== config.leadSource) return false
    if (!daysUntilEventMatches(payload, config.daysUntilEventOp, config.daysUntilEventValue)) return false
    return eventDateMatches(payload, config)
  },
  ui: {
    category: 'pipeline',
    label: 'Couple stage changed',
    description: 'When a couple moves to a new stage',
    icon: 'ArrowRight',
  },
}

// ────────────────────────────────────────────────────────────────
// Quotes / invoices / payments
// ────────────────────────────────────────────────────────────────

/**
 * Config shape for {@link invoiceCreated}, declared as a schema first
 * so the spec's type parameter is `z.infer` of it rather than a
 * hand-written twin. The two drift under
 * `exactOptionalPropertyTypes` otherwise: Zod emits `?: T | undefined`
 * for an optional field and a hand-written `?: T` is not assignable
 * to it.
 */
const invoiceCreatedConfig = z.object({
  amountOp: z.enum(COMPARISON_OPS).optional(),
  amountValue: z.number().nonnegative().optional(),
  hasDiscount: z.boolean().optional(),
  hasDueDate: z.boolean().optional(),
  dueInDaysOp: z.enum(COMPARISON_OPS).optional(),
  dueInDaysValue: z.number().int().optional(),
  hasEventDate: z.boolean().optional(),
  dayOfWeek: z.enum(DAY_OF_WEEK_BUCKETS).optional(),
  // `''` is the inspector's "added but nothing chosen yet" value, and
  // MONTHS has no neutral member of its own the way DAY_OF_WEEK_BUCKETS
  // and SEASONS have `'any'`. The matcher reads it as no narrowing.
  eventMonth: z.union([z.enum(MONTHS), z.literal('')]).optional(),
  season: z.enum(SEASONS).optional(),
}).passthrough()

const invoiceCreated: TriggerSpec<z.infer<typeof invoiceCreatedConfig>> = {
  type: 'invoice_created',
  configSchema: invoiceCreatedConfig,
  match: invoiceDocMatch,
  ui: {
    category: 'payment',
    label: 'Invoice created',
    description: 'When an invoice is created as a draft',
    icon: 'FilePlus2',
  },
}

/**
 * Shared matcher for the invoice document triggers (`invoice_created`
 * and `invoice_sent`): both payloads carry the same fields after the
 * 20260813030000 enrichment, so they narrow identically.
 */
function invoiceDocMatch(
  event: AutomationEventRow,
  config: z.infer<typeof invoiceCreatedConfig>,
): boolean {
  const payload = p(event)
  // `total`, not `subtotal`: the filter compares the number the couple
  // is shown, net of discount and inclusive of tax. The emit site
  // computes it; `subtotal` stays in the payload for variables.
  if (!amountMatches(payload, 'total', config.amountOp, config.amountValue)) return false

  if (config.hasDiscount !== undefined) {
    const type = payload['discount_type']
    const value = payload['discount_value']
    // A discount row with a zero value is not a discount. Same test
    // the public totals block applies before rendering a discount line.
    const has = Boolean(type) && typeof value === 'number' && value > 0
    if (has !== config.hasDiscount) return false
  }

  const dueDate = payload['due_date'] ? String(payload['due_date']) : null
  if (config.hasDueDate !== undefined && config.hasDueDate !== Boolean(dueDate)) return false
  if (config.dueInDaysOp !== undefined && config.dueInDaysValue !== undefined) {
    if (!dueDate) return false
    if (!daysFromNowMatches(dueDate, config.dueInDaysOp, config.dueInDaysValue)) return false
  }

  return eventDateMatches(payload, config)
}

const invoiceSent: TriggerSpec<z.infer<typeof invoiceCreatedConfig>> = {
  type: 'invoice_sent',
  configSchema: invoiceCreatedConfig,
  match: invoiceDocMatch,
  ui: {
    category: 'payment',
    label: 'Invoice sent',
    description: 'When an invoice share link goes live',
    icon: 'Send',
  },
}

/**
 * Config for {@link paymentReceived}. Narrower than the invoice-doc
 * set: at payment time the due date and discount are history, so the
 * questions left are "how big" and "how close to the wedding".
 */
const paymentReceivedConfig = z.object({
  amountOp: z.enum(COMPARISON_OPS).optional(),
  amountValue: z.number().nonnegative().optional(),
  ...daysUntilEventShape,
  ...eventDateConfigShape,
}).passthrough()

const paymentReceived: TriggerSpec<z.infer<typeof paymentReceivedConfig>> = {
  type: 'payment_received',
  configSchema: paymentReceivedConfig,
  match(event, config) {
    const payload = p(event)
    if (!amountMatches(payload, 'total', config.amountOp, config.amountValue)) return false
    if (!daysUntilEventMatches(payload, config.daysUntilEventOp, config.daysUntilEventValue)) return false
    return eventDateMatches(payload, config)
  },
  ui: {
    category: 'payment',
    label: 'Payment received',
    description: 'When a couple makes a payment',
    icon: 'CreditCard',
  },
}

/**
 * Does this event's stage satisfy an `isFinalBalance` filter?
 *
 * The emitter stamps `stage_is_final` on the payload from the maximum position
 * among the invoice's stages. A stageless invoice has null stage fields but is
 * stamped `stage_is_final: true`, since its single implied payment is also its
 * final one.
 *
 * Why a stamped boolean rather than inferring from position and count: stage
 * positions are not guaranteed contiguous, so an invoice can hold positions
 * {1, 3} with a count of 2, and `position === count` then matches no stage at
 * all. The emitter is the only place that sees every row, so it is the only
 * place that can answer this correctly.
 */
function matchesFinalBalance(payload: Record<string, unknown>, isFinalBalance?: boolean): boolean {
  if (!isFinalBalance) return true
  const isFinal = payload.stage_is_final
  if (isFinal === undefined) return true
  return Boolean(isFinal)
}

/**
 * Config for {@link invoiceDue}. `days` is the trigger's required
 * parameter, not a filter: it names which lead-time event this
 * automation answers. The old `notificationCount` and
 * `respectQuietHours` fields are gone; nothing read the first, and
 * quiet hours are a property of `wait` steps, not triggers.
 */
const invoiceDueConfig = z.object({
  days: z.number().int().min(0).max(180).default(0),
  isFinalBalance: z.boolean().optional(),
}).passthrough()

const invoiceDue: TriggerSpec<z.infer<typeof invoiceDueConfig>> = {
  type: 'invoice_due',
  configSchema: invoiceDueConfig,
  // The `invoice_due` event is emitted by the time-emitter once per
  // (invoice, lead-time, day) — see `lib/automations/time-emitters/
  // invoice-due.ts`. The emitter stamps the matching lead-time in
  // `payload.days_until_due`; narrowing here means an automation with
  // `days=3` only fires for the 3-days-before event, not the `days=0`
  // event on the same invoice. Mirrors `quote_due`. `isFinalBalance`
  // is now enforced, narrowing to only the last stage when set.
  match: (event, config) => {
    const payload = p(event)
    const emitted = Number(payload.days_until_due)
    return (
      Number.isFinite(emitted) &&
      emitted === config.days &&
      matchesFinalBalance(payload, config.isFinalBalance)
    )
  },
  ui: { category: 'payment', label: 'Invoice due', description: 'When an invoice reaches its due date', icon: 'Hourglass' },
}

/**
 * Effective overdue threshold (days past `due_date`) for an
 * `invoice_overdue` automation config. "Overdue" means strictly past
 * the due date — a configured min of 0 is clamped up to 1 so the
 * trigger never collides with `invoice_due` (`days: 0`) on the due
 * date itself. Shared by the trigger's `match()` and the time-emitter
 * so both sides agree on which calendar day an invoice fires. Direct
 * sibling of {@link quoteOverdueThresholdDays}.
 */
export function invoiceOverdueThresholdDays(config: {
  daysOverdueMin?: number
}): number {
  return Math.max(1, config.daysOverdueMin ?? 1)
}

/**
 * Config for {@link invoiceOverdue}. `daysOverdueMax` is gone: the
 * matcher requires the emitted depth to equal the threshold exactly,
 * so a max either repeated the min or made the automation
 * unsatisfiable. `daysUntilEvent*` is gone too — the overdue payload
 * carries no event date to compare against.
 */
const invoiceOverdueConfig = z.object({
  daysOverdueMin: z.number().int().min(0).max(365).optional(),
  isFinalBalance: z.boolean().optional(),
}).passthrough()

const invoiceOverdue: TriggerSpec<z.infer<typeof invoiceOverdueConfig>> = {
  type: 'invoice_overdue',
  configSchema: invoiceOverdueConfig,
  // The `invoice_overdue` event is emitted by the time-emitter once
  // per (invoice, threshold, day) — see `lib/automations/
  // time-emitters/invoice-overdue.ts`. The emitter stamps the overdue
  // depth in `payload.days_overdue`; narrowing here means an
  // automation with min=7 only fires for the day-7 event, not the
  // day-1 one. Mirrors `quote_overdue`. `isFinalBalance` is now
  // enforced, narrowing to only the last stage when set. The
  // `daysUntilEvent*` filters are accepted but not yet enforced.
  match: (event, config) => {
    const payload = p(event)
    const emitted = Number(payload.days_overdue)
    if (!Number.isFinite(emitted)) return false
    const threshold = invoiceOverdueThresholdDays(config)
    if (emitted !== threshold) return false
    if (!matchesFinalBalance(payload, config.isFinalBalance)) return false
    return true
  },
  ui: { category: 'payment', label: 'Invoice overdue', description: 'When an invoice passes its due date without payment', icon: 'AlertTriangle' },
}

const paymentFailed: TriggerSpec<{
  failureReason?: string
  attemptNumber?: number
}> = {
  type: 'payment_failed',
  configSchema: z.object({
    failureReason: z.enum(PAYMENT_FAILURE_REASONS).optional(),
    attemptNumber: z.number().int().min(1).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'payment', label: 'Payment failed', description: 'When a Stripe charge fails', icon: 'AlertCircle' },
}

// ────────────────────────────────────────────────────────────────
// Contracts
// ────────────────────────────────────────────────────────────────

/**
 * Shared schema for the contract-lifecycle triggers: the wedding-date
 * family, joined into every contract payload from the couple.
 *
 * The Phase 14a scaffolding fields are gone. `templateUsed` and
 * `versionNumber` had no column behind them (`contracts` stores its
 * content inline, not a template reference), and `signerRole` assumed
 * a two-signer model the e-sign flow doesn't have — whoever opens the
 * link signs. `.passthrough()` keeps configs saved against them
 * parsing; they were never rendered or enforced.
 */
const contractFilterSchema = z.object({
  ...daysUntilEventShape,
  ...eventDateConfigShape,
}).passthrough()

type ContractFilterConfig = z.infer<typeof contractFilterSchema>

/** Shared matcher: every contract trigger narrows on the wedding date. */
function contractMatch(event: AutomationEventRow, config: ContractFilterConfig): boolean {
  const payload = p(event)
  if (!daysUntilEventMatches(payload, config.daysUntilEventOp, config.daysUntilEventValue)) return false
  return eventDateMatches(payload, config)
}

const contractCreated: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_created',
  configSchema: contractFilterSchema,
  match: contractMatch,
  ui: { category: 'contract', label: 'Contract created', description: 'When a contract is created as a draft', icon: 'FilePlus2' },
}

const contractSent: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_sent',
  configSchema: contractFilterSchema,
  match: contractMatch,
  ui: { category: 'contract', label: 'Contract sent', description: 'When a contract is emailed to the couple', icon: 'Send' },
}

const contractSigned: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_signed',
  configSchema: contractFilterSchema,
  match: contractMatch,
  ui: { category: 'contract', label: 'Contract signed', description: 'When a couple signs a contract', icon: 'FileSignature' },
}

const contractDeclined: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_declined',
  configSchema: contractFilterSchema,
  match: contractMatch,
  ui: { category: 'contract', label: 'Contract declined', description: 'When a couple declines a contract', icon: 'XCircle' },
}

const contractRevoked: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_revoked',
  configSchema: contractFilterSchema,
  match: contractMatch,
  ui: { category: 'contract', label: 'Contract revoked', description: 'When you revoke a sent contract', icon: 'Undo2' },
}

const contractExpired: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_expired',
  configSchema: contractFilterSchema,
  match: contractMatch,
  ui: { category: 'contract', label: 'Contract expired', description: 'When a contract passes its expiry without being signed', icon: 'CalendarX' },
}

const documentSigned: TriggerSpec<ContractFilterConfig> = {
  type: 'document_signed',
  configSchema: contractFilterSchema,
  match: contractMatch,
  ui: { category: 'contract', label: 'Document signed', description: 'Alias of contract signed', icon: 'PenTool' },
}

// ────────────────────────────────────────────────────────────────
// Events (couple-owned ceremony / rehearsal / reception rows)
// ────────────────────────────────────────────────────────────────

/**
 * Filters over an event row itself. The row's own `date` is
 * non-nullable, so the family here skips the has-a-date question the
 * couple triggers carry (`hasEventDate` in the shape is simply never
 * written by the event chip set).
 *
 * Deliberately absent, deleted in the trigger sweep:
 * - `eventType` — the app never writes it; every row holds the column
 *   default `'ceremony'`, so the filter could only match everything
 *   or nothing.
 * - `guestCount*`, `isDestination` — no columns back them.
 */
const eventFilter = z.object({
  ...daysUntilEventShape,
  ...eventDateConfigShape,
  hasVenue: z.boolean().optional(),
}).passthrough()

type EventFilterConfig = z.infer<typeof eventFilter>

function eventTriggerMatch(event: AutomationEventRow, config: EventFilterConfig): boolean {
  const payload = p(event)
  if (!daysUntilEventMatches(payload, config.daysUntilEventOp, config.daysUntilEventValue, 'date')) return false
  if (!eventDateMatches(payload, config, 'date')) return false
  if (config.hasVenue !== undefined) {
    const venue = typeof payload.venue === 'string' ? payload.venue.trim() : ''
    if (config.hasVenue !== (venue.length > 0)) return false
  }
  return true
}

const eventCreated: TriggerSpec<EventFilterConfig> = {
  type: 'event_created',
  configSchema: eventFilter,
  match: eventTriggerMatch,
  ui: {
    category: 'calendar',
    label: 'Event added',
    description: 'When a ceremony / rehearsal / reception is added to a couple',
    icon: 'CalendarPlus',
  },
}

const eventUpdated: TriggerSpec<EventFilterConfig & { changed?: string }> = {
  type: 'event_updated',
  configSchema: eventFilter.extend({
    changed: z.enum(EVENT_CHANGE_FIELDS).optional(),
  }),
  // `changed` narrows to date / venue moves — the two fields whose
  // previous value is in the payload. The legacy enum members
  // (guest_count etc.) parse but match everything, as they always did.
  match(event, config) {
    if (!eventTriggerMatch(event, config)) return false
    if (config.changed && config.changed !== 'any') {
      const payload = p(event)
      if (config.changed === 'date' && payload.prev_date === payload.date) return false
      if (config.changed === 'venue' && payload.prev_venue === payload.venue) return false
    }
    return true
  },
  ui: {
    category: 'calendar',
    label: 'Event updated',
    description: 'When an event date, venue, or details change',
    icon: 'CalendarCog',
  },
}

const eventDeleted: TriggerSpec<EventFilterConfig & { withinDaysOfEvent?: number }> = {
  type: 'event_deleted',
  configSchema: eventFilter.extend({
    withinDaysOfEvent: z.number().int().min(0).max(365).optional(),
  }),
  match: eventTriggerMatch,
  ui: {
    category: 'calendar',
    label: 'Event removed',
    description: 'When an event is deleted',
    icon: 'CalendarMinus',
  },
}

// ────────────────────────────────────────────────────────────────
// Calendar (tick-emitted, anchored to event_date)
// ────────────────────────────────────────────────────────────────

/**
 * Config for the tick-emitted day-offset triggers.
 *
 * `amount` is the trigger's required parameter (which lead/lag event
 * this automation answers); `unit` stays day-grain (locked
 * 2026-06-14 — the daily cron can't serve sub-day offsets) and is
 * kept in the schema because the emitter checks it. The wedding-date
 * family narrows on the event's own date. The seven Phase 14a
 * extras (time of day, public holidays, review / referral state,
 * pause and status checks) are gone — nothing read any of them, and
 * pause handling is the runner's job, not per-trigger config.
 */
const calendarConfig = z.object({
  // Defaulted so a config holding only an optional filter still
  // parses: the chip UI shows 7 before the MC edits it, and the
  // dispatcher must agree with what's on screen.
  amount: z.number().int().min(0).default(7),
  unit: z.enum(TIME_UNITS).default('days'),
  dayOfWeek: z.enum(DAY_OF_WEEK_BUCKETS).optional(),
  eventMonth: z.union([z.enum(MONTHS), z.literal('')]).optional(),
  season: z.enum(SEASONS).optional(),
}).passthrough()

type CalendarConfig = z.infer<typeof calendarConfig>

const timeBeforeEvent: TriggerSpec<CalendarConfig> = {
  type: 'time_before_event',
  configSchema: calendarConfig,
  // Narrow to this automation's configured lead-time + event type. The
  // emitter publishes one event per (event, days-before, calendar day)
  // carrying `days_before` + `event_type`; without this every
  // time_before_event automation would fire for every emitted event.
  match: (event, config) => {
    const payload = p(event)
    const emitted = Number(payload.days_before)
    if (!Number.isFinite(emitted) || emitted !== config.amount) return false
    return eventDateMatches(payload, config, 'date')
  },
  ui: {
    category: 'calendar',
    label: 'Days before event',
    description: 'A reminder a set number of days before the event (or rehearsal) date',
    icon: 'CalendarClock',
  },
}

const timeAfterEvent: TriggerSpec<CalendarConfig> = {
  type: 'time_after_event',
  configSchema: calendarConfig,
  // Mirror of time_before_event on the post-event side: narrow by the
  // configured lag (`days_after`) + optional event type.
  match: (event, config) => {
    const payload = p(event)
    const emitted = Number(payload.days_after)
    if (!Number.isFinite(emitted) || emitted !== config.amount) return false
    return eventDateMatches(payload, config, 'date')
  },
  ui: {
    category: 'calendar',
    label: 'Days after event',
    description: 'A reminder a set number of days after the event (or rehearsal) date',
    icon: 'CalendarCheck',
  },
}

const specificDateReached: TriggerSpec<{
  date: string
  repeatYearly?: boolean
  audienceStatus?: string
  eventDateWithinMonths?: number
}> = {
  type: 'specific_date_reached',
  configSchema: z.object({
    date: z.string(),
    repeatYearly: z.boolean().optional(),
    audienceStatus: z.string().optional(),
    eventDateWithinMonths: z.number().int().min(1).max(36).optional(),
  }).passthrough(),
  match: () => true,
  ui: {
    category: 'calendar',
    label: 'Specific date reached',
    description: 'A fixed calendar date (optionally repeating yearly)',
    icon: 'Calendar',
  },
}

const anniversaryOfEvent: TriggerSpec<{
  years: number
  maxYears?: number | undefined
}> = {
  type: 'anniversary_of_event',
  configSchema: z.object({
    years: z.number().int().min(1).max(50).default(1),
    maxYears: z.number().int().min(1).max(50).optional(),
  }).passthrough(),
  // The emitter publishes one event per (event, years-since) on the
  // anniversary day; narrow to this automation's year (or year..maxYears
  // range). The `onlyIf*` fields are deleted — no data ever backed them.
  match: (event, config) => {
    const payload = p(event)
    const yearsSince = Number(payload.years_since)
    if (!Number.isFinite(yearsSince)) return false
    if (config.maxYears !== undefined) {
      return yearsSince >= config.years && yearsSince <= config.maxYears
    }
    return yearsSince === config.years
  },
  ui: {
    category: 'calendar',
    label: 'Anniversary of event',
    description: 'N years after the event (optionally repeating each year up to a cap)',
    icon: 'Sparkles',
  },
}

// ────────────────────────────────────────────────────────────────
// Client portal
// ────────────────────────────────────────────────────────────────

/**
 * Config for {@link sectionCompleted}. Only `section` remains: the
 * emitters fire on people / songs / files inserts and stamp which one,
 * so that is the whole narrowing the data supports. The old
 * `category`, duration and days-of-event fields had nothing behind
 * them (`category` meant different things per section and the portal
 * records no completion timing).
 */
/**
 * Config for {@link sectionCompleted}.
 *
 * `section` picks which portal list the item landed in; the rest are
 * the sub-filters that used to justify a whole separate trigger each.
 * They are scoped to one section by the chip UI (`personType` only
 * offers itself when section is People, and so on) and by the matcher
 * below, which reads each against the payload key that section stamps.
 */
const sectionCompletedConfig = z.object({
  // `''` is the chip's "added but nothing chosen yet" value, same
  // convention as eventMonth. The matcher reads it as no narrowing.
  section: z.union([z.enum(PORTAL_SECTIONS), z.literal('')]).optional(),
  /** People: partner / bridal_party / family. */
  personType: z.string().optional(),
  /** Songs: the portal slot key (first_dance, avoid, …). */
  songCategory: z.string().optional(),
  /** Files: size in bytes, compared against `file_size`. */
  sizeBytesOp: z.enum(COMPARISON_OPS).optional(),
  sizeBytesValue: z.number().int().min(0).optional(),
}).passthrough()

/**
 * Fires once per item the couple adds to their portal — a person, a
 * song, a file.
 *
 * The type string is still `section_completed` (renaming it would
 * orphan every saved automation), but the label is not: the emitters
 * are AFTER INSERT triggers on `portal_people` / `portal_songs` /
 * `portal_files`, so a couple filling seven song slots fires this
 * seven times. It never meant "completed", and "Portal section
 * completed" promised an MC something it could not deliver — an
 * automation reading the old label would have emailed them per song.
 *
 * It is now the only portal-item trigger in the picker.
 * `couple_uploaded_file` and `couple_added_song_to_playlist` fired on
 * these same two inserts and existed only to carry a sub-filter this
 * one lacked — so adding a file lit up two triggers and emitted two
 * events. Those sub-filters moved here; the two specs stay in the
 * registry (and keep their emitters) so saved automations still fire,
 * but they are gone from the picker.
 */
const sectionCompleted: TriggerSpec<z.infer<typeof sectionCompletedConfig>> = {
  type: 'section_completed',
  configSchema: sectionCompletedConfig,
  // Each sub-filter is scoped to the section that owns it, and is
  // ignored otherwise. Switching the section chip hides the old
  // section's sub-filter but leaves its keys in the saved config;
  // enforcing a leftover file-size rule against a songs event — which
  // carries no `file_size` — would fail every time and leave the MC
  // with an automation that never runs and nothing on screen to
  // explain why. It also matters that people and songs both stamp
  // `category`: unscoped, a song-slot filter would read a person's
  // type as a match.
  match(event, config) {
    const payload = p(event)
    if (config.section && payload.section !== config.section) return false

    switch (config.section) {
      case 'people':
        return !config.personType || payload.category === config.personType
      case 'songs':
        return !config.songCategory || payload.category === config.songCategory
      case 'files':
        return amountMatches(payload, 'file_size', config.sizeBytesOp, config.sizeBytesValue)
      default:
        // No section chosen: the sub-filters are unreachable in the UI,
        // so anything present is leftover and does not narrow.
        return true
    }
  },
  ui: {
    category: 'portal',
    label: 'Portal item added',
    description: 'When the couple adds a person, song or file to their portal',
    icon: 'FilePlus2',
  },
}

const portalSectionStartedNotFinished: TriggerSpec<{
  section?: string
  days: number
  percentCompleteRange?: string
  lastActivityWithinDays?: number
}> = {
  type: 'portal_section_started_not_finished',
  configSchema: z.object({
    section: z.enum(PORTAL_SECTIONS).optional(),
    days: z.number().int().min(1).max(60).default(7),
    percentCompleteRange: z.enum(PORTAL_COMPLETION_RANGES).optional(),
    lastActivityWithinDays: z.number().int().min(1).max(60).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'portal', label: 'Portal section started but not finished', description: 'Abandonment recovery', icon: 'CornerDownLeft' },
}

/**
 * Config for {@link timelineEdited}. The DB trigger stamps `op`
 * (INSERT vs UPDATE) on each emitted row, which backs an added /
 * changed distinction. The old `editedBy` and item-count fields are
 * gone: the trigger cannot see who made the edit, and it fires per
 * row, so there is no batch to count.
 */
const timelineEditedConfig = z.object({
  change: z.enum(['any', 'added', 'changed']).optional(),
}).passthrough()

const timelineEdited: TriggerSpec<z.infer<typeof timelineEditedConfig>> = {
  type: 'timeline_edited',
  configSchema: timelineEditedConfig,
  match(event, config) {
    if (!config.change || config.change === 'any') return true
    const op = p(event).op
    return config.change === 'added' ? op === 'INSERT' : op === 'UPDATE'
  },
  ui: {
    category: 'portal',
    label: 'Timeline edited',
    description: 'When the timeline is added to or changed',
    icon: 'Clock',
  },
}

// ────────────────────────────────────────────────────────────────
// Task
// ────────────────────────────────────────────────────────────────

/**
 * Shared shape for the task triggers. Priority and type are the MC's
 * own `task_priorities` / `task_types` option names — free strings,
 * because the lists are user-editable and a saved config must keep
 * parsing after a rename (it simply stops matching). The old
 * `taskCategory` enum (admin / ceremony / …) and hardcoded
 * low–urgent priority list matched nothing the app writes.
 */
const taskFilterSchema = z.object({
  taskPriority: z.string().optional(),
  taskType: z.string().optional(),
}).passthrough()

type TaskFilterConfig = z.infer<typeof taskFilterSchema>

/** Priority / type narrowing shared by all three task triggers. */
function taskOptionsMatch(payload: Record<string, unknown>, config: TaskFilterConfig): boolean {
  if (config.taskPriority && payload.priority !== config.taskPriority) return false
  if (config.taskType && payload.task_type !== config.taskType) return false
  return true
}

const taskCreatedConfig = taskFilterSchema.extend({
  hasDueDate: z.boolean().optional(),
  dueInDaysOp: z.enum(COMPARISON_OPS).optional(),
  dueInDaysValue: z.number().int().optional(),
})

const taskCreated: TriggerSpec<z.infer<typeof taskCreatedConfig>> = {
  type: 'task_created',
  configSchema: taskCreatedConfig,
  match(event, config) {
    const payload = p(event)
    if (!taskOptionsMatch(payload, config)) return false
    const dueDate = payload['due_date'] ? String(payload['due_date']) : null
    if (config.hasDueDate !== undefined && config.hasDueDate !== Boolean(dueDate)) return false
    if (config.dueInDaysOp !== undefined && config.dueInDaysValue !== undefined) {
      if (!dueDate) return false
      if (!daysFromNowMatches(dueDate, config.dueInDaysOp, config.dueInDaysValue)) return false
    }
    return true
  },
  ui: {
    category: 'task',
    label: 'Task created',
    description: 'When a task is added',
    icon: 'ListPlus',
  },
}

const taskCompleted: TriggerSpec<TaskFilterConfig> = {
  type: 'task_completed',
  configSchema: taskFilterSchema,
  match: (event, config) => taskOptionsMatch(p(event), config),
  ui: {
    category: 'task',
    label: 'Task completed',
    description: 'When a task is marked done',
    icon: 'ListChecks',
  },
}

/**
 * Effective overdue threshold (days past `due_date`) for a
 * `task_overdue` automation config. "Overdue" means strictly past the
 * due date — a configured min of 0 is clamped up to 1 so a task only
 * fires once it is genuinely late (the due date itself is not yet
 * overdue: `due_date < today`). Shared by the trigger's `match()` and
 * the time-emitter so both sides agree on which calendar day a task
 * fires. Direct sibling of {@link quoteOverdueThresholdDays} /
 * {@link invoiceOverdueThresholdDays}.
 */
export function taskOverdueThresholdDays(config: {
  daysOverdueMin?: number
}): number {
  return Math.max(1, config.daysOverdueMin ?? 1)
}

const taskOverdue: TriggerSpec<TaskFilterConfig & {
  daysOverdueMin?: number | undefined
}> = {
  type: 'task_overdue',
  configSchema: taskFilterSchema.extend({
    daysOverdueMin: z.number().int().min(0).max(365).optional(),
  }),
  // The `task_overdue` event is emitted by the time-emitter once per
  // (task, threshold, day) — see `lib/automations/time-emitters/
  // task-overdue.ts`. The emitter stamps the overdue depth in
  // `payload.days_overdue`; narrowing here means an automation with
  // min=7 only fires for the day-7 event, not the day-1 one. Priority
  // and type narrow against the payload (the emitter carries both).
  // `assignedTo` is deleted — there is no assignee column — and
  // `daysOverdueMax` with an exact-depth match was either redundant
  // or unsatisfiable.
  match: (event, config) => {
    const payload = p(event)
    const emitted = Number(payload.days_overdue)
    if (!Number.isFinite(emitted)) return false
    const threshold = taskOverdueThresholdDays(config)
    if (emitted !== threshold) return false
    return taskOptionsMatch(payload, config)
  },
  ui: {
    category: 'task',
    label: 'Task overdue',
    description: 'When a task passes its due date without completion',
    icon: 'ListX',
  },
}

// ────────────────────────────────────────────────────────────────
// Contacts (vendors / family / bridal party / other people)
// ────────────────────────────────────────────────────────────────

/**
 * Filters over a contact row. `category` matches the fixed vendor
 * list the contact modal writes (`''` is the chip's nothing-chosen
 * value). `isPrimaryVendorForCouple` and `region` are deleted — no
 * columns back them.
 */
const contactFilter = z.object({
  category: z.union([z.enum(CONTACT_CATEGORIES), z.literal('')]).optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
}).passthrough()

type ContactFilterConfig = z.infer<typeof contactFilter>

function contactTriggerMatch(event: AutomationEventRow, config: ContactFilterConfig): boolean {
  const payload = p(event)
  if (config.category && payload.category !== config.category) return false
  if (config.hasEmail !== undefined && config.hasEmail !== Boolean(payload.email)) return false
  if (config.hasPhone !== undefined && config.hasPhone !== Boolean(payload.phone)) return false
  return true
}

/**
 * The linked payload carries only category + name (it comes off the
 * join row, not the contact), so the linked trigger narrows on
 * category alone.
 */
const contactLinkedConfig = z.object({
  category: z.union([z.enum(CONTACT_CATEGORIES), z.literal('')]).optional(),
}).passthrough()

const contactCreated: TriggerSpec<ContactFilterConfig> = {
  type: 'contact_created',
  configSchema: contactFilter,
  match: contactTriggerMatch,
  ui: {
    category: 'contact',
    label: 'Contact added',
    description: 'When a vendor, family member or supplier is added',
    icon: 'UserPlus',
  },
}

const contactUpdated: TriggerSpec<ContactFilterConfig> = {
  type: 'contact_updated',
  configSchema: contactFilter,
  match: contactTriggerMatch,
  ui: {
    category: 'contact',
    label: 'Contact updated',
    description: 'When a contact’s details change',
    icon: 'UserCog',
  },
}

const contactLinkedToCouple: TriggerSpec<z.infer<typeof contactLinkedConfig>> = {
  type: 'contact_linked_to_couple',
  configSchema: contactLinkedConfig,
  match(event, config) {
    if (!config.category) return true
    return p(event).category === config.category
  },
  ui: {
    category: 'contact',
    label: 'Contact linked to a couple',
    description: 'When a contact is attached to a couple (e.g. their photographer)',
    icon: 'Link2',
  },
}

// ────────────────────────────────────────────────────────────────
// Manual
// ────────────────────────────────────────────────────────────────

const manualFire: TriggerSpec<{
  requireConfirmation?: boolean
  requireNote?: boolean
}> = {
  type: 'manual_fire',
  configSchema: z.object({
    requireConfirmation: z.boolean().optional(),
    requireNote: z.boolean().optional(),
  }).passthrough(),
  match(event, _config) {
    // Manual fires carry the target automation id in the payload -
    // the dispatcher reads that directly. This matcher exists to
    // make the type uniform; the dispatcher short-circuits before
    // calling it.
    return Boolean(p(event).automation_id)
  },
  ui: { category: 'manual', label: 'Run manually', description: 'Fire this automation for a specific couple from the UI', icon: 'Play' },
}

// ────────────────────────────────────────────────────────────────
// Phase 14a UI-only trigger scaffolding
//
// Every spec below has `match: () => true` because no DB trigger or
// tick currently emits these event types. They appear in the picker
// + inspector so MCs can shape automations against them today; the
// emit sites will be wired in a later phase.
// ────────────────────────────────────────────────────────────────

const consultationSchema = z.object({
  meetingType: z.enum(CONSULTATION_TYPES).optional(),
  location: z.enum(CONSULTATION_LOCATIONS).optional(),
  daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
  daysUntilEventValue: z.number().int().optional(),
}).passthrough()

type ConsultationConfig = z.infer<typeof consultationSchema>

const consultationBooked: TriggerSpec<ConsultationConfig & {
  dateWithinDays?: number
}> = {
  type: 'consultation_booked',
  configSchema: consultationSchema.extend({
    dateWithinDays: z.number().int().min(1).max(365).optional(),
  }),
  match: () => true,
  ui: { category: 'consultation', label: 'Consultation booked', description: 'When a discovery / planning meeting is scheduled', icon: 'CalendarHeart' },
}

const consultationCompleted: TriggerSpec<ConsultationConfig & {
  outcome?: string
}> = {
  type: 'consultation_completed',
  configSchema: consultationSchema.extend({
    outcome: z.enum(CONSULTATION_OUTCOMES).optional(),
  }),
  match: () => true,
  ui: { category: 'consultation', label: 'Consultation completed', description: 'When a meeting wraps up — branch on outcome', icon: 'CalendarCheck' },
}

const consultationNoShow: TriggerSpec<ConsultationConfig> = {
  type: 'consultation_no_show',
  configSchema: consultationSchema,
  match: () => true,
  ui: { category: 'consultation', label: 'Consultation no-show', description: 'When the couple misses the meeting', icon: 'CalendarOff' },
}

/**
 * Config for the `booking_cancelled` trigger.
 *
 * Optional filter: match only cancellations made within N days of the booking's start time.
 */
interface BookingCancelledConfig {
  withinDaysOfStart?: number | undefined
}

const bookingCancelled: TriggerSpec<BookingCancelledConfig> = {
  type: 'booking_cancelled',
  configSchema: z.object({
    withinDaysOfStart: z.number().int().min(1).max(365).optional(),
  }),
  match: (event, config) => {
    // No filter configured: match all.
    if (config.withinDaysOfStart === undefined) return true

    const payload = p(event)
    const startsAtRaw = payload.starts_at
    if (typeof startsAtRaw !== 'string') return false

    // Parse both timestamps.
    const startsAt = new Date(startsAtRaw)
    const cancelledAt = new Date(event.created_at)

    if (isNaN(startsAt.getTime()) || isNaN(cancelledAt.getTime())) return false

    // Calculate days between cancellation and event start.
    // Floor the result to get the number of complete days.
    const msPerDay = 24 * 60 * 60 * 1000
    const daysBetween = Math.floor((startsAt.getTime() - cancelledAt.getTime()) / msPerDay)

    // Match when the cancellation occurred within the configured window before the event.
    return daysBetween >= 0 && daysBetween <= config.withinDaysOfStart
  },
  ui: { category: 'consultation', label: 'Booking cancelled', description: 'When a consultation booking is cancelled. Optionally filter by how close the cancellation was to the booking', icon: 'CalendarX' },
}

// ── AU paperwork milestones ────────────────────────────────────

const noimLodged: TriggerSpec<{
  daysBeforeEventOp?: ComparisonOp
  daysBeforeEventValue?: number
}> = {
  type: 'noim_lodged',
  configSchema: z.object({
    daysBeforeEventOp: z.enum(COMPARISON_OPS).optional(),
    daysBeforeEventValue: z.number().int().min(0).max(540).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'compliance', label: 'NOIM lodged', description: 'Notice of Intended Marriage paperwork has been filed', icon: 'FileCheck' },
}

const noimOverdue: TriggerSpec<{
  daysOverdueOp?: ComparisonOp
  daysOverdueValue?: number
}> = {
  type: 'noim_overdue',
  configSchema: z.object({
    daysOverdueOp: z.enum(COMPARISON_OPS).optional(),
    daysOverdueValue: z.number().int().min(0).max(540).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'compliance', label: 'NOIM overdue', description: 'NOIM not lodged within the 1-month statutory window', icon: 'AlertOctagon' },
}

const donlimDue: TriggerSpec<{
  daysBeforeEvent?: number
}> = {
  type: 'donlim_due',
  configSchema: z.object({
    daysBeforeEvent: z.number().int().min(0).max(30).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'compliance', label: 'DONLIM due', description: 'Declaration of No Legal Impediment needs signing', icon: 'FileText' },
}

const donlimSigned: TriggerSpec<Record<string, unknown>> = {
  type: 'donlim_signed',
  configSchema: empty,
  match: () => true,
  ui: { category: 'compliance', label: 'DONLIM signed', description: 'Declaration signed — ceremony paperwork is clean', icon: 'FileSignature' },
}

const marriageCertificateIssued: TriggerSpec<Record<string, unknown>> = {
  type: 'marriage_certificate_issued',
  configSchema: empty,
  match: () => true,
  ui: { category: 'compliance', label: 'Marriage certificate issued', description: 'Triggers post-event BDM admin', icon: 'Award' },
}

const rehearsalScheduled: TriggerSpec<{
  daysBeforeEventOp?: ComparisonOp
  daysBeforeEventValue?: number
}> = {
  type: 'rehearsal_scheduled',
  configSchema: z.object({
    daysBeforeEventOp: z.enum(COMPARISON_OPS).optional(),
    daysBeforeEventValue: z.number().int().min(0).max(180).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'consultation', label: 'Rehearsal scheduled', description: 'When the rehearsal is added to the calendar', icon: 'Drama' },
}

const rehearsalCompleted: TriggerSpec<Record<string, unknown>> = {
  type: 'rehearsal_completed',
  configSchema: empty,
  match: () => true,
  ui: { category: 'consultation', label: 'Rehearsal completed', description: 'Triggers final-week pack send', icon: 'Sparkles' },
}

// ── Engagement (inbound) ───────────────────────────────────────

const engagementBase = z.object({
  withinHoursOp: z.enum(COMPARISON_OPS).optional(),
  withinHoursValue: z.number().int().min(0).optional(),
  templateMatched: z.string().optional(),
  linkType: z.string().optional(),
}).passthrough()

const coupleRepliedToEmail: TriggerSpec<z.infer<typeof engagementBase>> = {
  type: 'couple_replied_to_email',
  configSchema: engagementBase,
  match: () => true,
  ui: { category: 'engagement', label: 'Couple replied to email', description: 'Engagement-aware sequences — stop chasing on reply', icon: 'MailCheck' },
}

const coupleDidNotReply: TriggerSpec<{
  daysSinceSent?: number
  templateMatched?: string
}> = {
  type: 'couple_did_not_reply',
  configSchema: z.object({
    daysSinceSent: z.number().int().min(1).max(60).optional(),
    templateMatched: z.string().optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'engagement', label: 'Couple did not reply', description: 'Targeted follow-up after silence', icon: 'MailX' },
}

const coupleOpenedEmail: TriggerSpec<z.infer<typeof engagementBase>> = {
  type: 'couple_opened_email',
  configSchema: engagementBase,
  match: () => true,
  ui: { category: 'engagement', label: 'Couple opened email', description: 'Couple opened a tracked email', icon: 'MailOpen' },
}

const coupleClickedLink: TriggerSpec<z.infer<typeof engagementBase>> = {
  type: 'couple_clicked_link',
  configSchema: engagementBase,
  match: () => true,
  ui: { category: 'engagement', label: 'Couple clicked link', description: 'Couple clicked a tracked link inside an email', icon: 'MousePointerClick' },
}

const coupleEmailBounced: TriggerSpec<{ kind?: string }> = {
  type: 'couple_email_bounced',
  configSchema: z.object({ kind: z.enum(EMAIL_ENGAGEMENT_KINDS).optional() }).passthrough(),
  match: () => true,
  ui: { category: 'engagement', label: 'Couple email bounced', description: 'Outbound email returned a hard or soft bounce', icon: 'MailWarning' },
}

const coupleUnsubscribed: TriggerSpec<Record<string, unknown>> = {
  type: 'couple_unsubscribed',
  configSchema: empty,
  match: () => true,
  ui: { category: 'engagement', label: 'Couple unsubscribed', description: 'Triggers do-not-contact + audit logging', icon: 'BellOff' },
}

// ── Contact relationships ──────────────────────────────────────

const vendorContactAssigned: TriggerSpec<{
  category?: string
  forEventType?: string
}> = {
  type: 'vendor_contact_assigned',
  configSchema: z.object({
    category: z.enum(CONTACT_CATEGORIES).optional(),
    forEventType: z.enum(EVENT_TYPES).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'contact', label: 'Vendor contact assigned', description: 'When a vendor (e.g. photographer) is linked to a couple', icon: 'Link2' },
}

// ── Portal interactions ────────────────────────────────────────

/**
 * Config for {@link coupleUploadedFile}. Size is the one field the
 * payload backs (`portal_files` stores no type or section column, so
 * those filters are gone). The UI takes megabytes and writes bytes.
 */
const coupleUploadedFileConfig = z.object({
  sizeBytesOp: z.enum(COMPARISON_OPS).optional(),
  sizeBytesValue: z.number().int().min(0).optional(),
}).passthrough()

const coupleUploadedFile: TriggerSpec<z.infer<typeof coupleUploadedFileConfig>> = {
  type: 'couple_uploaded_file',
  configSchema: coupleUploadedFileConfig,
  match(event, config) {
    return amountMatches(p(event), 'file_size', config.sizeBytesOp, config.sizeBytesValue)
  },
  ui: { category: 'portal', label: 'Couple uploaded a file', description: 'Couple added a file to the portal', icon: 'Upload' },
}

/**
 * Config for {@link coupleAddedSongToPlaylist}. `category` matches the
 * payload's portal slot key (entry_partner1 … avoid). A free string,
 * not an enum: MCs can define per-couple custom categories, and a
 * saved config must keep parsing whatever key it was saved with. The
 * old `playlistKey` values (entrance, exit…) never matched anything —
 * they were invented names, not the portal's real slot keys.
 */
const coupleAddedSongConfig = z.object({
  category: z.string().optional(),
}).passthrough()

const coupleAddedSongToPlaylist: TriggerSpec<z.infer<typeof coupleAddedSongConfig>> = {
  type: 'couple_added_song_to_playlist',
  configSchema: coupleAddedSongConfig,
  match(event, config) {
    if (!config.category) return true
    return p(event).category === config.category
  },
  ui: { category: 'portal', label: 'Song added to playlist', description: 'Couple added a song — useful for DJ coordination', icon: 'Music' },
}

const coupleCompletedVows: TriggerSpec<{
  who?: 'primary' | 'spouse' | 'both'
}> = {
  type: 'couple_completed_vows',
  configSchema: z.object({
    who: z.enum(['primary', 'spouse', 'both']).optional(),
  }).passthrough(),
  // The DB trigger emits per submitted vow with `payload.who`
  // ('primary' | 'spouse'). `both` fires on each submission (true
  // "both submitted" needs cross-row state the matcher can't see).
  match: (event, config) => {
    if (!config.who || config.who === 'both') return true
    return p(event).who === config.who
  },
  ui: { category: 'portal', label: 'Couple completed vows', description: 'Vow drafts submitted by one or both partners', icon: 'Heart' },
}

const questionnaireCompleted: TriggerSpec<{
  questionnaireTemplateId?: string | undefined
}> = {
  type: 'questionnaire_completed',
  configSchema: z.object({
    /** Optional narrowing to questionnaires sent from one template.
     * `''` is the chip's "added but nothing chosen yet" value. */
    questionnaireTemplateId: z.union([z.uuid(), z.literal('')]).optional(),
  }).passthrough(),
  // The DB trigger on couple_questionnaires emits on the status flip to
  // 'completed' with the snapshot's template_id in the payload (null when the
  // source template was deleted — those match only the "any" config).
  match: (event, config) => {
    if (!config.questionnaireTemplateId) return true
    return p(event).template_id === config.questionnaireTemplateId
  },
  ui: { category: 'portal', label: 'Questionnaire completed', description: 'A couple submitted their questionnaire answers', icon: 'ClipboardList' },
}

// ── Subscription / billing (MC's own plan) ─────────────────────

const subscriptionStatusChanged: TriggerSpec<{
  fromStatus?: string
  toStatus?: string
}> = {
  type: 'subscription_status_changed',
  configSchema: z.object({
    fromStatus: z.string().optional(),
    toStatus: z.string().optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'billing', label: 'Subscription status changed', description: 'Your own plan changed (trial→active, active→past_due, …)', icon: 'CreditCard' },
}

const subscriptionTrialEnding: TriggerSpec<{
  daysRemaining?: number
}> = {
  type: 'subscription_trial_ending',
  configSchema: z.object({
    daysRemaining: z.number().int().min(0).max(60).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'billing', label: 'Trial ending', description: 'Drives the MC-side onboarding nudge flow', icon: 'Clock4' },
}

const teamMemberAdded: TriggerSpec<{
  role?: string
}> = {
  type: 'team_member_added',
  configSchema: z.object({
    role: z.string().optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'billing', label: 'Team member added', description: 'When a teammate / assistant is invited', icon: 'UserPlus2' },
}

// ── Meta / self-healing ────────────────────────────────────────

const automationFailed: TriggerSpec<{
  automationId?: string
  failureCategory?: string
}> = {
  type: 'automation_failed',
  configSchema: z.object({
    automationId: z.string().uuid().optional(),
    failureCategory: z.string().optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'meta', label: 'Another automation failed', description: 'Self-healing — fire when a different automation errors', icon: 'AlertTriangle' },
}

// ── Inbound integrations ───────────────────────────────────────

const webhookReceived: TriggerSpec<{
  source?: string
  payloadSchema?: string
}> = {
  type: 'webhook_received',
  configSchema: z.object({
    source: z.enum(WEBHOOK_SOURCES).optional(),
    payloadSchema: z.string().optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'integration', label: 'Webhook received', description: 'Inbound payload from Calendly / Typeform / Zapier / website', icon: 'Webhook' },
}

// ── Tagging ────────────────────────────────────────────────────

const tagAddedToCouple: TriggerSpec<{ tag?: string }> = {
  type: 'tag_added_to_couple',
  configSchema: z.object({ tag: z.string().optional() }).passthrough(),
  match: () => true,
  ui: { category: 'pipeline', label: 'Tag added to couple', description: 'When a tag is attached to a couple', icon: 'Tag' },
}

const tagRemovedFromCouple: TriggerSpec<{ tag?: string }> = {
  type: 'tag_removed_from_couple',
  configSchema: z.object({ tag: z.string().optional() }).passthrough(),
  match: () => true,
  ui: { category: 'pipeline', label: 'Tag removed from couple', description: 'When a tag is detached', icon: 'TagOff' },
}

// ── Birthday + payment plan ────────────────────────────────────

const coupleBirthday: TriggerSpec<{
  daysBefore?: number
  who?: 'primary' | 'spouse' | 'either'
}> = {
  type: 'couple_birthday',
  configSchema: z.object({
    daysBefore: z.number().int().min(0).max(60).optional(),
    who: z.enum(['primary', 'spouse', 'either']).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'calendar', label: 'Couple birthday', description: 'Personal-touch acknowledgement', icon: 'Cake' },
}

const paymentPlanMilestoneReached: TriggerSpec<{
  installmentNumber?: number
  percentPaidOp?: ComparisonOp
  percentPaidValue?: number
}> = {
  type: 'payment_plan_milestone_reached',
  configSchema: z.object({
    installmentNumber: z.number().int().min(1).optional(),
    percentPaidOp: z.enum(COMPARISON_OPS).optional(),
    percentPaidValue: z.number().int().min(0).max(100).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'payment', label: 'Payment plan milestone reached', description: 'Installment hit (e.g. 50% paid unlocks a portal section)', icon: 'Milestone' },
}

const refundIssued: TriggerSpec<{
  amountOp?: ComparisonOp
  amountValue?: number
  reason?: string
}> = {
  type: 'refund_issued',
  configSchema: z.object({
    amountOp: z.enum(COMPARISON_OPS).optional(),
    amountValue: z.number().nonnegative().optional(),
    reason: z.string().optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'payment', label: 'Refund issued', description: 'Triggers cancellation paperwork + status update', icon: 'Undo2' },
}

// ── Privacy / onboarding ───────────────────────────────────────

const coupleSetDoNotContact: TriggerSpec<Record<string, unknown>> = {
  type: 'couple_set_do_not_contact',
  configSchema: empty,
  match: () => true,
  ui: { category: 'engagement', label: 'Couple set do-not-contact', description: 'Compliance hook — pause all outbound comms', icon: 'ShieldOff' },
}

const brandingPublished: TriggerSpec<Record<string, unknown>> = {
  type: 'branding_published',
  configSchema: empty,
  match: () => true,
  ui: { category: 'meta', label: 'Branding published', description: 'You just published your branding — share portal link nudge', icon: 'Palette' },
}

// ────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────

export const triggerRegistry: Record<TriggerType, TriggerSpec<any>> = {
  // Lead
  new_enquiry: newEnquiry,
  lead_inactive: leadInactive,
  custom_field_changed: customFieldChanged,
  // Pipeline
  couple_stage_changed: coupleStageChanged,
  // Quotes / invoices / payments
  // Invoices / payments
  invoice_created: invoiceCreated,
  invoice_sent: invoiceSent,
  payment_received: paymentReceived,
  invoice_due: invoiceDue,
  invoice_overdue: invoiceOverdue,
  payment_failed: paymentFailed,
  // Contracts
  contract_created: contractCreated,
  contract_sent: contractSent,
  contract_signed: contractSigned,
  contract_declined: contractDeclined,
  contract_revoked: contractRevoked,
  contract_expired: contractExpired,
  document_signed: documentSigned,
  // Events
  event_created: eventCreated,
  event_updated: eventUpdated,
  event_deleted: eventDeleted,
  // Calendar
  time_before_event: timeBeforeEvent,
  time_after_event: timeAfterEvent,
  specific_date_reached: specificDateReached,
  anniversary_of_event: anniversaryOfEvent,
  // Portal
  section_completed: sectionCompleted,
  portal_section_started_not_finished: portalSectionStartedNotFinished,
  timeline_edited: timelineEdited,
  // Task
  task_created: taskCreated,
  task_completed: taskCompleted,
  task_overdue: taskOverdue,
  // Contacts
  contact_created: contactCreated,
  contact_updated: contactUpdated,
  contact_linked_to_couple: contactLinkedToCouple,
  vendor_contact_assigned: vendorContactAssigned,
  // Manual
  manual_fire: manualFire,
  // Consultations
  consultation_booked: consultationBooked,
  consultation_completed: consultationCompleted,
  consultation_no_show: consultationNoShow,
  booking_cancelled: bookingCancelled,
  rehearsal_scheduled: rehearsalScheduled,
  rehearsal_completed: rehearsalCompleted,
  // Compliance
  noim_lodged: noimLodged,
  noim_overdue: noimOverdue,
  donlim_due: donlimDue,
  donlim_signed: donlimSigned,
  marriage_certificate_issued: marriageCertificateIssued,
  // Engagement
  couple_replied_to_email: coupleRepliedToEmail,
  couple_did_not_reply: coupleDidNotReply,
  couple_opened_email: coupleOpenedEmail,
  couple_clicked_link: coupleClickedLink,
  couple_email_bounced: coupleEmailBounced,
  couple_unsubscribed: coupleUnsubscribed,
  couple_set_do_not_contact: coupleSetDoNotContact,
  // Portal interactions (extra)
  couple_uploaded_file: coupleUploadedFile,
  couple_added_song_to_playlist: coupleAddedSongToPlaylist,
  couple_completed_vows: coupleCompletedVows,
  questionnaire_completed: questionnaireCompleted,
  // Billing meta
  subscription_status_changed: subscriptionStatusChanged,
  subscription_trial_ending: subscriptionTrialEnding,
  team_member_added: teamMemberAdded,
  // Self-healing meta
  automation_failed: automationFailed,
  branding_published: brandingPublished,
  // Inbound integrations
  webhook_received: webhookReceived,
  // Tagging
  tag_added_to_couple: tagAddedToCouple,
  tag_removed_from_couple: tagRemovedFromCouple,
  // Personal / payment plans
  couple_birthday: coupleBirthday,
  payment_plan_milestone_reached: paymentPlanMilestoneReached,
  refund_issued: refundIssued,
}

/** Cheap lookup; returns null for unknown types (e.g. tampered data). */
export function getTriggerSpec(type: TriggerType): TriggerSpec | null {
  return triggerRegistry[type] ?? null
}
