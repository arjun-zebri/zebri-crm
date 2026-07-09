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
  BOOKING_TIERS,
  CANCELLATION_REASONS,
  COMPARISON_OPS,
  CONSULTATION_LOCATIONS,
  CONSULTATION_OUTCOMES,
  CONSULTATION_TYPES,
  CONTACT_CATEGORIES,
  DAY_OF_WEEK_BUCKETS,
  EMAIL_ENGAGEMENT_KINDS,
  EVENT_CHANGE_FIELDS,
  EVENT_TYPES,
  LEAD_SOURCES,
  MONTHS,
  PAYMENT_FAILURE_REASONS,
  PAYMENT_METHODS,
  PORTAL_COMPLETION_RANGES,
  PORTAL_SECTIONS,
  SEASONS,
  SIGNER_REQUIREMENTS,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TIME_UNITS,
  WEBHOOK_SOURCES,
  compareNumber,
  dateMatchesDayOfWeek,
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

/** Common Zod shape for the amount-comparison filter (subtotal etc.). */
const amountFilter = z
  .object({
    amountOp: z.enum(COMPARISON_OPS).optional(),
    amountValue: z.number().nonnegative().optional(),
    // ── Extended UI fields (Phase 14a — not yet matched) ──────────
    /** Saved package/tier slug the quote was built from. */
    tier: z.enum(BOOKING_TIERS).optional(),
    /** True when one or more add-on line items are on the document. */
    hasAddOns: z.boolean().optional(),
    /** True when a discount was applied. */
    discountApplied: z.boolean().optional(),
    /** Which revision of the document this is (1 = first send). */
    versionNumber: z.number().int().min(1).optional(),
    /** True when the doc is a deposit invoice/quote. */
    isDeposit: z.boolean().optional(),
    /** True when the doc is the final balance invoice. */
    isFinalBalance: z.boolean().optional(),
    /** True when this is a partial payment (not full amount). */
    isPartial: z.boolean().optional(),
    /** Method used (relevant for payment_received). */
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  })
  .passthrough()

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

/** Days-until-event filter (anchored on an ISO date in payload). */
function daysUntilEventMatches(
  payload: Record<string, unknown>,
  op: ComparisonOp | undefined,
  value: number | undefined,
): boolean {
  if (op === undefined || value === undefined) return true
  const raw = payload['event_date']
  if (!raw) return false
  const eventTs = new Date(String(raw)).getTime()
  if (Number.isNaN(eventTs)) return false
  const days = Math.floor((eventTs - Date.now()) / (1000 * 60 * 60 * 24))
  return compareNumber(days, op, value)
}

// ────────────────────────────────────────────────────────────────
// Lead / enquiry
// ────────────────────────────────────────────────────────────────

const newEnquiry: TriggerSpec<{
  leadSource?: string
  daysUntilEventOp?: ComparisonOp
  daysUntilEventValue?: number
  hasEventDate?: boolean
  hasVenue?: boolean
  dayOfWeek?: DayOfWeekBucket
  eventMonth?: string
  season?: string
  budgetTier?: string
  referralByContactId?: string
}> = {
  type: 'new_enquiry',
  configSchema: z.object({
    leadSource: z.enum(LEAD_SOURCES).optional(),
    daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
    daysUntilEventValue: z.number().int().optional(),
    hasEventDate: z.boolean().optional(),
    hasVenue: z.boolean().optional(),
    dayOfWeek: z.enum(DAY_OF_WEEK_BUCKETS).optional(),
    eventMonth: z.enum(MONTHS).optional(),
    season: z.enum(SEASONS).optional(),
    budgetTier: z.enum(BOOKING_TIERS).optional(),
    referralByContactId: z.string().uuid().optional(),
  }).passthrough(),
  match(event, config) {
    const payload = p(event)
    if (config.leadSource && payload.lead_source !== config.leadSource) return false
    if (!daysUntilEventMatches(payload, config.daysUntilEventOp, config.daysUntilEventValue)) return false
    return true
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
  daysUntilEventOp?: ComparisonOp
  daysUntilEventValue?: number
  timeInPreviousStageOp?: ComparisonOp
  timeInPreviousStageDays?: number
  triggeredBy?: 'any' | 'mc' | 'automation' | 'payment' | 'portal'
}> = {
  type: 'couple_stage_changed',
  configSchema: z.object({
    toStatus: z.string().optional(),
    fromStatus: z.string().optional(),
    daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
    daysUntilEventValue: z.number().int().optional(),
    timeInPreviousStageOp: z.enum(COMPARISON_OPS).optional(),
    timeInPreviousStageDays: z.number().int().optional(),
    triggeredBy: z.enum(['any', 'mc', 'automation', 'payment', 'portal']).optional(),
  }).passthrough(),
  match(event, config) {
    const payload = p(event)
    if (config.toStatus && payload.to_status !== config.toStatus) return false
    if (config.fromStatus && payload.from_status !== config.fromStatus) return false
    if (!daysUntilEventMatches(payload, config.daysUntilEventOp, config.daysUntilEventValue)) return false
    return true
  },
  ui: {
    category: 'pipeline',
    label: 'Couple stage changed',
    description: 'When a couple moves to a new stage',
    icon: 'ArrowRight',
  },
}

const bookingCancelled: TriggerSpec<{
  daysUntilEventOp?: ComparisonOp
  daysUntilEventValue?: number
  cancellationReason?: string
  depositAlreadyPaid?: boolean
  daysSinceBookedOp?: ComparisonOp
  daysSinceBookedValue?: number
}> = {
  type: 'booking_cancelled',
  configSchema: z.object({
    daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
    daysUntilEventValue: z.number().int().optional(),
    cancellationReason: z.enum(CANCELLATION_REASONS).optional(),
    depositAlreadyPaid: z.boolean().optional(),
    daysSinceBookedOp: z.enum(COMPARISON_OPS).optional(),
    daysSinceBookedValue: z.number().int().optional(),
  }).passthrough(),
  match(event, config) {
    return daysUntilEventMatches(p(event), config.daysUntilEventOp, config.daysUntilEventValue)
  },
  ui: {
    category: 'pipeline',
    label: 'Booking cancelled',
    description: 'When a couple cancels their booking',
    icon: 'XCircle',
  },
}

// ────────────────────────────────────────────────────────────────
// Quotes / invoices / payments
// ────────────────────────────────────────────────────────────────

type AmountConfig = { amountOp?: ComparisonOp; amountValue?: number }

function amountSpec<T extends string>(
  type: T,
  ui: TriggerUi,
  payloadField: string = 'subtotal',
): TriggerSpec<AmountConfig> {
  return {
    type: type as TriggerType,
    configSchema: amountFilter as z.ZodSchema<AmountConfig>,
    match(event, config) {
      return amountMatches(p(event), payloadField, config.amountOp, config.amountValue)
    },
    ui,
  }
}

const quoteCreated = amountSpec('quote_created', {
  category: 'payment',
  label: 'Quote created',
  description: 'When a quote is created as a draft',
  icon: 'FilePlus2',
})

const quoteSent = amountSpec('quote_sent', {
  category: 'payment',
  label: 'Quote sent',
  description: 'When a quote share link goes live',
  icon: 'Send',
})

const quoteAccepted = amountSpec('quote_accepted', {
  category: 'payment',
  label: 'Quote accepted',
  description: 'When a couple accepts a quote',
  icon: 'CheckCircle2',
})

const quoteDeclined = amountSpec('quote_declined', {
  category: 'payment',
  label: 'Quote declined',
  description: 'When a couple declines a quote',
  icon: 'XCircle',
})

const quoteDue: TriggerSpec<{
  days: number
  notificationCount?: number
  respectQuietHours?: boolean
}> = {
  type: 'quote_due',
  configSchema: z.object({
    days: z.number().int().min(0).max(180).default(0),
    notificationCount: z.number().int().min(1).max(5).optional(),
    respectQuietHours: z.boolean().optional(),
  }).passthrough(),
  // The `quote_due` event is emitted by the time-emitter once per
  // (quote, lead-time, day) — see `lib/automations/time-emitters/
  // quote-due.ts`. The emitter stamps the matching lead-time in
  // `payload.days_until_due`. Narrowing here means an automation
  // with `days=3` only fires for events that fire 3 days before
  // the expiry, not for `days=0` events on the same quote.
  match: (event, config) => {
    const payload = p(event)
    const emitted = Number(payload.days_until_due)
    return Number.isFinite(emitted) && emitted === config.days
  },
  ui: { category: 'payment', label: 'Quote due', description: 'When a quote reaches its expiry date', icon: 'Hourglass' },
}

/**
 * Effective overdue threshold (days past `expires_at`) for a
 * `quote_overdue` automation config. "Overdue" means strictly past
 * the expiry date — a configured min of 0 is clamped up to 1 so the
 * trigger never collides with `quote_due` (`days: 0`) on the expiry
 * day itself. Shared by the trigger's `match()` and the time-emitter
 * so both sides agree on which calendar day a quote fires.
 */
export function quoteOverdueThresholdDays(config: {
  daysOverdueMin?: number
}): number {
  return Math.max(1, config.daysOverdueMin ?? 1)
}

const quoteOverdue: TriggerSpec<{
  daysOverdueMin?: number
  daysOverdueMax?: number
  couplePreviouslyViewed?: boolean
}> = {
  type: 'quote_overdue',
  configSchema: z.object({
    daysOverdueMin: z.number().int().min(0).max(365).optional(),
    daysOverdueMax: z.number().int().min(0).max(365).optional(),
    couplePreviouslyViewed: z.boolean().optional(),
  }).passthrough(),
  // The `quote_overdue` event is emitted by the time-emitter once per
  // (quote, threshold, day) — see `lib/automations/time-emitters/
  // quote-overdue.ts`. The emitter stamps the overdue depth in
  // `payload.days_overdue`; narrowing here means an automation with
  // min=7 only fires for the day-7 event, not the day-1 one.
  // `couplePreviouslyViewed` is accepted but not yet enforced — quote
  // view tracking doesn't exist in the schema (same blocker as the
  // `quote_viewed_but_not_responded` trigger).
  match: (event, config) => {
    const payload = p(event)
    const emitted = Number(payload.days_overdue)
    if (!Number.isFinite(emitted)) return false
    const threshold = quoteOverdueThresholdDays(config)
    if (emitted !== threshold) return false
    if (config.daysOverdueMax !== undefined && emitted > config.daysOverdueMax) {
      return false
    }
    return true
  },
  ui: { category: 'payment', label: 'Quote overdue', description: 'When a quote has passed its expiry without acceptance', icon: 'AlertTriangle' },
}

const quoteViewedNotResponded: TriggerSpec<{
  days: number
  viewCountOp?: ComparisonOp
  viewCountValue?: number
  lastViewedWithinDays?: number
}> = {
  type: 'quote_viewed_but_not_responded',
  configSchema: z.object({
    days: z.number().int().min(1).max(60).default(7),
    viewCountOp: z.enum(COMPARISON_OPS).optional(),
    viewCountValue: z.number().int().min(1).optional(),
    lastViewedWithinDays: z.number().int().min(1).max(60).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'payment', label: 'Quote viewed but no response', description: 'When a couple has viewed a quote and gone quiet', icon: 'EyeOff' },
}

const invoiceCreated = amountSpec('invoice_created', {
  category: 'payment',
  label: 'Invoice created',
  description: 'When an invoice is created as a draft',
  icon: 'FilePlus2',
})

const invoiceSent = amountSpec('invoice_sent', {
  category: 'payment',
  label: 'Invoice sent',
  description: 'When an invoice share link goes live',
  icon: 'Send',
})

const paymentReceived = amountSpec('payment_received', {
  category: 'payment',
  label: 'Payment received',
  description: 'When a couple makes a payment',
  icon: 'CreditCard',
})

const invoiceDue: TriggerSpec<{
  days: number
  notificationCount?: number
  respectQuietHours?: boolean
  isFinalBalance?: boolean
}> = {
  type: 'invoice_due',
  configSchema: z.object({
    days: z.number().int().min(0).max(180).default(0),
    notificationCount: z.number().int().min(1).max(5).optional(),
    respectQuietHours: z.boolean().optional(),
    isFinalBalance: z.boolean().optional(),
  }).passthrough(),
  // The `invoice_due` event is emitted by the time-emitter once per
  // (invoice, lead-time, day) — see `lib/automations/time-emitters/
  // invoice-due.ts`. The emitter stamps the matching lead-time in
  // `payload.days_until_due`; narrowing here means an automation with
  // `days=3` only fires for the 3-days-before event, not the `days=0`
  // event on the same invoice. Mirrors `quote_due`. `isFinalBalance`
  // is accepted but not yet enforced — the emitter anchors on the
  // top-level `due_date`, not payment-schedule installments.
  match: (event, config) => {
    const payload = p(event)
    const emitted = Number(payload.days_until_due)
    return Number.isFinite(emitted) && emitted === config.days
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

const invoiceOverdue: TriggerSpec<{
  daysOverdueMin?: number
  daysOverdueMax?: number
  isFinalBalance?: boolean
  daysUntilEventOp?: ComparisonOp
  daysUntilEventValue?: number
}> = {
  type: 'invoice_overdue',
  configSchema: z.object({
    daysOverdueMin: z.number().int().min(0).max(365).optional(),
    daysOverdueMax: z.number().int().min(0).max(365).optional(),
    isFinalBalance: z.boolean().optional(),
    daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
    daysUntilEventValue: z.number().int().optional(),
  }).passthrough(),
  // The `invoice_overdue` event is emitted by the time-emitter once
  // per (invoice, threshold, day) — see `lib/automations/
  // time-emitters/invoice-overdue.ts`. The emitter stamps the overdue
  // depth in `payload.days_overdue`; narrowing here means an
  // automation with min=7 only fires for the day-7 event, not the
  // day-1 one. Mirrors `quote_overdue`. `isFinalBalance` and the
  // `daysUntilEvent*` filters are accepted but not yet enforced — the
  // emitter anchors on the top-level `due_date` and carries no
  // event-date anchor in its payload.
  match: (event, config) => {
    const payload = p(event)
    const emitted = Number(payload.days_overdue)
    if (!Number.isFinite(emitted)) return false
    const threshold = invoiceOverdueThresholdDays(config)
    if (emitted !== threshold) return false
    if (config.daysOverdueMax !== undefined && emitted > config.daysOverdueMax) {
      return false
    }
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
 * Shared schema for contract-lifecycle triggers — all of them gained
 * the same set of optional filters in Phase 14a UI scaffolding so
 * the picker can offer template / days-until-event / signer
 * narrowing on every contract step.
 */
const contractFilterSchema = z.object({
  daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
  daysUntilEventValue: z.number().int().optional(),
  templateUsed: z.string().optional(),
  versionNumber: z.number().int().min(1).optional(),
  signerRole: z.enum(SIGNER_REQUIREMENTS).optional(),
}).passthrough()

type ContractFilterConfig = z.infer<typeof contractFilterSchema>

const contractCreated: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_created',
  configSchema: contractFilterSchema,
  match: () => true,
  ui: { category: 'contract', label: 'Contract created', description: 'When a contract is created as a draft', icon: 'FilePlus2' },
}

const contractSent: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_sent',
  configSchema: contractFilterSchema,
  match: () => true,
  ui: { category: 'contract', label: 'Contract sent', description: 'When a contract is emailed to the couple', icon: 'Send' },
}

const contractSigned: TriggerSpec<ContractFilterConfig & {
  timeToSignHoursOp?: ComparisonOp
  timeToSignHoursValue?: number
  signedByBoth?: boolean
}> = {
  type: 'contract_signed',
  configSchema: contractFilterSchema.extend({
    timeToSignHoursOp: z.enum(COMPARISON_OPS).optional(),
    timeToSignHoursValue: z.number().int().min(0).optional(),
    signedByBoth: z.boolean().optional(),
  }),
  match: () => true,
  ui: { category: 'contract', label: 'Contract signed', description: 'When a couple signs a contract', icon: 'FileSignature' },
}

const contractDeclined: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_declined',
  configSchema: contractFilterSchema,
  match: () => true,
  ui: { category: 'contract', label: 'Contract declined', description: 'When a couple declines a contract', icon: 'XCircle' },
}

const contractRevoked: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_revoked',
  configSchema: contractFilterSchema,
  match: () => true,
  ui: { category: 'contract', label: 'Contract revoked', description: 'When you revoke a sent contract', icon: 'Undo2' },
}

const contractExpired: TriggerSpec<ContractFilterConfig> = {
  type: 'contract_expired',
  configSchema: contractFilterSchema,
  match: () => true,
  ui: { category: 'contract', label: 'Contract expired', description: 'When a contract passes its expiry without being signed', icon: 'CalendarX' },
}

const documentSigned: TriggerSpec<ContractFilterConfig> = {
  type: 'document_signed',
  configSchema: contractFilterSchema,
  match: () => true,
  ui: { category: 'contract', label: 'Document signed', description: 'Alias of contract signed', icon: 'PenTool' },
}

// ────────────────────────────────────────────────────────────────
// Events (couple-owned ceremony / rehearsal / reception rows)
// ────────────────────────────────────────────────────────────────

const eventFilter = z.object({
  eventType: z.enum(EVENT_TYPES).optional(),
  dayOfWeek: z.enum(DAY_OF_WEEK_BUCKETS).optional(),
  month: z.enum(MONTHS).optional(),
  season: z.enum(SEASONS).optional(),
  daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
  daysUntilEventValue: z.number().int().optional(),
  hasVenue: z.boolean().optional(),
  isDestination: z.boolean().optional(),
  guestCountOp: z.enum(COMPARISON_OPS).optional(),
  guestCountValue: z.number().int().min(0).optional(),
}).passthrough()

type EventFilterConfig = z.infer<typeof eventFilter>

function eventTriggerMatch(event: AutomationEventRow, config: EventFilterConfig): boolean {
  const payload = p(event)
  if (config.eventType && payload.event_type !== config.eventType) return false
  if (config.dayOfWeek && config.dayOfWeek !== 'any') {
    const dateStr = (payload.date as string | undefined) ?? null
    if (!dateMatchesDayOfWeek(dateStr, config.dayOfWeek as DayOfWeekBucket)) return false
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

const calendarConfig = z.object({
  amount: z.number().int().min(0),
  // Day-grain only (locked 2026-06-14 — see automations-wiring.md). The
  // daily cron can't serve sub-day offsets without Vercel Pro, so the
  // emitter only acts on `unit: 'days'` and the inspector offers no unit
  // picker. Default to days so a config saved without a unit still fires.
  unit: z.enum(TIME_UNITS).default('days'),
  eventType: z.enum(EVENT_TYPES).optional(),
  /** Time of day (HH:MM, 24h) the reminder should fire. */
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  /** Only fire when the resolved trigger time falls on this day-of-week bucket. */
  dayOfWeek: z.enum(DAY_OF_WEEK_BUCKETS).optional(),
  /** Skip couples whose automations are currently paused. */
  skipIfPaused: z.boolean().optional(),
  /** Only fire when couple status matches. */
  eventStatus: z.string().optional(),
  /** Skip the fire if today is an Australian public holiday. */
  respectPublicHolidays: z.boolean().optional(),
  /** Skip if the couple has already left a post-event review. */
  onlyIfNoReviewPosted: z.boolean().optional(),
  /** Skip if the couple has already referred someone. */
  onlyIfNotReferred: z.boolean().optional(),
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
    if (config.eventType && payload.event_type !== config.eventType) return false
    return true
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
    if (config.eventType && payload.event_type !== config.eventType) return false
    return true
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
  maxYears?: number
  onlyIfMarriedByMe?: boolean
  onlyIfHadGoodOutcome?: boolean
}> = {
  type: 'anniversary_of_event',
  configSchema: z.object({
    years: z.number().int().min(1).max(50).default(1),
    maxYears: z.number().int().min(1).max(50).optional(),
    onlyIfMarriedByMe: z.boolean().optional(),
    onlyIfHadGoodOutcome: z.boolean().optional(),
  }).passthrough(),
  // The emitter publishes one event per (event, years-since) on the
  // anniversary day; narrow to this automation's year (or year..maxYears
  // range). `onlyIf*` filters are dropped — no data backs them.
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

const sectionCompleted: TriggerSpec<{
  section?: string
  category?: string
  completedWithinDaysOfEvent?: number
  completionDurationHoursOp?: ComparisonOp
  completionDurationHoursValue?: number
}> = {
  type: 'section_completed',
  configSchema: z.object({
    section: z.enum(PORTAL_SECTIONS).optional(),
    category: z.string().optional(),
    completedWithinDaysOfEvent: z.number().int().min(0).max(365).optional(),
    completionDurationHoursOp: z.enum(COMPARISON_OPS).optional(),
    completionDurationHoursValue: z.number().int().min(0).optional(),
  }).passthrough(),
  match(event, config) {
    const payload = p(event)
    if (config.section && payload.section !== config.section) return false
    if (config.category && payload.category !== config.category) return false
    return true
  },
  ui: {
    category: 'portal',
    label: 'Portal section completed',
    description: 'When the couple submits people, songs, files or timeline',
    icon: 'CheckSquare',
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

const timelineEdited: TriggerSpec<{
  editedBy?: 'any' | 'mc' | 'couple' | 'vendor'
  itemsAddedOp?: ComparisonOp
  itemsAddedValue?: number
  itemsRemovedOp?: ComparisonOp
  itemsRemovedValue?: number
}> = {
  type: 'timeline_edited',
  configSchema: z.object({
    editedBy: z.enum(['any', 'mc', 'couple', 'vendor']).optional(),
    itemsAddedOp: z.enum(COMPARISON_OPS).optional(),
    itemsAddedValue: z.number().int().min(0).optional(),
    itemsRemovedOp: z.enum(COMPARISON_OPS).optional(),
    itemsRemovedValue: z.number().int().min(0).optional(),
  }).passthrough(),
  match: () => true,
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

const taskFilterSchema = z.object({
  taskCategory: z.enum(TASK_CATEGORIES).optional(),
  taskPriority: z.enum(TASK_PRIORITIES).optional(),
  dueWithinDaysOp: z.enum(COMPARISON_OPS).optional(),
  dueWithinDaysValue: z.number().int().optional(),
}).passthrough()

type TaskFilterConfig = z.infer<typeof taskFilterSchema>

const taskCreated: TriggerSpec<TaskFilterConfig> = {
  type: 'task_created',
  configSchema: taskFilterSchema,
  match: () => true,
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
  match: () => true,
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
  daysOverdueMin?: number
  daysOverdueMax?: number
  assignedTo?: 'any' | 'self' | 'delegated'
}> = {
  type: 'task_overdue',
  configSchema: taskFilterSchema.extend({
    daysOverdueMin: z.number().int().min(0).max(365).optional(),
    daysOverdueMax: z.number().int().min(0).max(365).optional(),
    assignedTo: z.enum(['any', 'self', 'delegated']).optional(),
  }),
  // The `task_overdue` event is emitted by the time-emitter once per
  // (task, threshold, day) — see `lib/automations/time-emitters/
  // task-overdue.ts`. The emitter stamps the overdue depth in
  // `payload.days_overdue`; narrowing here means an automation with
  // min=7 only fires for the day-7 event, not the day-1 one. Mirrors
  // `quote_overdue` / `invoice_overdue`. The `taskCategory`,
  // `taskPriority`, `assignedTo` and `dueWithinDays*` filters are
  // accepted but not enforced — `task_type` is a free-form per-user
  // tag (not the `taskCategory` enum), there's no assignee column, and
  // a "due within N days" filter is meaningless for an overdue task.
  match: (event, config) => {
    const payload = p(event)
    const emitted = Number(payload.days_overdue)
    if (!Number.isFinite(emitted)) return false
    const threshold = taskOverdueThresholdDays(config)
    if (emitted !== threshold) return false
    if (config.daysOverdueMax !== undefined && emitted > config.daysOverdueMax) {
      return false
    }
    return true
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

const contactFilter = z.object({
  category: z.enum(CONTACT_CATEGORIES).optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  isPrimaryVendorForCouple: z.boolean().optional(),
  region: z.string().optional(),
}).passthrough()

type ContactFilterConfig = z.infer<typeof contactFilter>

function contactTriggerMatch(event: AutomationEventRow, config: ContactFilterConfig): boolean {
  const payload = p(event)
  if (config.category && payload.category !== config.category) return false
  if (config.hasEmail === true && !payload.email) return false
  return true
}

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

const contactLinkedToCouple: TriggerSpec<ContactFilterConfig> = {
  type: 'contact_linked_to_couple',
  configSchema: contactFilter,
  match: contactTriggerMatch,
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

const coupleUploadedFile: TriggerSpec<{
  fileType?: string
  section?: string
  sizeBytesOp?: ComparisonOp
  sizeBytesValue?: number
}> = {
  type: 'couple_uploaded_file',
  configSchema: z.object({
    fileType: z.string().optional(),
    section: z.enum(PORTAL_SECTIONS).optional(),
    sizeBytesOp: z.enum(COMPARISON_OPS).optional(),
    sizeBytesValue: z.number().int().min(0).optional(),
  }).passthrough(),
  match: () => true,
  ui: { category: 'portal', label: 'Couple uploaded a file', description: 'Couple added a file to the portal', icon: 'Upload' },
}

const coupleAddedSongToPlaylist: TriggerSpec<{
  playlistKey?: 'entrance' | 'exit' | 'first_dance' | 'ceremony' | 'reception' | 'other'
  songCountOp?: ComparisonOp
  songCountValue?: number
}> = {
  type: 'couple_added_song_to_playlist',
  configSchema: z.object({
    playlistKey: z.enum(['entrance', 'exit', 'first_dance', 'ceremony', 'reception', 'other']).optional(),
    songCountOp: z.enum(COMPARISON_OPS).optional(),
    songCountValue: z.number().int().min(0).optional(),
  }).passthrough(),
  match: () => true,
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
    /** Optional narrowing to questionnaires sent from one template. */
    questionnaireTemplateId: z.string().uuid().optional(),
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
  booking_cancelled: bookingCancelled,
  // Quotes / invoices / payments
  quote_created: quoteCreated,
  quote_sent: quoteSent,
  quote_accepted: quoteAccepted,
  quote_declined: quoteDeclined,
  quote_due: quoteDue,
  quote_overdue: quoteOverdue,
  quote_viewed_but_not_responded: quoteViewedNotResponded,
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
