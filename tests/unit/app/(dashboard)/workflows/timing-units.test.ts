import { describe, expect, it } from 'vitest'

import {
  SEND_TIME_OPTIONS,
  supportsSendTime,
  switchMode,
  withAmount,
  withSendTime,
  withUnit,
} from '@/app/(dashboard)/workflows/[id]/timing-units'

describe('timing-units', () => {
  it('offers the sentinel plus 96 grid times', () => {
    expect(SEND_TIME_OPTIONS).toHaveLength(97)
    expect(SEND_TIME_OPTIONS[0]).toEqual({ value: 'none', label: 'Start of day' })
    expect(SEND_TIME_OPTIONS[1]).toEqual({ value: '00:00', label: '12:00am' })
    expect(SEND_TIME_OPTIONS[96]).toEqual({ value: '23:45', label: '11:45pm' })
  })

  it('withUnit to minutes snaps the amount to the 15-minute grid', () => {
    expect(withUnit({ mode: 'after_previous', delayAmount: 2, unit: 'hours' }, 'minutes')).toEqual({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' })
    expect(withUnit({ mode: 'apply_relative', amount: 50, unit: 'days' }, 'minutes')).toEqual({ mode: 'apply_relative', amount: 45, unit: 'minutes' })
  })

  it('withUnit to a sub-day unit drops a send time', () => {
    expect(withUnit({ mode: 'apply_relative', amount: 1, unit: 'days', sendTime: '09:00' }, 'hours')).toEqual({ mode: 'apply_relative', amount: 1, unit: 'hours' })
  })

  it('withAmount on minutes rounds to the grid and never below 15', () => {
    expect(withAmount({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' }, 22)).toEqual({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' })
    expect(withAmount({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' }, 0)).toEqual({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' })
    expect(withAmount({ mode: 'after_previous', delayAmount: 1, unit: 'days' }, 0)).toEqual({ mode: 'after_previous', delayAmount: 0, unit: 'days' })
  })

  it('withAmount clamps to what the schema accepts', () => {
    // Non-minutes: round, clamp to MAX_AMOUNT (999).
    expect(withAmount({ mode: 'after_previous', delayAmount: 1, unit: 'days' }, 5000)).toEqual({ mode: 'after_previous', delayAmount: 999, unit: 'days' })
    expect(withAmount({ mode: 'after_previous', delayAmount: 1, unit: 'days' }, 1.5)).toEqual({ mode: 'after_previous', delayAmount: 2, unit: 'days' })
    // Minutes: snap to the 15-minute grid, capped at 990 (the largest
    // multiple of 15 under 999) so the schema never refuses it.
    expect(withAmount({ mode: 'after_previous', delayAmount: 15, unit: 'minutes' }, 5000)).toEqual({ mode: 'after_previous', delayAmount: 990, unit: 'minutes' })
  })

  it('withSendTime sets, and null removes the key entirely', () => {
    const set = withSendTime({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days' }, '09:15')
    expect(set).toEqual({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'days', sendTime: '09:15' })
    const cleared = withSendTime(set, null)
    expect('sendTime' in cleared).toBe(false)
    expect(withSendTime({ mode: 'after_previous', delayAmount: 0, unit: 'days' }, '09:00')).toEqual({ mode: 'after_previous', delayAmount: 0, unit: 'days' })
  })

  it('supportsSendTime is true only for calendar-unit date-relative steps', () => {
    expect(supportsSendTime({ mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'days' })).toBe(true)
    expect(supportsSendTime({ mode: 'apply_relative', amount: 1, unit: 'weeks' })).toBe(true)
    expect(supportsSendTime({ mode: 'apply_relative', amount: 30, unit: 'minutes' })).toBe(false)
    expect(supportsSendTime({ mode: 'after_previous', delayAmount: 0, unit: 'days' })).toBe(false)
  })

  it('switchMode keeps the number where it fits and drops the send time', () => {
    expect(switchMode({ mode: 'wedding_relative', direction: 'before', amount: 2, unit: 'weeks', sendTime: '09:00' }, 'after_previous')).toEqual({ mode: 'after_previous', delayAmount: 2, unit: 'days' })
    expect(switchMode({ mode: 'after_previous', delayAmount: 45, unit: 'minutes' }, 'wedding_relative')).toEqual({ mode: 'wedding_relative', direction: 'before', amount: 45, unit: 'weeks' })
  })
})
