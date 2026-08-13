/**
 * The per-trigger filter arrays, checked against their own Zod schema.
 *
 * This is the failure mode the sweep keeps hitting: a chip writes a
 * placeholder the trigger's `configSchema` rejects, the dispatcher's
 * `safeParse` fails on the next event, and the automation is silently
 * dead with nothing on screen to say so. Every value a chip can write
 * (its "just added" default and each of its options) has to parse.
 */
import { describe, expect, it } from 'vitest'

import { contactCreatedFilters, contactLinkedFilters } from '@/app/(dashboard)/automations/[id]/contact-filters'
import { coupleStageFilters } from '@/app/(dashboard)/automations/[id]/couple-stage-filters'
import { EVENT_DATE_FILTERS } from '@/app/(dashboard)/automations/[id]/event-date-filters'
import {
  ANNIVERSARY_FILTERS,
  EVENT_CREATED_FILTERS,
  EVENT_UPDATED_FILTERS,
  TIME_AFTER_EVENT_FILTERS,
  TIME_BEFORE_EVENT_FILTERS,
} from '@/app/(dashboard)/automations/[id]/event-row-filters'
import {
  INVOICE_DOC_FILTERS,
  INVOICE_DUE_FILTERS,
  INVOICE_OVERDUE_FILTERS,
  PAYMENT_RECEIVED_FILTERS,
} from '@/app/(dashboard)/automations/[id]/invoice-filters'
import { newEnquiryFilters } from '@/app/(dashboard)/automations/[id]/new-enquiry-filters'
import {
  TIMELINE_EDITED_FILTERS,
  VOWS_FILTERS,
  questionnaireFilters,
  sectionCompletedFilters,
} from '@/app/(dashboard)/automations/[id]/portal-filters'
import {
  taskCompletedFilters,
  taskCreatedFilters,
  taskOverdueFilters,
} from '@/app/(dashboard)/automations/[id]/task-filters'
import {
  activeFilterSummary,
  type TriggerFilterDef,
} from '@/app/(dashboard)/automations/[id]/trigger-filter-list'
import {
  COMPARISON_OPS,
  COMPARISON_OP_LABELS,
  OFFERED_COMPARISON_OPS,
} from '@/lib/automations/trigger-constants'
import { triggerRegistry } from '@/lib/automations/triggers'
import type { AutomationEventRow, TriggerType } from '@/types/automations'

/** Stand-in for the MC's own pipeline, loaded from `couple_statuses`. */
const STATUSES = [
  { slug: 'new', name: 'New enquiry' },
  { slug: 'quoted', name: 'Quoted' },
  { slug: 'booked', name: 'Booked' },
]

/** Stand-ins for the MC's task option tables. */
const PRIORITIES = [
  { value: 'Low', label: 'Low' },
  { value: 'Urgent', label: 'Urgent' },
]
const TYPES = [{ value: 'Ceremony', label: 'Ceremony' }]

/** Stand-in questionnaire templates (uuid values, as the schema wants). */
const TEMPLATES = [
  { value: '7f2c1e58-0000-4000-8000-000000000001', label: 'Wedding basics' },
]

/** Minimal event row for the matcher checks below. */
function payload(body: Record<string, unknown>): AutomationEventRow {
  return { payload: body } as unknown as AutomationEventRow
}

const SUITES: { trigger: TriggerType; filters: TriggerFilterDef[] }[] = [
  { trigger: 'new_enquiry', filters: newEnquiryFilters(STATUSES) },
  { trigger: 'couple_stage_changed', filters: coupleStageFilters(STATUSES) },
  { trigger: 'invoice_created', filters: INVOICE_DOC_FILTERS },
  { trigger: 'invoice_sent', filters: INVOICE_DOC_FILTERS },
  { trigger: 'payment_received', filters: PAYMENT_RECEIVED_FILTERS },
  { trigger: 'invoice_due', filters: INVOICE_DUE_FILTERS },
  { trigger: 'invoice_overdue', filters: INVOICE_OVERDUE_FILTERS },
  { trigger: 'contract_created', filters: EVENT_DATE_FILTERS },
  { trigger: 'contract_signed', filters: EVENT_DATE_FILTERS },
  { trigger: 'event_created', filters: EVENT_CREATED_FILTERS },
  { trigger: 'event_updated', filters: EVENT_UPDATED_FILTERS },
  { trigger: 'time_before_event', filters: TIME_BEFORE_EVENT_FILTERS },
  { trigger: 'time_after_event', filters: TIME_AFTER_EVENT_FILTERS },
  { trigger: 'anniversary_of_event', filters: ANNIVERSARY_FILTERS },
  // Every section, so each per-section sub-filter gets checked too.
  { trigger: 'section_completed', filters: sectionCompletedFilters({}) },
  { trigger: 'section_completed', filters: sectionCompletedFilters({ section: 'people' }) },
  { trigger: 'section_completed', filters: sectionCompletedFilters({ section: 'songs' }) },
  { trigger: 'section_completed', filters: sectionCompletedFilters({ section: 'files' }) },
  { trigger: 'timeline_edited', filters: TIMELINE_EDITED_FILTERS },
  { trigger: 'couple_completed_vows', filters: VOWS_FILTERS },
  { trigger: 'questionnaire_completed', filters: questionnaireFilters(TEMPLATES) },
  { trigger: 'task_created', filters: taskCreatedFilters(PRIORITIES, TYPES) },
  { trigger: 'task_completed', filters: taskCompletedFilters(PRIORITIES, TYPES) },
  { trigger: 'task_overdue', filters: taskOverdueFilters(PRIORITIES, TYPES) },
  { trigger: 'contact_created', filters: contactCreatedFilters },
  { trigger: 'contact_linked_to_couple', filters: contactLinkedFilters },
]

describe.each(SUITES)('$trigger filter definitions', ({ trigger, filters }) => {
  const schema = triggerRegistry[trigger].configSchema

  it('has no duplicate keys', () => {
    const keys = filters.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('seeds a config the trigger schema accepts, for every filter', () => {
    for (const filter of filters) {
      const seeded = filter.add({})
      expect(schema.safeParse(seeded).success, `${filter.key} default`).toBe(true)
      // A filter that doesn't read as active straight after being
      // added makes its own chip vanish on the next render.
      expect(filter.isActive(seeded), `${filter.key} isActive`).toBe(true)
    }
  })

  it('writes a config the trigger schema accepts, for every option', () => {
    for (const filter of filters) {
      for (const option of filter.options ?? []) {
        const written = filter.apply!(filter.add({}), option.value)
        expect(schema.safeParse(written).success, `${filter.key}=${option.value}`).toBe(true)
      }
    }
  })

  it('clears every field it owns on remove', () => {
    for (const filter of filters) {
      const removed = filter.remove(filter.add({ keepMe: 1 }))
      expect(filter.isActive(removed), `${filter.key} still active`).toBe(false)
      expect(removed['keepMe'], `${filter.key} clobbered a sibling`).toBe(1)
    }
  })

  it('labels every filter, set and unset', () => {
    for (const filter of filters) {
      const seeded = filter.add({})
      expect(filter.valueLabel(seeded), `${filter.key} valueLabel`).toBeTruthy()
      expect(filter.summary(seeded), `${filter.key} summary`).toBeTruthy()
    }
  })

  it('offers a picker or a compound control, never neither', () => {
    for (const filter of filters) {
      const hasPicker = Boolean(filter.options && filter.apply)
      expect(hasPicker || Boolean(filter.render), `${filter.key} has no control`).toBe(true)
    }
  })

  it('summarises a required filter before its config is written', () => {
    // A required chip renders from an empty config (it shows its
    // default), so the collapsed card has to describe it too — not
    // fall back to the trigger's generic description.
    const required = filters.filter((f) => f.required)
    if (required.length === 0) return
    const summary = activeFilterSummary(filters, {}, 'FALLBACK')
    expect(summary).not.toBe('FALLBACK')
    for (const filter of required) {
      expect(summary, `${filter.key} missing from summary`).toContain(filter.summary({}))
    }
  })
})

describe('offered comparison operators', () => {
  it('offers "at most", "at least" and "exactly"', () => {
    // `gt` / `lt` are off-by-one twins of the first two. See
    // OFFERED_COMPARISON_OPS.
    expect([...OFFERED_COMPARISON_OPS]).toEqual(['lte', 'gte', 'eq'])
  })

  it('matches on every offered operator', () => {
    const spec = triggerRegistry.invoice_created
    expect(spec.match(payload({ total: 1500 }), { amountOp: 'lte', amountValue: 2000 })).toBe(true)
    expect(spec.match(payload({ total: 2500 }), { amountOp: 'gte', amountValue: 2000 })).toBe(true)
    expect(spec.match(payload({ total: 2000 }), { amountOp: 'eq', amountValue: 2000 })).toBe(true)
    expect(spec.match(payload({ total: 2001 }), { amountOp: 'eq', amountValue: 2000 })).toBe(false)
  })

  it('still matches on the operators that left the picker', () => {
    // Dropping them from the UI must not disable an automation that
    // was already saved with one.
    const spec = triggerRegistry.invoice_created
    for (const op of ['gt', 'lt'] as const) {
      expect(spec.configSchema.safeParse({ amountOp: op, amountValue: 2000 }).success).toBe(true)
    }
    expect(spec.match(payload({ total: 2500 }), { amountOp: 'gt', amountValue: 2000 })).toBe(true)
    expect(spec.match(payload({ total: 2000 }), { amountOp: 'gt', amountValue: 2000 })).toBe(false)
    expect(spec.match(payload({ total: 1500 }), { amountOp: 'lt', amountValue: 2000 })).toBe(true)
  })

  it('labels every operator, including the retired ones', () => {
    // A chip saved with `gt` still has to render "more than 2,000".
    for (const op of COMPARISON_OPS) {
      expect(COMPARISON_OP_LABELS[op]).toBeTruthy()
    }
  })
})

describe('couple_stage_changed filters', () => {
  const filters = coupleStageFilters(STATUSES)

  it('offers both ends of the move, plus the couple-level narrowing', () => {
    expect(filters.map((f) => f.key)).toEqual([
      'toStatus',
      'fromStatus',
      'leadSource',
      'daysUntilEvent',
      'hasEventDate',
      'dayOfWeek',
      'eventMonth',
      'season',
    ])
  })

  it('names the MC’s own stages rather than raw slugs', () => {
    const into = filters.find((f) => f.key === 'toStatus')!
    expect(into.valueLabel({ toStatus: 'booked' })).toBe('Booked')
    expect(into.summary({ toStatus: 'booked' })).toBe('Moves into Booked')
  })

  it('falls back to the slug for a stage the MC has since deleted', () => {
    const into = filters.find((f) => f.key === 'toStatus')!
    expect(into.valueLabel({ toStatus: 'retired_stage' })).toBe('retired_stage')
  })
})
