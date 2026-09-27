/**
 * A relative-date Wait in months (owner ruling 2026-09-27, wait block).
 *
 * "1 month before the event" is calendar-month arithmetic on the event
 * date, clamped to the end of a shorter month (31 March minus 1 month is
 * the last day of February), then the same 09:00 wake every relative unit
 * uses. The SQL recompute (`_workflow_wait_relative_wake`) mirrors it and
 * is pinned by an integration test.
 */
import { describe, expect, it } from 'vitest'

import { computeWaitWakeAt, waitConfigSchema } from '@/lib/automations/conditions'
import type { WaitActionConfig } from '@/types/automations'

function monthsWait(amount: number, direction: 'before' | 'after'): WaitActionConfig {
  return {
    mode: 'relative_to_event',
    relative: { amount, unit: 'months', direction, anchor: 'event_date' },
  }
}

/** The wake for a months wait on this event date. */
function wake(eventDate: string, amount: number, direction: 'before' | 'after'): Date {
  return computeWaitWakeAt(monthsWait(amount, direction), { couple: { eventDate } }, new Date('2020-01-01T00:00:00Z'))
}

/** 09:00 on a date, the way every relative unit resolves it. */
const nineAm = (date: string) => new Date(`${date}T09:00:00`)

describe('a relative-date Wait in months', () => {
  it('is accepted by the runner schema', () => {
    expect(waitConfigSchema.safeParse(monthsWait(3, 'before')).success).toBe(true)
  })

  it('moves 1 and 3 calendar months before the event', () => {
    expect(wake('2027-06-15', 1, 'before')).toEqual(nineAm('2027-05-15'))
    expect(wake('2027-06-15', 3, 'before')).toEqual(nineAm('2027-03-15'))
  })

  it('moves 1 and 3 calendar months after the event', () => {
    expect(wake('2027-06-15', 1, 'after')).toEqual(nineAm('2027-07-15'))
    expect(wake('2027-11-15', 3, 'after')).toEqual(nineAm('2028-02-15'))
  })

  it('clamps to the end of a shorter month', () => {
    expect(wake('2027-03-31', 1, 'before')).toEqual(nineAm('2027-02-28'))
    expect(wake('2027-05-31', 1, 'after')).toEqual(nineAm('2027-06-30'))
  })

  it('lands on 29 February in a leap year', () => {
    expect(wake('2028-03-31', 1, 'before')).toEqual(nineAm('2028-02-29'))
    expect(wake('2027-11-29', 3, 'after')).toEqual(nineAm('2028-02-29'))
  })
})
