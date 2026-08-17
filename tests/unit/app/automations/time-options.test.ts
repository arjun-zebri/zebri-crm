/**
 * The shared time-of-day list.
 *
 * Two surfaces render it — the extended forms' Select and the chip
 * popovers' rows — and they must offer the same times with the same
 * labels. The stored value stays 24-hour `HH:MM`, because that is
 * what the handlers write to the database; only the label is 12-hour.
 */
import { describe, expect, it } from 'vitest'

import { formatTimeLabel, timeOptions } from '@/app/(dashboard)/automations/[id]/time-options'

describe('formatTimeLabel', () => {
  it('reads the clock the way an MC says it', () => {
    expect(formatTimeLabel('15:30')).toBe('3:30 pm')
    expect(formatTimeLabel('09:00')).toBe('9:00 am')
  })

  it('calls both ends of the day twelve, not zero', () => {
    expect(formatTimeLabel('00:00')).toBe('12:00 am')
    expect(formatTimeLabel('12:00')).toBe('12:00 pm')
  })

  it('passes an unparseable value straight through', () => {
    expect(formatTimeLabel('')).toBe('')
    expect(formatTimeLabel('later')).toBe('later')
  })
})

describe('timeOptions', () => {
  it('covers the day on the half hour', () => {
    const options = timeOptions()
    expect(options).toHaveLength(48)
    expect(options[0]).toEqual({ value: '00:00', label: '12:00 am' })
    expect(options.at(-1)).toEqual({ value: '23:30', label: '11:30 pm' })
  })

  it('stores 24-hour values, whatever the label says', () => {
    // The handler writes this into `timeline_items.start_time`.
    expect(timeOptions().map((o) => o.value)).toContain('15:30')
  })

  it('keeps an off-the-half-hour value that was already saved', () => {
    // A time from the old free-form input would otherwise vanish from
    // the list, silently rewriting the step the first time its picker
    // was opened.
    const options = timeOptions('14:45')
    expect(options).toHaveLength(49)
    expect(options).toContainEqual({ value: '14:45', label: '2:45 pm' })
  })

  it('does not duplicate a value already on the half hour', () => {
    expect(timeOptions('15:30')).toHaveLength(48)
  })
})
