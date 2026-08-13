/**
 * The filter set for the `new_enquiry` trigger.
 *
 * Each entry narrows a field the trigger's payload actually carries
 * (`lead_source`, `status`, `event_date`; see
 * `tg_couples_emit_new_enquiry`). Nothing speculative is offered: a
 * filter the matcher can't enforce silently matches nothing, which
 * reads to an MC as an automation that mysteriously never runs.
 *
 * @module app/(dashboard)/automations/[id]/new-enquiry-filters
 */
'use client'

import { coupleStatusFilter, leadSourceFilter } from './couple-filters'
import { EVENT_DATE_FILTERS } from './event-date-filters'
import type { CoupleStatus } from './filter-options'
import type { TriggerFilterDef } from './trigger-filter-list'

/**
 * Filters offered on New enquiry, in the order they appear in the
 * "Add filter" menu.
 *
 * @param statuses - The MC's own `couple_statuses` rows, which back
 *   the starting-status filter. Pass `[]` before they've loaded.
 */
export function newEnquiryFilters(statuses: CoupleStatus[]): TriggerFilterDef[] {
  return [
    leadSourceFilter,
    ...EVENT_DATE_FILTERS,
    coupleStatusFilter({
      configKey: 'initialStatus',
      label: 'Starting status',
      chipLabel: 'status',
      statuses,
      anyLabel: 'Any status',
      summary: (name) => (name ? `Lands in ${name}` : 'Any status'),
    }),
  ]
}
