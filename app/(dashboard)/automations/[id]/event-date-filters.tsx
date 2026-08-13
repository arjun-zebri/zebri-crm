/**
 * The wedding-date filter family, shared by every couple-shaped
 * trigger whose payload carries `event_date`.
 *
 * One date field backs five separate questions an MC asks: how far
 * away is it, is there a date at all, what day of the week, which
 * month, which season. They are defined once here because
 * `new_enquiry` and `couple_stage_changed` both narrow on exactly the
 * same field, and a second copy would drift the moment one of them
 * gained an option.
 *
 * @module app/(dashboard)/automations/[id]/event-date-filters
 */
'use client'

import {
  OFFERED_COMPARISON_OPS,
  COMPARISON_OP_LABELS,
  DAY_OF_WEEK_BUCKETS,
  DAY_OF_WEEK_LABELS,
  MONTHS,
  MONTH_LABELS,
  SEASONS,
  SEASON_LABELS,
  type ComparisonOp,
} from '@/lib/automations/trigger-constants'

import { ComparisonControl } from './filter-controls'
import {
  configString as str,
  fieldFilter,
  type FilterConfig,
  type TriggerFilterDef,
} from './trigger-filter-list'

/**
 * Label for the days-until-event pair, e.g. "at most 90 days". Shared
 * by the chip and the collapsed summary.
 */
export function daysUntilLabel(config: FilterConfig): string {
  const op = str(config, 'daysUntilEventOp') as ComparisonOp | ''
  const value = config['daysUntilEventValue']
  if (!op || typeof value !== 'number') return 'any'
  return `${COMPARISON_OP_LABELS[op]} ${value} days`
}

/** "How far away is it" — operator + day count. */
const daysUntilFilter: TriggerFilterDef = {
  key: 'daysUntilEvent',
    label: 'Days until the wedding',
    chipLabel: 'wedding in',
    ...fieldFilter({ daysUntilEventOp: 'lte', daysUntilEventValue: 90 }),
    valueLabel: daysUntilLabel,
    summary: (config) => `Wedding ${daysUntilLabel(config)} away`,
    render: (config, setConfig) => (
      <ComparisonControl
        op={str(config, 'daysUntilEventOp') || 'lte'}
        value={(config['daysUntilEventValue'] as number | undefined) ?? 90}
        ops={OFFERED_COMPARISON_OPS.map((o) => ({ value: o, label: COMPARISON_OP_LABELS[o] }))}
        unit="days"
        onChange={(op, value) =>
          setConfig({ ...config, daysUntilEventOp: op, daysUntilEventValue: value })
        }
      />
    ),
}

/** "Is there a date at all yet". Couple triggers only: an event row's
 * own date is non-nullable, so the question doesn't exist there. */
const hasDateFilter: TriggerFilterDef = {
    key: 'hasEventDate',
    label: 'Wedding date',
    chipLabel: 'wedding date',
    ...fieldFilter({ hasEventDate: true }),
    current: (config) => (config['hasEventDate'] === false ? 'no' : 'yes'),
    valueLabel: (config) => (config['hasEventDate'] === false ? 'not set yet' : 'already set'),
    summary: (config) =>
      config['hasEventDate'] === false ? 'No date yet' : 'Already has a date',
    options: [
      { value: 'yes', label: 'Already has a date' },
      { value: 'no', label: 'No date yet' },
    ],
    apply: (config, value) => ({ ...config, hasEventDate: value === 'yes' }),
}

const dayOfWeekFilter: TriggerFilterDef = {
    key: 'dayOfWeek',
    label: 'Day of the week',
    chipLabel: 'day',
    ...fieldFilter({ dayOfWeek: 'any' }),
    current: (config) => str(config, 'dayOfWeek') || 'any',
    valueLabel: (config) => {
      const value = (str(config, 'dayOfWeek') || 'any') as never
      return value === 'any' ? 'any' : DAY_OF_WEEK_LABELS[value]
    },
    summary: (config) => {
      const value = (str(config, 'dayOfWeek') || 'any') as never
      return value === 'any' ? 'Any day' : DAY_OF_WEEK_LABELS[value]
    },
    options: DAY_OF_WEEK_BUCKETS.map((d) => ({ value: d, label: DAY_OF_WEEK_LABELS[d] })),
    apply: (config, value) => ({ ...config, dayOfWeek: value }),
}

const monthFilter: TriggerFilterDef = {
    key: 'eventMonth',
    label: 'Wedding month',
    chipLabel: 'month',
    ...fieldFilter({ eventMonth: '' }),
    current: (config) => str(config, 'eventMonth'),
    valueLabel: (config) => {
      const value = str(config, 'eventMonth')
      return value ? MONTH_LABELS[value as never] : 'any'
    },
    summary: (config) => {
      const value = str(config, 'eventMonth')
      return value ? `In ${MONTH_LABELS[value as never]}` : 'Any month'
    },
    options: [
      { value: '', label: 'Any month' },
      ...MONTHS.map((m) => ({ value: m, label: MONTH_LABELS[m] })),
    ],
    apply: (config, value) => ({ ...config, eventMonth: value }),
}

const seasonFilter: TriggerFilterDef = {
    key: 'season',
    label: 'Season',
    chipLabel: 'season',
    ...fieldFilter({ season: 'any' }),
    current: (config) => str(config, 'season') || 'any',
    valueLabel: (config) => {
      const value = (str(config, 'season') || 'any') as never
      return value === 'any' ? 'any' : SEASON_LABELS[value]
    },
    summary: (config) => {
      const value = (str(config, 'season') || 'any') as never
      return value === 'any' ? 'Any season' : SEASON_LABELS[value]
    },
    options: SEASONS.map((s) => ({ value: s, label: SEASON_LABELS[s] })),
    apply: (config, value) => ({ ...config, season: value }),
}

/**
 * The full family for couple-shaped payloads (wedding under
 * `event_date`, may be unset), in "Add filter" menu order.
 */
export const EVENT_DATE_FILTERS: TriggerFilterDef[] = [
  daysUntilFilter,
  hasDateFilter,
  dayOfWeekFilter,
  monthFilter,
  seasonFilter,
]

/**
 * The family for event-row payloads (the row's own `date`, always
 * set): everything except the has-a-date question.
 */
export const EVENT_ROW_DATE_FILTERS: TriggerFilterDef[] = [
  daysUntilFilter,
  dayOfWeekFilter,
  monthFilter,
  seasonFilter,
]

/**
 * Just the calendar buckets (day / month / season), for triggers
 * whose firing time already fixes how far away the date is — a
 * "days before the wedding" trigger has no use for a days-until
 * filter on top.
 */
export const DATE_BUCKET_FILTERS: TriggerFilterDef[] = [
  dayOfWeekFilter,
  monthFilter,
  seasonFilter,
]
