/**
 * Filter sets for triggers anchored on an event row (`events.date`):
 * `event_created`, `event_updated`, and the tick-emitted day-offset
 * triggers (`time_before_event`, `time_after_event`,
 * `anniversary_of_event`).
 *
 * The `eventType` filter is deliberately absent everywhere: the app
 * never writes `events.event_type`, so every row holds the column
 * default and the filter could only match everything or nothing.
 *
 * @module app/(dashboard)/automations/[id]/event-row-filters
 */
'use client'

import { DATE_BUCKET_FILTERS, EVENT_ROW_DATE_FILTERS } from './event-date-filters'
import { ComparisonControl } from './filter-controls'
import {
  configString as str,
  fieldFilter,
  type FilterConfig,
  type TriggerFilterDef,
} from './trigger-filter-list'

/** "Has a venue" — backed by `events.venue`, set from the couple UI. */
const hasVenueFilter: TriggerFilterDef = {
  key: 'hasVenue',
  label: 'Venue',
  chipLabel: 'venue',
  ...fieldFilter({ hasVenue: true }),
  current: (config) => (config['hasVenue'] === false ? 'no' : 'yes'),
  valueLabel: (config) => (config['hasVenue'] === false ? 'not set yet' : 'already set'),
  summary: (config) => (config['hasVenue'] === false ? 'No venue yet' : 'Has a venue'),
  options: [
    { value: 'yes', label: 'Venue already set' },
    { value: 'no', label: 'No venue yet' },
  ],
  apply: (config, value) => ({ ...config, hasVenue: value === 'yes' }),
}

/** Filters offered on Event added. */
export const EVENT_CREATED_FILTERS: TriggerFilterDef[] = [
  ...EVENT_ROW_DATE_FILTERS,
  hasVenueFilter,
]

const CHANGED_LABELS: Record<string, string> = {
  any: 'anything',
  date: 'the date',
  venue: 'the venue',
}

/**
 * Filters offered on Event updated: the created set plus "which field
 * changed". Only date and venue are offered — they are the two whose
 * previous value the payload carries, so the only two the matcher can
 * verify actually changed.
 */
export const EVENT_UPDATED_FILTERS: TriggerFilterDef[] = [
  {
    key: 'changed',
    label: 'What changed',
    chipLabel: 'changed',
    ...fieldFilter({ changed: 'any' }),
    current: (config) => str(config, 'changed') || 'any',
    valueLabel: (config) => CHANGED_LABELS[str(config, 'changed') || 'any'] ?? 'anything',
    summary: (config) => {
      const value = str(config, 'changed') || 'any'
      return value === 'any' ? 'Any change' : `${CHANGED_LABELS[value]} changed`
    },
    options: [
      { value: 'any', label: 'Anything' },
      { value: 'date', label: 'The date' },
      { value: 'venue', label: 'The venue' },
    ],
    apply: (config, value) => ({ ...config, changed: value }),
  },
  ...EVENT_ROW_DATE_FILTERS,
  hasVenueFilter,
]

/** "N days before/after the event" — the trigger's required parameter. */
function offsetChip(direction: 'before' | 'after'): TriggerFilterDef {
  const label = (config: FilterConfig): string => {
    const amount = typeof config['amount'] === 'number' ? config['amount'] : 7
    if (amount === 0) return 'on the day'
    return `${amount} day${amount === 1 ? '' : 's'} ${direction}`
  }
  return {
    key: 'amount',
    label: 'When it fires',
    chipLabel: 'fires',
    required: true,
    ...fieldFilter({ amount: 7 }),
    valueLabel: label,
    summary: (config) => `Fires ${label(config)} the event`,
    render: (config, setConfig) => (
      <ComparisonControl
        value={(config['amount'] as number | undefined) ?? 7}
        unit="days"
        hint={`Days ${direction} the event. 0 fires on the day itself.`}
        onChange={(_op, value) => setConfig({ ...config, amount: value })}
      />
    ),
  }
}

/** Filters for Days before event: the offset plus the date buckets. */
export const TIME_BEFORE_EVENT_FILTERS: TriggerFilterDef[] = [
  offsetChip('before'),
  ...DATE_BUCKET_FILTERS,
]

/** Filters for Days after event. */
export const TIME_AFTER_EVENT_FILTERS: TriggerFilterDef[] = [
  offsetChip('after'),
  ...DATE_BUCKET_FILTERS,
]

/** Label for the anniversary year (or year range). */
function anniversaryLabel(config: FilterConfig): string {
  const years = typeof config['years'] === 'number' ? config['years'] : 1
  const max = config['maxYears']
  if (typeof max === 'number' && max > years) {
    return `years ${years} to ${max}`
  }
  return years === 1 ? 'the first anniversary' : `anniversary ${years}`
}

/**
 * Filters for Anniversary of event: the year is required; adding the
 * "repeat until" filter turns it into a year range.
 */
export const ANNIVERSARY_FILTERS: TriggerFilterDef[] = [
  {
    key: 'years',
    label: 'Which anniversary',
    chipLabel: 'fires on',
    required: true,
    ...fieldFilter({ years: 1 }),
    valueLabel: anniversaryLabel,
    summary: (config) => `Fires on ${anniversaryLabel(config)}`,
    render: (config, setConfig) => (
      <ComparisonControl
        value={(config['years'] as number | undefined) ?? 1}
        unit="years"
        hint="Years after the event."
        onChange={(_op, value) => setConfig({ ...config, years: Math.max(1, value) })}
      />
    ),
  },
  {
    key: 'maxYears',
    label: 'Repeat until year',
    chipLabel: 'repeats until',
    ...fieldFilter({ maxYears: 5 }),
    valueLabel: (config) =>
      typeof config['maxYears'] === 'number' ? `year ${config['maxYears']}` : 'year 5',
    summary: (config) =>
      typeof config['maxYears'] === 'number'
        ? `Repeats until year ${config['maxYears']}`
        : 'Repeats until year 5',
    render: (config, setConfig) => (
      <ComparisonControl
        value={(config['maxYears'] as number | undefined) ?? 5}
        unit="years"
        hint="Repeats every year up to and including this one."
        onChange={(_op, value) => setConfig({ ...config, maxYears: Math.max(1, value) })}
      />
    ),
  },
]
