/**
 * Resume-partition tests.
 *
 * Pausing collapses `running` + `waiting` runs into `paused`; resume
 * must reconstruct the right target so a scheduled wait isn't skipped
 * (double-fire) and a mid-flight run isn't stranded in `waiting` with
 * no wait row. These lock that split.
 */
import { describe, expect, it } from 'vitest'

import { partitionResume } from '@/lib/automations/run-controls'

describe('partitionResume', () => {
  it('sends runs with a pending wait back to waiting, the rest to running', () => {
    const { toWaiting, toRunning } = partitionResume(['r1', 'r2', 'r3'], ['r2'])
    expect(toWaiting).toEqual(['r2'])
    expect(toRunning).toEqual(['r1', 'r3'])
  })

  it('sends everything to running when no waits are pending', () => {
    const { toWaiting, toRunning } = partitionResume(['r1', 'r2'], [])
    expect(toWaiting).toEqual([])
    expect(toRunning).toEqual(['r1', 'r2'])
  })

  it('sends everything to waiting when all have pending waits', () => {
    const { toWaiting, toRunning } = partitionResume(['r1', 'r2'], ['r1', 'r2'])
    expect(toWaiting).toEqual(['r1', 'r2'])
    expect(toRunning).toEqual([])
  })

  it('ignores wait ids that are not in the paused set', () => {
    const { toWaiting, toRunning } = partitionResume(['r1'], ['r1', 'stale-id'])
    expect(toWaiting).toEqual(['r1'])
    expect(toRunning).toEqual([])
  })

  it('handles an empty paused set', () => {
    expect(partitionResume([], ['r1'])).toEqual({ toWaiting: [], toRunning: [] })
  })
})
