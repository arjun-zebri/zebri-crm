/**
 * The Wait step's chip config, checked against the runner's own
 * `waitConfigSchema` — the same contract the trigger defs test pins
 * against the dispatcher: every value a chip can write must parse, or
 * the run fails with a config error at execution time.
 */
import { describe, expect, it } from 'vitest'

import { WAIT_CHIPS } from '@/app/(dashboard)/automations/[id]/wait-chips'
import { waitConfigSchema } from '@/lib/automations/conditions'

const waitChip = WAIT_CHIPS.find((c) => c.key === 'wait')!
const quietChip = WAIT_CHIPS.find((c) => c.key === 'respectQuietHours')!

describe('wait chips', () => {
  it('seed a config the runner schema accepts', () => {
    expect(waitConfigSchema.safeParse(waitChip.add({})).success).toBe(true)
    expect(waitConfigSchema.safeParse(quietChip.add(waitChip.add({}))).success).toBe(true)
  })

  it('labels the default wait the way the collapsed card does', () => {
    expect(waitChip.summary(waitChip.add({}))).toBe('1 day later')
  })

  it('every quiet-hours option writes a parseable value', () => {
    const base = waitChip.add({})
    for (const option of quietChip.options ?? []) {
      const written = quietChip.apply!(quietChip.add(base), option.value)
      expect(waitConfigSchema.safeParse(written).success, option.value).toBe(true)
    }
  })

  it('the wait chip is required and the quiet chip is not', () => {
    expect(waitChip.required).toBe(true)
    expect(quietChip.required).toBeUndefined()
  })

  it('summarises each mode', () => {
    expect(waitChip.summary({ mode: 'duration', durationMinutes: 60 * 24 * 7 })).toBe(
      '1 week later',
    )
    expect(waitChip.summary({ mode: 'until_date', untilDate: '2027-01-03' })).toBe(
      'on 2027-01-03',
    )
    expect(
      waitChip.summary({
        mode: 'relative_to_event',
        relative: { amount: 2, unit: 'weeks', direction: 'before', anchor: 'event_date' },
      }),
    ).toBe('2 weeks before the event')
  })
})
