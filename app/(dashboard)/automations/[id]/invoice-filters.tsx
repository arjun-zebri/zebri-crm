/**
 * Filter sets for the money triggers: `invoice_created`,
 * `invoice_sent`, `payment_received`, `invoice_due` and
 * `invoice_overdue`.
 *
 * All backed by what `tg_invoices_emit_lifecycle` and the invoice
 * time-emitters actually put in their payloads: `total`,
 * `discount_type`/`discount_value`, `due_date`, the couple's
 * `event_date`, and the stage fields. The eight speculative fields the
 * old shared amount schema carried (package tier, add-ons, version
 * number, deposit / final-balance / partial flags, payment method) are
 * gone; nothing on `invoices` or its child rows backs any of them.
 *
 * @module app/(dashboard)/automations/[id]/invoice-filters
 */
'use client'

import {
  OFFERED_COMPARISON_OPS,
  COMPARISON_OP_LABELS,
  type ComparisonOp,
} from '@/lib/automations/trigger-constants'
import { formatAUD } from '@/lib/payments/format'

import { EVENT_DATE_FILTERS } from './event-date-filters'
import { ComparisonControl } from './filter-controls'
import {
  configString as str,
  fieldFilter,
  type FilterConfig,
  type TriggerFilterDef,
} from './trigger-filter-list'

/** Reads an operator + number pair, or null while either is unset. */
function pair(
  config: FilterConfig,
  opKey: string,
  valueKey: string,
): { op: ComparisonOp; value: number } | null {
  const op = str(config, opKey) as ComparisonOp | ''
  const value = config[valueKey]
  if (!op || typeof value !== 'number') return null
  return { op, value }
}

/** "at least $2,000", or "any" while nothing is chosen. */
function amountLabel(config: FilterConfig): string {
  const set = pair(config, 'amountOp', 'amountValue')
  return set ? `${COMPARISON_OP_LABELS[set.op]} ${formatAUD(set.value)}` : 'any'
}

/** "at most 14 days", or "any" while nothing is chosen. */
function dueInLabel(config: FilterConfig): string {
  const set = pair(config, 'dueInDaysOp', 'dueInDaysValue')
  return set ? `${COMPARISON_OP_LABELS[set.op]} ${set.value} days` : 'any'
}

const OPS = OFFERED_COMPARISON_OPS.map((o) => ({ value: o, label: COMPARISON_OP_LABELS[o] }))

/**
 * Filters offered on Invoice created, in the order they appear in the
 * "Add filter" menu.
 *
 * Money first, because it is the reason most of these automations
 * exist, then the invoice's own fields, then the wedding it belongs
 * to.
 */
const amountFilter: TriggerFilterDef = {
    key: 'amount',
    label: 'Invoice total',
    chipLabel: 'total',
    ...fieldFilter({ amountOp: 'gte', amountValue: 1000 }),
    valueLabel: amountLabel,
    // Spelled out in the summary because "total" alone reads as the
    // subtotal to anyone who has seen the old filter.
    summary: (config) => `Total ${amountLabel(config)}`,
    render: (config, setConfig) => (
      <ComparisonControl
        op={str(config, 'amountOp') || 'gte'}
        value={(config['amountValue'] as number | undefined) ?? 1000}
        ops={OPS}
        prefix="$"
        onChange={(op, value) => setConfig({ ...config, amountOp: op, amountValue: value })}
      />
    ),
}

const discountFilter: TriggerFilterDef = {
    key: 'hasDiscount',
    label: 'Discount',
    chipLabel: 'discount',
    ...fieldFilter({ hasDiscount: true }),
    current: (config) => (config['hasDiscount'] === false ? 'no' : 'yes'),
    valueLabel: (config) => (config['hasDiscount'] === false ? 'none' : 'applied'),
    summary: (config) =>
      config['hasDiscount'] === false ? 'No discount' : 'Has a discount',
    options: [
      { value: 'yes', label: 'Discount applied' },
      { value: 'no', label: 'No discount' },
    ],
    apply: (config, value) => ({ ...config, hasDiscount: value === 'yes' }),
}

const hasDueDateFilter: TriggerFilterDef = {
    key: 'hasDueDate',
    label: 'Due date',
    chipLabel: 'due date',
    ...fieldFilter({ hasDueDate: true }),
    current: (config) => (config['hasDueDate'] === false ? 'no' : 'yes'),
    valueLabel: (config) => (config['hasDueDate'] === false ? 'not set' : 'set'),
    summary: (config) => (config['hasDueDate'] === false ? 'No due date' : 'Has a due date'),
    options: [
      { value: 'yes', label: 'Has a due date' },
      { value: 'no', label: 'No due date' },
    ],
    apply: (config, value) => ({ ...config, hasDueDate: value === 'yes' }),
}

const dueInFilter: TriggerFilterDef = {
    key: 'dueIn',
    label: 'Days until due',
    chipLabel: 'due in',
    ...fieldFilter({ dueInDaysOp: 'lte', dueInDaysValue: 14 }),
    valueLabel: dueInLabel,
    summary: (config) => `Due ${dueInLabel(config)} away`,
    render: (config, setConfig) => (
      <ComparisonControl
        op={str(config, 'dueInDaysOp') || 'lte'}
        value={(config['dueInDaysValue'] as number | undefined) ?? 14}
        ops={OPS}
        unit="days"
        onChange={(op, value) =>
          setConfig({ ...config, dueInDaysOp: op, dueInDaysValue: value })
        }
      />
    ),
}

/**
 * Filters offered on Invoice created and Invoice sent, in "Add
 * filter" menu order. Money first, because it is the reason most of
 * these automations exist, then the invoice's own fields, then the
 * wedding it belongs to.
 */
export const INVOICE_DOC_FILTERS: TriggerFilterDef[] = [
  amountFilter,
  discountFilter,
  hasDueDateFilter,
  dueInFilter,
  ...EVENT_DATE_FILTERS,
]

/**
 * Filters offered on Payment received: how big, and how close to the
 * wedding. Due date and discount are history once the money is in.
 */
export const PAYMENT_RECEIVED_FILTERS: TriggerFilterDef[] = [
  amountFilter,
  ...EVENT_DATE_FILTERS,
]

/** "Only the final payment" — stage narrowing on the due/overdue emitters. */
const finalBalanceFilter: TriggerFilterDef = {
  key: 'isFinalBalance',
  label: 'Which payment',
  chipLabel: 'payment',
  ...fieldFilter({ isFinalBalance: true }),
  current: (config) => (config['isFinalBalance'] === true ? 'final' : 'any'),
  valueLabel: (config) => (config['isFinalBalance'] === true ? 'the final one' : 'any'),
  summary: (config) =>
    config['isFinalBalance'] === true ? 'Only the final payment' : 'Any payment',
  options: [
    { value: 'final', label: 'Only the final payment' },
    { value: 'any', label: 'Any payment stage' },
  ],
  apply: (config, value) => ({ ...config, isFinalBalance: value === 'final' }),
}

/** Label for the invoice_due lead-time, e.g. "3 days before it's due". */
function dueLeadLabel(config: FilterConfig): string {
  const days = typeof config['days'] === 'number' ? config['days'] : 0
  return days === 0 ? "on the day it's due" : `${days} day${days === 1 ? '' : 's'} before it's due`
}

/**
 * Filters for Invoice due. `fires` is the trigger's required
 * parameter (which lead-time event this automation answers), so its
 * chip is permanent; the stage filter is optional.
 */
export const INVOICE_DUE_FILTERS: TriggerFilterDef[] = [
  {
    key: 'days',
    label: 'When it fires',
    chipLabel: 'fires',
    required: true,
    ...fieldFilter({ days: 0 }),
    valueLabel: dueLeadLabel,
    summary: (config) => `Fires ${dueLeadLabel(config)}`,
    render: (config, setConfig) => (
      <ComparisonControl
        value={(config['days'] as number | undefined) ?? 0}
        unit="days"
        hint="Days before the due date. 0 fires on the day itself."
        onChange={(_op, value) => setConfig({ ...config, days: value })}
      />
    ),
  },
  finalBalanceFilter,
]

/** Label for the overdue threshold, e.g. "7 days overdue". */
function overdueLabel(config: FilterConfig): string {
  const raw = config['daysOverdueMin']
  const days = typeof raw === 'number' ? Math.max(1, raw) : 1
  return `${days} day${days === 1 ? '' : 's'} overdue`
}

/**
 * Filters for Invoice overdue. The threshold is required (it names
 * which overdue-depth event this automation answers; the emitter
 * clamps 0 up to 1 so it never collides with "due today").
 */
export const INVOICE_OVERDUE_FILTERS: TriggerFilterDef[] = [
  {
    key: 'daysOverdueMin',
    label: 'When it fires',
    chipLabel: 'fires',
    required: true,
    ...fieldFilter({ daysOverdueMin: 1 }),
    valueLabel: overdueLabel,
    summary: (config) => `Fires once ${overdueLabel(config)}`,
    render: (config, setConfig) => (
      <ComparisonControl
        value={(config['daysOverdueMin'] as number | undefined) ?? 1}
        unit="days"
        hint="Days past the due date. Fires once, at this depth."
        onChange={(_op, value) => setConfig({ ...config, daysOverdueMin: Math.max(1, value) })}
      />
    ),
  },
  finalBalanceFilter,
]
