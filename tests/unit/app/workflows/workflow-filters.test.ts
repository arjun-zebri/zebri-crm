/**
 * The Workflow completed trigger's "Which workflow" chip.
 *
 * Optional ("any workflow" when unset), and never offers the workflow
 * being edited: the dispatcher never starts a workflow on its own
 * completion, so offering it would be a choice that silently never fires.
 */
import { describe, expect, it } from 'vitest'

import { workflowCompletedFilters } from '@/app/(dashboard)/workflows/[id]/workflow-filters'

const WORKFLOWS = [
  { value: 'booked', label: 'Booked' },
  { value: 'planning', label: 'Planning' },
]

describe('workflowCompletedFilters', () => {
  it('offers "any" plus every other workflow, never the one being edited', () => {
    const [chip] = workflowCompletedFilters(WORKFLOWS, 'planning')
    expect(chip!.options).toEqual([
      { value: '', label: 'Any workflow' },
      { value: 'booked', label: 'Booked' },
    ])
  })

  it('summarises the choice, and a deleted one, in words', () => {
    const [chip] = workflowCompletedFilters(WORKFLOWS, undefined)
    expect(chip!.summary({})).toBe('After any workflow')
    expect(chip!.summary({ workflow: 'booked' })).toBe('After Booked')
    expect(chip!.summary({ workflow: 'gone' })).toBe('After a deleted workflow')
  })

  it('writes the chosen id into the config', () => {
    const [chip] = workflowCompletedFilters(WORKFLOWS, undefined)
    expect(chip!.apply!({ other: 1 }, 'booked')).toEqual({ other: 1, workflow: 'booked' })
  })
})
