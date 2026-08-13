/**
 * Expanded contents of the trigger step card: the "Only when" filter
 * chips.
 *
 * Triggers not yet migrated to the chip model fall back to the legacy
 * inspector form, so every trigger stays configurable during the
 * per-trigger sweep.
 *
 * @module app/(dashboard)/automations/[id]/trigger-card-body
 */
'use client'

import { useMemo } from 'react'

import type { TriggerType } from '@/types/automations'

import { contactCreatedFilters, contactLinkedFilters } from './contact-filters'
import { coupleStageFilters } from './couple-stage-filters'
import { EVENT_DATE_FILTERS } from './event-date-filters'
import {
  ANNIVERSARY_FILTERS,
  EVENT_CREATED_FILTERS,
  EVENT_UPDATED_FILTERS,
  TIME_AFTER_EVENT_FILTERS,
  TIME_BEFORE_EVENT_FILTERS,
} from './event-row-filters'
import {
  useCoupleStatuses,
  useQuestionnaireTemplateOptions,
  useTaskPriorityOptions,
  useTaskTypeOptions,
  type FilterOptionRow,
  type CoupleStatus,
} from './filter-options'
import { StepConfigForm } from './inspector-panel'
import {
  INVOICE_DOC_FILTERS,
  INVOICE_DUE_FILTERS,
  INVOICE_OVERDUE_FILTERS,
  PAYMENT_RECEIVED_FILTERS,
} from './invoice-filters'
import { newEnquiryFilters } from './new-enquiry-filters'
import {
  TIMELINE_EDITED_FILTERS,
  VOWS_FILTERS,
  questionnaireFilters,
  sectionCompletedFilters,
} from './portal-filters'
import { taskCompletedFilters, taskCreatedFilters, taskOverdueFilters } from './task-filters'
import {
  TriggerFilterList,
  activeFilterSummary,
  type FilterConfig,
  type TriggerFilterDef,
} from './trigger-filter-list'

/** Everything a filter builder might need options from. */
interface FilterOptionSources {
  statuses: CoupleStatus[]
  taskPriorities: FilterOptionRow[]
  taskTypes: FilterOptionRow[]
  questionnaireTemplates: FilterOptionRow[]
  /**
   * The trigger's saved config. Only for builders whose available
   * filters depend on a choice already made — `section_completed`
   * offers a file-size filter only once the section is Files.
   */
  config: FilterConfig
}

/**
 * Triggers whose config is fully expressed as filter chips — since the
 * 2026-08-13 sweep, that is every launch-visible trigger. Anything
 * absent here (hidden types on old automations) falls back to the
 * legacy inspector form.
 */
const CHIP_TRIGGERS: Partial<
  Record<TriggerType, (src: FilterOptionSources) => TriggerFilterDef[]>
> = {
  new_enquiry: (src) => newEnquiryFilters(src.statuses),
  couple_stage_changed: (src) => coupleStageFilters(src.statuses),
  // Money
  invoice_created: () => INVOICE_DOC_FILTERS,
  invoice_sent: () => INVOICE_DOC_FILTERS,
  payment_received: () => PAYMENT_RECEIVED_FILTERS,
  invoice_due: () => INVOICE_DUE_FILTERS,
  invoice_overdue: () => INVOICE_OVERDUE_FILTERS,
  // Contracts narrow on the one thing their payloads carry beyond
  // identifiers: the couple's wedding date.
  contract_created: () => EVENT_DATE_FILTERS,
  contract_sent: () => EVENT_DATE_FILTERS,
  contract_signed: () => EVENT_DATE_FILTERS,
  contract_declined: () => EVENT_DATE_FILTERS,
  contract_expired: () => EVENT_DATE_FILTERS,
  // Events + calendar
  event_created: () => EVENT_CREATED_FILTERS,
  event_updated: () => EVENT_UPDATED_FILTERS,
  time_before_event: () => TIME_BEFORE_EVENT_FILTERS,
  time_after_event: () => TIME_AFTER_EVENT_FILTERS,
  anniversary_of_event: () => ANNIVERSARY_FILTERS,
  // Portal
  // Its sub-filters depend on the chosen section, so it reads the
  // config. `couple_uploaded_file` / `couple_added_song_to_playlist`
  // are absent: they folded into this one.
  section_completed: (src) => sectionCompletedFilters(src.config),
  timeline_edited: () => TIMELINE_EDITED_FILTERS,
  couple_completed_vows: () => VOWS_FILTERS,
  questionnaire_completed: (src) => questionnaireFilters(src.questionnaireTemplates),
  // Tasks + contacts
  task_created: (src) => taskCreatedFilters(src.taskPriorities, src.taskTypes),
  task_completed: (src) => taskCompletedFilters(src.taskPriorities, src.taskTypes),
  task_overdue: (src) => taskOverdueFilters(src.taskPriorities, src.taskTypes),
  contact_created: () => contactCreatedFilters,
  contact_linked_to_couple: () => contactLinkedFilters,
}

/** Shared empty result, so the no-filters case keeps a stable identity. */
const NO_FILTERS: TriggerFilterDef[] = []

/**
 * Filter definitions for a trigger, including the ones whose options
 * come from the user's own data. Returns `[]` for a trigger still on
 * the legacy form.
 *
 * The result must be referentially stable across renders. The canvas
 * derives its node array from it, and a fresh array each render made
 * that memo recompute forever, which React Flow's store surfaced as
 * "Maximum update depth exceeded".
 *
 * All four option sources load unconditionally (hooks can't be
 * conditional); each is one tiny select over the MC's own rows.
 */
export function useTriggerFilters(
  triggerType: TriggerType,
  config: FilterConfig,
): TriggerFilterDef[] {
  const statuses = useCoupleStatuses()
  const taskPriorities = useTaskPriorityOptions()
  const taskTypes = useTaskTypeOptions()
  const questionnaireTemplates = useQuestionnaireTemplateOptions()
  // `config` itself is a new object on every keystroke, so the memo
  // keys off the one field any builder branches on. Depending on the
  // whole object would rebuild the array constantly and set the node
  // memo recomputing — the "Maximum update depth exceeded" trap.
  const section = typeof config['section'] === 'string' ? config['section'] : ''
  return useMemo(() => {
    const build = CHIP_TRIGGERS[triggerType]
    if (!build) return NO_FILTERS
    return build({
      statuses,
      taskPriorities,
      taskTypes,
      questionnaireTemplates,
      config: { section },
    })
  }, [triggerType, statuses, taskPriorities, taskTypes, questionnaireTemplates, section])
}

/**
 * One-line description of what the trigger currently narrows to,
 * shown under the title when the card is collapsed.
 */
export function triggerSummaryLine(
  filters: TriggerFilterDef[],
  config: FilterConfig,
  fallback: string,
): string {
  if (filters.length === 0) return fallback
  return activeFilterSummary(filters, config, fallback)
}

export function TriggerCardBody({
  automationId,
  triggerType,
  config,
  filters,
  onConfigChange,
}: {
  automationId: string
  triggerType: TriggerType
  config: FilterConfig
  filters: TriggerFilterDef[]
  onConfigChange: (config: FilterConfig) => void
}) {
  if (filters.length === 0) {
    return (
      <StepConfigForm
        selection={{ kind: 'trigger', triggerType, triggerConfig: config }}
        automationId={automationId}
        onSaved={(payload) => {
          if (payload.kind === 'trigger') onConfigChange(payload.triggerConfig)
        }}
      />
    )
  }

  return (
    <div className="space-y-2">
      {/* Sentence case, no letter-spacing: uppercase + tracking reads as
          a section heading and shouted louder than the trigger name
          above it. The type scale has no caption size, so quieting it
          is a matter of case and colour, not a smaller font. */}
      <div className="text-body text-text-subtle">Only when</div>
      <TriggerFilterList filters={filters} config={config} setConfig={onConfigChange} />
    </div>
  )
}
