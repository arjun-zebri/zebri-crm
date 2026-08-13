/**
 * Filter sets for the task triggers: `task_created`, `task_completed`
 * and `task_overdue`.
 *
 * Priority and type options are the MC's own `task_priorities` /
 * `task_types` rows (tasks store the option's display name, so the
 * name is both value and label). The old fixed enums the triggers
 * declared — an invented `taskCategory` list and a hardcoded
 * low/medium/high/urgent — matched nothing the app writes.
 *
 * @module app/(dashboard)/automations/[id]/task-filters
 */
'use client'

import {
  OFFERED_COMPARISON_OPS,
  COMPARISON_OP_LABELS,
} from '@/lib/automations/trigger-constants'

import { ComparisonControl } from './filter-controls'
import type { FilterOptionRow } from './filter-options'
import {
  configString as str,
  fieldFilter,
  type FilterConfig,
  type TriggerFilterDef,
} from './trigger-filter-list'

/** A filter over one of the MC's task option lists (priority / type). */
function taskOptionFilter(
  configKey: 'taskPriority' | 'taskType',
  label: string,
  chipLabel: string,
  options: FilterOptionRow[],
): TriggerFilterDef {
  return {
    key: configKey,
    label,
    chipLabel,
    ...fieldFilter({ [configKey]: '' }),
    current: (config) => str(config, configKey),
    valueLabel: (config) => str(config, configKey) || 'any',
    summary: (config) => {
      const value = str(config, configKey)
      return value ? `${label}: ${value}` : `Any ${chipLabel}`
    },
    options: [{ value: '', label: `Any ${chipLabel}` }, ...options],
    apply: (config, value) => ({ ...config, [configKey]: value }),
  }
}

/** "at most 14 days", or "any" while nothing is chosen. */
function dueInLabel(config: FilterConfig): string {
  const op = str(config, 'dueInDaysOp')
  const value = config['dueInDaysValue']
  if (!op || typeof value !== 'number') return 'any'
  return `${COMPARISON_OP_LABELS[op as never]} ${value} days`
}

const OPS = OFFERED_COMPARISON_OPS.map((o) => ({ value: o, label: COMPARISON_OP_LABELS[o] }))

/** Filters offered on Task created. */
export function taskCreatedFilters(
  priorities: FilterOptionRow[],
  types: FilterOptionRow[],
): TriggerFilterDef[] {
  return [
    taskOptionFilter('taskPriority', 'Priority', 'priority', priorities),
    taskOptionFilter('taskType', 'Type', 'type', types),
    {
      key: 'hasDueDate',
      label: 'Due date',
      chipLabel: 'due date',
      ...fieldFilter({ hasDueDate: true }),
      current: (config) => (config['hasDueDate'] === false ? 'no' : 'yes'),
      valueLabel: (config) => (config['hasDueDate'] === false ? 'not set' : 'set'),
      summary: (config) =>
        config['hasDueDate'] === false ? 'No due date' : 'Has a due date',
      options: [
        { value: 'yes', label: 'Has a due date' },
        { value: 'no', label: 'No due date' },
      ],
      apply: (config, value) => ({ ...config, hasDueDate: value === 'yes' }),
    },
    {
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
    },
  ]
}

/** Filters offered on Task completed: just the option lists. */
export function taskCompletedFilters(
  priorities: FilterOptionRow[],
  types: FilterOptionRow[],
): TriggerFilterDef[] {
  return [
    taskOptionFilter('taskPriority', 'Priority', 'priority', priorities),
    taskOptionFilter('taskType', 'Type', 'type', types),
  ]
}

/** Label for the overdue threshold, e.g. "7 days overdue". */
function overdueLabel(config: FilterConfig): string {
  const raw = config['daysOverdueMin']
  const days = typeof raw === 'number' ? Math.max(1, raw) : 1
  return `${days} day${days === 1 ? '' : 's'} overdue`
}

/**
 * Filters for Task overdue. The threshold is required — it names
 * which overdue-depth event this automation answers.
 */
export function taskOverdueFilters(
  priorities: FilterOptionRow[],
  types: FilterOptionRow[],
): TriggerFilterDef[] {
  return [
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
          onChange={(_op, value) =>
            setConfig({ ...config, daysOverdueMin: Math.max(1, value) })
          }
        />
      ),
    },
    taskOptionFilter('taskPriority', 'Priority', 'priority', priorities),
    taskOptionFilter('taskType', 'Type', 'type', types),
  ]
}
