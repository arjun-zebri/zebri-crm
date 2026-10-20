/**
 * The SQL wake of a relative-date Wait agrees with the runner, at 9am in
 * the MC's timezone (owner report, 2026-10-20).
 *
 * `_workflow_recompute_wedding_steps` re-derives a sleeping relative wait
 * with `_workflow_wait_relative_wake_local` (20261101000000). If it
 * disagreed with `computeWaitWakeAt` by so much as a second, every
 * recompute would move the wake. Both used to say 09:00 UTC, which is
 * 8pm in Sydney.
 */
import { describe, expect, it } from 'vitest'

import { computeWaitWakeAt } from '@/lib/automations/conditions'
import type { WaitActionConfig } from '@/types/automations'

import { runSql } from '../helpers/sql'

type Unit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months'

function config(amount: number, unit: Unit, direction: 'before' | 'after'): WaitActionConfig {
  return { mode: 'relative_to_event', relative: { amount, unit, direction, anchor: 'event_date' } }
}

/** The SQL wake as an ISO instant, or '' for null. */
function sqlWake(c: WaitActionConfig, eventDate: string, timezone: string): string {
  return runSql(
    `select to_char(public._workflow_wait_relative_wake_local('${JSON.stringify(c)}'::jsonb, date '${eventDate}', '${timezone}') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"');`,
  )
}

/** The runner's wake for the same wait. */
function tsWake(c: WaitActionConfig, eventDate: string, timezone: string): string {
  return computeWaitWakeAt(c, { couple: { eventDate }, timezone }, new Date('2020-01-01T00:00:00Z')).toISOString()
}

describe('_workflow_wait_relative_wake_local', () => {
  it('wakes at 9am Sydney time, not 9am UTC', () => {
    // 6 months before 27 Apr 2027 is 27 Oct 2026, daylight time (UTC+11).
    expect(sqlWake(config(6, 'months', 'before'), '2027-04-27', 'Australia/Sydney')).toBe(
      '2026-10-26T22:00:00.000Z',
    )
  })

  it('matches computeWaitWakeAt for every unit, both directions, across daylight saving', () => {
    const cases: [number, Unit][] = [
      [30, 'minutes'],
      [5, 'hours'],
      [1, 'days'],
      [10, 'days'],
      [1, 'weeks'],
      [6, 'weeks'],
      [1, 'months'],
      [5, 'months'],
      [10, 'months'],
    ]
    // 10 Apr 2027 sits just after Sydney leaves daylight time (4 Apr);
    // 31 Mar exercises month-end clamping; Perth has no daylight saving.
    const dates = ['2027-04-10', '2027-03-31', '2026-12-05']
    const zones = ['Australia/Sydney', 'Australia/Perth']
    for (const [amount, unit] of cases) {
      for (const direction of ['before', 'after'] as const) {
        for (const date of dates) {
          for (const zone of zones) {
            const c = config(amount, unit, direction)
            expect(sqlWake(c, date, zone), `${amount} ${unit} ${direction} ${date} ${zone}`).toBe(
              tsWake(c, date, zone),
            )
          }
        }
      }
    }
  })

  it('is null without a wedding date, so the recompute leaves a parked wait parked', () => {
    expect(
      runSql(
        `select coalesce(public._workflow_wait_relative_wake_local('${JSON.stringify(config(1, 'months', 'before'))}'::jsonb, null, 'Australia/Sydney')::text, 'null');`,
      ),
    ).toBe('null')
  })
})
