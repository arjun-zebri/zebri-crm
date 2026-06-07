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
  CONTACT_CATEGORIES,
  DAY_OF_WEEK_BUCKETS,
  EVENT_TYPES,
  LEAD_SOURCES,
  PEOPLE_CATEGORIES,
  PORTAL_SECTIONS,
  TIME_UNITS,
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
    | 'portal'
    | 'task'
    | 'payment'
    | 'contract'
    | 'contact'
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

const daysUntilEventFilter = z
  .object({
    daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
    daysUntilEventValue: z.number().int().optional(),
  })
  .passthrough()

// ────────────────────────────────────────────────────────────────
// Lead / enquiry
// ────────────────────────────────────────────────────────────────

const newEnquiry: TriggerSpec<{
  leadSource?: string
  daysUntilEventOp?: ComparisonOp
  daysUntilEventValue?: number
}> = {
  type: 'new_enquiry',
  configSchema: z.object({
    leadSource: z.enum(LEAD_SOURCES).optional(),
    daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
    daysUntilEventValue: z.number().int().optional(),
  }),
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

const leadInactive: TriggerSpec<{ days: number; status?: string }> = {
  type: 'lead_inactive',
  configSchema: z.object({
    days: z.number().int().min(1).max(180),
    status: z.string().optional(),
  }),
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
}> = {
  type: 'custom_field_changed',
  configSchema: z.object({
    key: z.string().optional(),
    valueOp: z.enum(COMPARISON_OPS).optional(),
    valueNumber: z.number().optional(),
  }),
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
}> = {
  type: 'couple_stage_changed',
  configSchema: z.object({
    toStatus: z.string().optional(),
    fromStatus: z.string().optional(),
    daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
    daysUntilEventValue: z.number().int().optional(),
  }),
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
}> = {
  type: 'booking_cancelled',
  configSchema: daysUntilEventFilter,
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

const quoteDue: TriggerSpec<{ days: number }> = {
  type: 'quote_due',
  configSchema: z.object({ days: z.number().int().min(0).max(180).default(0) }),
  match: () => true,
  ui: { category: 'payment', label: 'Quote due', description: 'When a quote reaches its due date', icon: 'Hourglass' },
}

const quoteOverdue: TriggerSpec<{ daysOverdueMin?: number }> = {
  type: 'quote_overdue',
  configSchema: z.object({ daysOverdueMin: z.number().int().min(0).max(365).optional() }),
  match: () => true,
  ui: { category: 'payment', label: 'Quote overdue', description: 'When a quote has passed its expiry without acceptance', icon: 'AlertTriangle' },
}

const quoteViewedNotResponded: TriggerSpec<{ days: number }> = {
  type: 'quote_viewed_but_not_responded',
  configSchema: z.object({ days: z.number().int().min(1).max(60).default(7) }),
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

const invoiceDue: TriggerSpec<{ days: number }> = {
  type: 'invoice_due',
  configSchema: z.object({ days: z.number().int().min(0).max(180).default(0) }),
  match: () => true,
  ui: { category: 'payment', label: 'Invoice due', description: 'When an invoice reaches its due date', icon: 'Hourglass' },
}

const invoiceOverdue: TriggerSpec<{ daysOverdueMin?: number }> = {
  type: 'invoice_overdue',
  configSchema: z.object({ daysOverdueMin: z.number().int().min(0).max(365).optional() }),
  match: () => true,
  ui: { category: 'payment', label: 'Invoice overdue', description: 'When an invoice passes its due date without payment', icon: 'AlertTriangle' },
}

const paymentFailed: TriggerSpec<Record<string, unknown>> = {
  type: 'payment_failed',
  configSchema: empty,
  match: () => true,
  ui: { category: 'payment', label: 'Payment failed', description: 'When a Stripe charge fails', icon: 'AlertCircle' },
}

// ────────────────────────────────────────────────────────────────
// Contracts
// ────────────────────────────────────────────────────────────────

const contractCreated: TriggerSpec<Record<string, unknown>> = {
  type: 'contract_created',
  configSchema: empty,
  match: () => true,
  ui: { category: 'contract', label: 'Contract created', description: 'When a contract is created as a draft', icon: 'FilePlus2' },
}

const contractSent: TriggerSpec<Record<string, unknown>> = {
  type: 'contract_sent',
  configSchema: empty,
  match: () => true,
  ui: { category: 'contract', label: 'Contract sent', description: 'When a contract is emailed to the couple', icon: 'Send' },
}

const contractSigned: TriggerSpec<Record<string, unknown>> = {
  type: 'contract_signed',
  configSchema: empty,
  match: () => true,
  ui: { category: 'contract', label: 'Contract signed', description: 'When a couple signs a contract', icon: 'FileSignature' },
}

const contractDeclined: TriggerSpec<Record<string, unknown>> = {
  type: 'contract_declined',
  configSchema: empty,
  match: () => true,
  ui: { category: 'contract', label: 'Contract declined', description: 'When a couple declines a contract', icon: 'XCircle' },
}

const contractRevoked: TriggerSpec<Record<string, unknown>> = {
  type: 'contract_revoked',
  configSchema: empty,
  match: () => true,
  ui: { category: 'contract', label: 'Contract revoked', description: 'When you revoke a sent contract', icon: 'Undo2' },
}

const contractExpired: TriggerSpec<Record<string, unknown>> = {
  type: 'contract_expired',
  configSchema: empty,
  match: () => true,
  ui: { category: 'contract', label: 'Contract expired', description: 'When a contract passes its expiry without being signed', icon: 'CalendarX' },
}

const documentSigned: TriggerSpec<Record<string, unknown>> = {
  type: 'document_signed',
  configSchema: empty,
  match: () => true,
  ui: { category: 'contract', label: 'Document signed', description: 'Alias of contract signed', icon: 'PenTool' },
}

// ────────────────────────────────────────────────────────────────
// Events (couple-owned ceremony / rehearsal / reception rows)
// ────────────────────────────────────────────────────────────────

const eventFilter = z.object({
  eventType: z.enum(EVENT_TYPES).optional(),
  dayOfWeek: z.enum(DAY_OF_WEEK_BUCKETS).optional(),
})

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

const eventUpdated: TriggerSpec<EventFilterConfig & { changed?: 'any' | 'date' | 'venue' }> = {
  type: 'event_updated',
  configSchema: eventFilter.extend({
    changed: z.enum(['any', 'date', 'venue']).optional(),
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

const eventDeleted: TriggerSpec<EventFilterConfig> = {
  type: 'event_deleted',
  configSchema: eventFilter,
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
  unit: z.enum(TIME_UNITS),
  eventType: z.enum(EVENT_TYPES).optional(),
  /** Time of day (HH:MM, 24h) the reminder should fire. */
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})

type CalendarConfig = z.infer<typeof calendarConfig>

const timeBeforeEvent: TriggerSpec<CalendarConfig> = {
  type: 'time_before_event',
  configSchema: calendarConfig,
  match: () => true,
  ui: {
    category: 'calendar',
    label: 'X time before event',
    description: 'Relative-time reminder anchored to the event (or rehearsal) date',
    icon: 'CalendarClock',
  },
}

const timeAfterEvent: TriggerSpec<CalendarConfig> = {
  type: 'time_after_event',
  configSchema: calendarConfig,
  match: () => true,
  ui: {
    category: 'calendar',
    label: 'X time after event',
    description: 'Anchored to days after the event (or rehearsal) date',
    icon: 'CalendarCheck',
  },
}

const specificDateReached: TriggerSpec<{ date: string; repeatYearly?: boolean }> = {
  type: 'specific_date_reached',
  configSchema: z.object({
    date: z.string(),
    repeatYearly: z.boolean().optional(),
  }),
  match: () => true,
  ui: {
    category: 'calendar',
    label: 'Specific date reached',
    description: 'A fixed calendar date (optionally repeating yearly)',
    icon: 'Calendar',
  },
}

const anniversaryOfEvent: TriggerSpec<{ years: number; maxYears?: number }> = {
  type: 'anniversary_of_event',
  configSchema: z.object({
    years: z.number().int().min(1).max(50).default(1),
    maxYears: z.number().int().min(1).max(50).optional(),
  }),
  match: () => true,
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

const sectionCompleted: TriggerSpec<{ section?: string; category?: string }> = {
  type: 'section_completed',
  configSchema: z.object({
    section: z.enum(PORTAL_SECTIONS).optional(),
    category: z.string().optional(),
  }),
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

const portalSectionStartedNotFinished: TriggerSpec<{ section?: string; days: number }> = {
  type: 'portal_section_started_not_finished',
  configSchema: z.object({
    section: z.enum(PORTAL_SECTIONS).optional(),
    days: z.number().int().min(1).max(60).default(7),
  }),
  match: () => true,
  ui: { category: 'portal', label: 'Portal section started but not finished', description: 'Abandonment recovery', icon: 'CornerDownLeft' },
}

const timelineEdited: TriggerSpec<Record<string, unknown>> = {
  type: 'timeline_edited',
  configSchema: empty,
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

const taskCreated: TriggerSpec<Record<string, unknown>> = {
  type: 'task_created',
  configSchema: empty,
  match: () => true,
  ui: {
    category: 'task',
    label: 'Task created',
    description: 'When a task is added',
    icon: 'ListPlus',
  },
}

const taskCompleted: TriggerSpec<Record<string, unknown>> = {
  type: 'task_completed',
  configSchema: empty,
  match: () => true,
  ui: {
    category: 'task',
    label: 'Task completed',
    description: 'When a task is marked done',
    icon: 'ListChecks',
  },
}

const taskOverdue: TriggerSpec<{ daysOverdueMin?: number }> = {
  type: 'task_overdue',
  configSchema: z.object({ daysOverdueMin: z.number().int().min(0).max(365).optional() }),
  match: () => true,
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
})

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

const manualFire: TriggerSpec<Record<string, unknown>> = {
  type: 'manual_fire',
  configSchema: empty,
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
  // Manual
  manual_fire: manualFire,
}

/** Cheap lookup; returns null for unknown types (e.g. tampered data). */
export function getTriggerSpec(type: TriggerType): TriggerSpec | null {
  return triggerRegistry[type] ?? null
}
