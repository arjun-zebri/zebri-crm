/**
 * The account-wide stop's pure rules and its single-MC read (Task 18).
 */
import { describe, expect, it } from 'vitest'

import {
  inLiftedPauseWindow,
  isAccountPaused,
  isLiftedPauseBacklog,
  readAccountPause,
} from '@/lib/workflows/account-pause'

const P = '2026-09-20T10:00:00.000Z'
const R = '2026-09-20T12:00:00.000Z'

describe('isAccountPaused', () => {
  it('treats a missing row, or one never paused, as running', () => {
    expect(isAccountPaused(null)).toBe(false)
    expect(isAccountPaused(undefined)).toBe(false)
    expect(isAccountPaused({ pausedAt: null, resumedAt: null })).toBe(false)
  })

  it('is on between the stop and its lift, and off after', () => {
    expect(isAccountPaused({ pausedAt: P, resumedAt: null })).toBe(true)
    expect(isAccountPaused({ pausedAt: P, resumedAt: R })).toBe(false)
  })
})

describe('inLiftedPauseWindow', () => {
  const lifted = { pausedAt: P, resumedAt: R }

  it('includes both ends of the window', () => {
    expect(inLiftedPauseWindow(lifted, P)).toBe(true)
    expect(inLiftedPauseWindow(lifted, '2026-09-20T11:00:00.000Z')).toBe(true)
    expect(inLiftedPauseWindow(lifted, R)).toBe(true)
  })

  it('excludes before the stop and after the lift', () => {
    expect(inLiftedPauseWindow(lifted, '2026-09-20T09:59:59.999Z')).toBe(false)
    expect(inLiftedPauseWindow(lifted, '2026-09-20T12:00:00.001Z')).toBe(false)
  })

  it('has no window while the stop is still on, or with no due date', () => {
    expect(inLiftedPauseWindow({ pausedAt: P, resumedAt: null }, P)).toBe(false)
    expect(inLiftedPauseWindow(lifted, null)).toBe(false)
    expect(inLiftedPauseWindow(null, P)).toBe(false)
  })
})

/** A fake client answering the one query `readAccountPause` makes. */
function client(answer: () => Promise<unknown>) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: answer,
  }
  return { from: () => chain } as never
}

describe('readAccountPause', () => {
  it('reads paused, running, and a missing row as running', async () => {
    const row = (paused: string | null, resumed: string | null) =>
      client(async () => ({
        data: { user_id: 'u', workflows_paused_at: paused, workflows_resumed_at: resumed },
        error: null,
      }))
    expect(await readAccountPause(row(P, null), 'u')).toEqual({ status: 'paused' })
    expect(await readAccountPause(row(P, R), 'u')).toEqual({ status: 'running' })
    expect(
      await readAccountPause(client(async () => ({ data: null, error: null })), 'u'),
    ).toEqual({ status: 'running' })
  })

  it('reports an error result as unknown, never as running', async () => {
    const res = await readAccountPause(
      client(async () => ({ data: null, error: { message: 'boom' } })),
      'u',
    )
    expect(res).toEqual({ status: 'unknown', reason: 'boom' })
  })

  it('reports a thrown read as unknown rather than throwing into the send', async () => {
    const res = await readAccountPause(
      client(async () => {
        throw new Error('socket hang up')
      }),
      'u',
    )
    expect(res).toEqual({ status: 'unknown', reason: 'socket hang up' })
  })
})

describe('isLiftedPauseBacklog (fix round 1)', () => {
  const lifted = { pausedAt: P, resumedAt: R }
  const due = '2026-09-20T11:00:00.000Z'

  it('is backlog when due inside the window and last written before the lift', () => {
    expect(isLiftedPauseBacklog(lifted, { due_at: due, updated_at: '2026-09-20T11:30:00.000Z' })).toBe(true)
    expect(isLiftedPauseBacklog(lifted, { due_at: due, updated_at: R })).toBe(true)
  })

  it('is not backlog when the row was dated after the lift, whatever its due time', () => {
    expect(isLiftedPauseBacklog(lifted, { due_at: due, updated_at: '2026-09-20T12:00:01.000Z' })).toBe(false)
  })

  it('is not backlog outside the window', () => {
    expect(
      isLiftedPauseBacklog(lifted, { due_at: '2026-09-20T13:00:00.000Z', updated_at: P }),
    ).toBe(false)
  })
})
