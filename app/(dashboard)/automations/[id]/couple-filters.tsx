/**
 * Filters over couple fields that are not the wedding date: where the
 * lead came from, and which pipeline stage it sits in.
 *
 * Both are shared across triggers. Lead source is identical wherever
 * it appears; the stage filter is a factory because one trigger asks
 * it three different ways ("lands in", "moves into", "moves out of")
 * and the options are the MC's own `couple_statuses` rows rather than
 * a fixed enum.
 *
 * @module app/(dashboard)/automations/[id]/couple-filters
 */
'use client'

import { LEAD_SOURCES, LEAD_SOURCE_LABELS } from '@/lib/automations/trigger-constants'

import type { CoupleStatus } from './filter-options'
import {
  configString as str,
  fieldFilter,
  type TriggerFilterDef,
} from './trigger-filter-list'

/**
 * Where the couple came from.
 *
 * The options are the six values the couple modal and `submit_lead()`
 * actually write, re-exported from `types/couple`. The saved value is
 * a plain string rather than an enum member so a config saved against
 * a source that later leaves the list keeps parsing.
 */
export const leadSourceFilter: TriggerFilterDef = {
  key: 'leadSource',
  label: 'Lead source',
  chipLabel: 'source',
  ...fieldFilter({ leadSource: '' }),
  current: (config) => str(config, 'leadSource'),
  valueLabel: (config) => {
    const value = str(config, 'leadSource')
    return value ? (LEAD_SOURCE_LABELS[value as never] ?? value) : 'any'
  },
  summary: (config) => {
    const value = str(config, 'leadSource')
    return value ? `From ${LEAD_SOURCE_LABELS[value as never] ?? value}` : 'Any source'
  },
  options: [
    { value: '', label: 'Any source' },
    ...LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] })),
  ],
  apply: (config, value) => ({ ...config, leadSource: value }),
}

/**
 * A filter over one of the MC's pipeline stages.
 *
 * @param options.configKey - Config field this filter owns, e.g. `toStatus`.
 * @param options.statuses - The MC's `couple_statuses` rows, in board order.
 * @param options.anyLabel - Menu row for "don't narrow", e.g. "Any stage".
 * @param options.summary - Collapsed-card phrase; called with `null`
 *   while the filter is added but no stage has been chosen.
 */
export function coupleStatusFilter(options: {
  configKey: string
  label: string
  chipLabel: string
  statuses: CoupleStatus[]
  anyLabel: string
  summary: (stageName: string | null) => string
}): TriggerFilterDef {
  const { configKey, statuses, anyLabel } = options
  // A saved slug whose status row has since been renamed or deleted
  // falls back to the raw slug rather than rendering blank.
  const nameFor = (slug: string) => statuses.find((s) => s.slug === slug)?.name ?? slug

  return {
    key: configKey,
    label: options.label,
    chipLabel: options.chipLabel,
    ...fieldFilter({ [configKey]: '' }),
    current: (config) => str(config, configKey),
    valueLabel: (config) => {
      const value = str(config, configKey)
      return value ? nameFor(value) : 'any'
    },
    summary: (config) => {
      const value = str(config, configKey)
      return options.summary(value ? nameFor(value) : null)
    },
    options: [
      { value: '', label: anyLabel },
      ...statuses.map((s) => ({ value: s.slug, label: s.name })),
    ],
    apply: (config, value) => ({ ...config, [configKey]: value }),
  }
}
