/**
 * Workflow chaining: depth bookkeeping, the `workflow_completed`
 * trigger's matcher, and the "did this step end its workflow" read.
 */
import { describe, expect, it } from 'vitest'

import { triggerRegistry } from '@/lib/automations/triggers'
import {
  chainDepthForEvent,
  chainDepthOf,
  isStartWorkflowStep,
  startedInstanceId,
} from '@/lib/workflows/chain'
import { endsWorkflow } from '@/lib/workflows/end-instance'
import type { AutomationEventRow } from '@/types/automations'

function event(type: string, payload: Record<string, unknown>): AutomationEventRow {
  return { event_type: type, payload } as unknown as AutomationEventRow
}

describe('chainDepthOf', () => {
  it('reads the depth off an instance context, 0 when absent or junk', () => {
    expect(chainDepthOf({ chain_depth: 3, step_outputs: {} })).toBe(3)
    expect(chainDepthOf({})).toBe(0)
    expect(chainDepthOf(null)).toBe(0)
    expect(chainDepthOf({ chain_depth: '3' })).toBe(0)
    expect(chainDepthOf({ chain_depth: -1 })).toBe(0)
  })
})

describe('chainDepthForEvent', () => {
  it('opens the next workflow one level below the one that finished', () => {
    expect(chainDepthForEvent(event('workflow_completed', { chain_depth: 0 }))).toBe(1)
    expect(chainDepthForEvent(event('workflow_completed', { chain_depth: 4 }))).toBe(5)
  })

  it('starts a fresh chain on any other event', () => {
    // A stage change a finished workflow made is not traceable to it.
    expect(chainDepthForEvent(event('couple_stage_changed', { chain_depth: 4 }))).toBe(0)
  })
})

describe('workflow_completed trigger', () => {
  const spec = triggerRegistry.workflow_completed

  it('matches any workflow when none is chosen', () => {
    const config = spec.configSchema.parse({})
    expect(spec.match(event('workflow_completed', { template_id: 'a' }), config)).toBe(true)
  })

  it('matches only the chosen workflow', () => {
    const config = spec.configSchema.parse({ workflow: 'a' })
    expect(spec.match(event('workflow_completed', { template_id: 'a' }), config)).toBe(true)
    expect(spec.match(event('workflow_completed', { template_id: 'b' }), config)).toBe(false)
  })
})

describe('endsWorkflow', () => {
  it('is true only for an output that says so', () => {
    expect(endsWorkflow({ ended_workflow: true, started: true })).toBe(true)
    expect(endsWorkflow({ ended_workflow: false })).toBe(false)
    expect(endsWorkflow({ branch_taken: 'yes' })).toBe(false)
    expect(endsWorkflow(null)).toBe(false)
  })
})

describe('the executor handoff reads', () => {
  it('recognises a stored Start workflow step, and nothing else', () => {
    expect(isStartWorkflowStep({ type: 'action', config: { actionType: 'start_workflow' } })).toBe(true)
    expect(isStartWorkflowStep({ type: 'action', config: { actionType: 'send_email' } })).toBe(false)
    expect(isStartWorkflowStep({ type: 'todo', config: {} })).toBe(false)
  })

  it('names the opened workflow only when one actually started', () => {
    expect(startedInstanceId({ started: true, instance_id: 'i2' })).toBe('i2')
    // Already on the couple, or left paused because it was turned off.
    expect(startedInstanceId({ started: false, reason: 'already_applied' })).toBeNull()
    expect(startedInstanceId({ started: false, instance_id: 'i2' })).toBeNull()
    expect(startedInstanceId(null)).toBeNull()
  })
})
