/**
 * The SQL wake of a relative-date Wait in months (owner ruling
 * 2026-09-27, wait block).
 *
 * When a wedding moves, `_workflow_recompute_wedding_steps` re-derives a
 * sleeping relative-date Wait's wake with `_workflow_wait_relative_wake`.
 * It has to agree with `computeWaitWakeAt` on the production runtime
 * (09:00 UTC on the shifted date), or every recompute would move the
 * wake. Before 20261024600000 it returned null for `months`, so a months
 * Wait kept its old wake when the wedding moved.
 */
import { describe, expect, it } from 'vitest'

import { runSql } from '../helpers/sql'

/** The SQL wake, as an ISO instant, or '' for null. */
function sqlWake(amount: number, direction: 'before' | 'after', eventDate: string): string {
  const config = JSON.stringify({
    mode: 'relative_to_event',
    relative: { amount, unit: 'months', direction, anchor: 'event_date' },
  })
  return runSql(
    `select to_char(public._workflow_wait_relative_wake('${config}'::jsonb, date '${eventDate}') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS');`,
  )
}

describe('_workflow_wait_relative_wake in months', () => {
  it('moves 1 and 3 calendar months before and after the event, at 09:00 UTC', () => {
    expect(sqlWake(1, 'before', '2027-06-15')).toBe('2027-05-15T09:00:00')
    expect(sqlWake(3, 'before', '2027-06-15')).toBe('2027-03-15T09:00:00')
    expect(sqlWake(1, 'after', '2027-06-15')).toBe('2027-07-15T09:00:00')
    expect(sqlWake(3, 'after', '2027-11-15')).toBe('2028-02-15T09:00:00')
  })

  it('clamps to the end of a shorter month, and to 29 February in a leap year', () => {
    expect(sqlWake(1, 'before', '2027-03-31')).toBe('2027-02-28T09:00:00')
    expect(sqlWake(1, 'before', '2028-03-31')).toBe('2028-02-29T09:00:00')
    expect(sqlWake(3, 'after', '2027-11-29')).toBe('2028-02-29T09:00:00')
  })

  it('still derives the other units as before', () => {
    const config = JSON.stringify({
      mode: 'relative_to_event',
      relative: { amount: 2, unit: 'weeks', direction: 'before', anchor: 'event_date' },
    })
    expect(
      runSql(
        `select to_char(public._workflow_wait_relative_wake('${config}'::jsonb, date '2027-06-15') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS');`,
      ),
    ).toBe('2027-06-01T09:00:00')
  })
})
