/**
 * Filter set for the `workflow_completed` trigger: which workflow
 * finishing starts this one.
 *
 * Optional, like the questionnaire filter it mirrors: no choice means
 * "any workflow". The dispatcher never starts a workflow on its own
 * completion (`lib/workflows/chain`), so the workflow being edited is
 * left out of the list rather than offered as a choice that never fires.
 *
 * @module app/(dashboard)/workflows/[id]/workflow-filters
 */

import { configString as str, fieldFilter, type TriggerFilterDef } from './filter-list'
import type { FilterOptionRow } from './filter-options'

/**
 * Build the "Which workflow" filter from the MC's workflows.
 *
 * @param workflows - the MC's workflows (id + name)
 * @param selfId - the workflow being edited, left out of the choices
 */
export function workflowCompletedFilters(
  workflows: FilterOptionRow[],
  selfId: string | undefined,
): TriggerFilterDef[] {
  const nameFor = (id: string) => workflows.find((w) => w.value === id)?.label ?? 'a deleted workflow'
  return [
    {
      key: 'workflow',
      label: 'Which workflow',
      chipLabel: 'workflow',
      ...fieldFilter({ workflow: '' }),
      current: (config) => str(config, 'workflow'),
      valueLabel: (config) => {
        const value = str(config, 'workflow')
        return value ? nameFor(value) : 'any'
      },
      summary: (config) => {
        const value = str(config, 'workflow')
        return value ? `After ${nameFor(value)}` : 'After any workflow'
      },
      options: [
        { value: '', label: 'Any workflow' },
        ...workflows.filter((w) => w.value !== selfId),
      ],
      apply: (config, value) => ({ ...config, workflow: value }),
    },
  ]
}
