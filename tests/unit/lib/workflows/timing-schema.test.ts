import { describe, expect, it } from 'vitest'

import { MAX_AMOUNT, parseStepTiming, SEND_TIME_PATTERN, stepTimingSchema } from '@/lib/workflows/timing-schema'

describe('stepTimingSchema', () => {
  it('accepts the three legacy shapes unchanged', () => {
    expect(stepTimingSchema.safeParse({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: 3, unit: 'days' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'after_previous', delayAmount: 2, unit: 'hours' }).success).toBe(true)
  })

  it('accepts minutes in 15-minute steps on the two delay modes', () => {
    expect(stepTimingSchema.safeParse({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: 30, unit: 'minutes' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'after_previous', delayAmount: 20, unit: 'minutes' }).success).toBe(false)
    expect(stepTimingSchema.safeParse({ mode: 'wedding_relative', direction: 'before', amount: 15, unit: 'minutes' }).success).toBe(false)
  })

  it('accepts a send time on the 15-minute grid for date-relative steps', () => {
    expect(stepTimingSchema.safeParse({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: 1, unit: 'weeks', sendTime: '17:00' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:10' }).success).toBe(false)
    expect(stepTimingSchema.safeParse({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '9:15' }).success).toBe(false)
  })

  it('rejects a send time on a sub-day delay and on after_previous', () => {
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: 30, unit: 'minutes', sendTime: '09:00' }).success).toBe(false)
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: 2, unit: 'hours', sendTime: '09:00' }).success).toBe(false)
    expect(stepTimingSchema.safeParse({ mode: 'after_previous', delayAmount: 1, unit: 'days', sendTime: '09:00' }).success).toBe(false)
  })

  it('parseStepTiming returns a readable error', () => {
    const r = parseStepTiming({ mode: 'after_previous', delayAmount: 20, unit: 'minutes' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/multiple of 15/)
  })

  it('MAX_AMOUNT is the schema\'s own ceiling', () => {
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: MAX_AMOUNT, unit: 'days' }).success).toBe(true)
    expect(stepTimingSchema.safeParse({ mode: 'apply_relative', amount: MAX_AMOUNT + 1, unit: 'days' }).success).toBe(false)
  })

  it('SEND_TIME_PATTERN covers the whole day on the grid', () => {
    expect('00:00').toMatch(SEND_TIME_PATTERN)
    expect('23:45').toMatch(SEND_TIME_PATTERN)
    expect('24:00').not.toMatch(SEND_TIME_PATTERN)
  })
})
