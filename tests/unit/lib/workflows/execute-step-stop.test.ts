/**
 * A Stop step already saved on a couple's running workflow (Phase 6
 * residual pass, F2).
 *
 * Stop was removed from the picker, but instances copied before then can
 * still hold one. It keeps erroring at send (skipping it would run the
 * steps behind it, which the MC meant to stop), with the sentence the
 * product now uses rather than a developer string.
 */
import { describe, expect, it } from 'vitest'

import { executeStep } from '@/lib/workflows/execute-step'
import type { RunContext } from '@/types/automations'
import type { WorkflowStepRow } from '@/types/workflows'

const STOP_TEXT = "Stop isn't a step Zebri runs. Remove it; a workflow ends once its last step is done."

describe('a saved Stop step at send', () => {
  it('errors with the honest sentence, not "unknown action stop"', async () => {
    const step = {
      id: 's1',
      instance_id: 'i1',
      type: 'action',
      title: 'Stop',
      config: { actionType: 'stop' },
    } as unknown as WorkflowStepRow

    const outcome = await executeStep(step, {} as RunContext, null)

    expect(outcome.result).toEqual({ kind: 'error', message: STOP_TEXT })
  })
})
