/**
 * A Wait's one number (wait card simplification).
 *
 * A Wait used to carry a generic start offset as well as its own
 * duration, and the engine waited for both. The save now folds the
 * offset into the duration, so the total delay is unchanged, and drops
 * the review flag. The SQL data fix mirrors these same cases.
 */
import { describe, expect, it } from 'vitest'

import { waitConfigSchema } from '@/lib/automations/conditions'
import {
  WAIT_MAX_MINUTES,
  WAIT_TIMING,
  foldWaitConfig,
  normalizeWaitStep,
  type WaitStepSave,
} from '@/lib/workflows/wait-step'

const DAY = 60 * 24

describe('foldWaitConfig', () => {
  it('adds an "after the step above" delay to the duration', () => {
    expect(
      foldWaitConfig(
        { mode: 'duration', durationMinutes: DAY, respectQuietHours: false },
        { mode: 'after_previous', delayAmount: 2, unit: 'days' },
      ),
    ).toEqual({ mode: 'duration', durationMinutes: 3 * DAY, respectQuietHours: false })
  })

  it('adds a sub-day delay in its own unit', () => {
    expect(
      foldWaitConfig(
        { mode: 'duration', durationMinutes: 60 },
        { mode: 'after_previous', delayAmount: 30, unit: 'minutes' },
      ),
    ).toEqual({ mode: 'duration', durationMinutes: 90 })
  })

  it('adds a delay from the start of the workflow', () => {
    expect(
      foldWaitConfig(
        { mode: 'duration', durationMinutes: 60 },
        { mode: 'apply_relative', amount: 3, unit: 'hours' },
      ),
    ).toEqual({ mode: 'duration', durationMinutes: 240 })
  })

  it('turns a wedding-anchored start into a wait relative to the event', () => {
    const folded = foldWaitConfig(
      { mode: 'duration', durationMinutes: DAY },
      { mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' },
    )
    expect(folded).toEqual({
      mode: 'relative_to_event',
      relative: { amount: 13, unit: 'days', direction: 'before', anchor: 'event_date' },
    })
    expect(waitConfigSchema.safeParse(folded).success).toBe(true)
  })

  it('leaves a date wait alone: it ends on its date whenever it starts', () => {
    const config = { mode: 'until_date', untilDate: '2027-01-03' }
    expect(foldWaitConfig(config, { mode: 'after_previous', delayAmount: 2, unit: 'days' })).toEqual(config)
  })

  it('caps the folded duration at the longest wait the runner accepts', () => {
    const folded = foldWaitConfig(
      { mode: 'duration', durationMinutes: 300 * DAY },
      { mode: 'after_previous', delayAmount: 999, unit: 'days' },
    )
    expect(folded['durationMinutes']).toBe(WAIT_MAX_MINUTES)
    expect(waitConfigSchema.safeParse(folded).success).toBe(true)
  })

  it('changes nothing on a wait that already starts straight after the step above', () => {
    const config = { mode: 'duration', durationMinutes: DAY }
    expect(foldWaitConfig(config, WAIT_TIMING)).toEqual(config)
  })
})

describe('normalizeWaitStep (the save normalisation)', () => {
  it('folds the offset, zeroes the timing and clears the review flag on a Wait', () => {
    expect(
      normalizeWaitStep({
        type: 'wait',
        config: { mode: 'duration', durationMinutes: DAY },
        timing: { mode: 'after_previous', delayAmount: 1, unit: 'days' },
        requiresApproval: true,
      }),
    ).toEqual({
      type: 'wait',
      config: { mode: 'duration', durationMinutes: 2 * DAY },
      timing: WAIT_TIMING,
      requiresApproval: false,
    })
  })

  it('leaves the stored timing alone when the save does not send one', () => {
    const out: WaitStepSave = normalizeWaitStep({ type: 'wait', config: { mode: 'duration', durationMinutes: 60 } })
    expect(out.timing).toBeUndefined()
    expect(out.config).toEqual({ mode: 'duration', durationMinutes: 60 })
  })

  it('leaves every other step type exactly as it was', () => {
    const save = {
      type: 'action',
      config: { actionType: 'send_email' },
      timing: { mode: 'after_previous', delayAmount: 2, unit: 'days' },
      requiresApproval: true,
    }
    expect(normalizeWaitStep(save)).toBe(save)
  })
})
