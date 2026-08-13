/**
 * The filter set for the `couple_stage_changed` trigger.
 *
 * The payload from `tg_couples_emit_stage_changed` carries
 * `from_status`, `to_status`, `lead_source` and `event_date`, and
 * every filter below narrows on one of them. The two filters this
 * trigger used to declare but never render or enforce, time in the
 * previous stage and who made the change, are gone: neither has a
 * field behind it, and an inert filter reads as a broken app.
 *
 * Ordering follows how an MC thinks about a stage move: which stage
 * it landed in first, then where it came from, then everything about
 * the couple that might qualify the move.
 *
 * @module app/(dashboard)/automations/[id]/couple-stage-filters
 */
'use client'

import { coupleStatusFilter, leadSourceFilter } from './couple-filters'
import { EVENT_DATE_FILTERS } from './event-date-filters'
import type { CoupleStatus } from './filter-options'
import type { TriggerFilterDef } from './trigger-filter-list'

/**
 * Filters offered on Couple stage changed, in the order they appear
 * in the "Add filter" menu.
 *
 * @param statuses - The MC's own `couple_statuses` rows, which back
 *   both stage filters. Pass `[]` before they've loaded.
 */
export function coupleStageFilters(statuses: CoupleStatus[]): TriggerFilterDef[] {
  return [
    coupleStatusFilter({
      configKey: 'toStatus',
      label: 'Moved into',
      chipLabel: 'into',
      statuses,
      anyLabel: 'Any stage',
      summary: (name) => (name ? `Moves into ${name}` : 'Into any stage'),
    }),
    coupleStatusFilter({
      configKey: 'fromStatus',
      label: 'Moved out of',
      chipLabel: 'out of',
      statuses,
      anyLabel: 'Any stage',
      summary: (name) => (name ? `Moves out of ${name}` : 'Out of any stage'),
    }),
    leadSourceFilter,
    ...EVENT_DATE_FILTERS,
  ]
}
