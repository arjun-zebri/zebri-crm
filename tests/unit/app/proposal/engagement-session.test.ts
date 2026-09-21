import { afterEach, describe, expect, it, vi } from 'vitest'

import { postEvents } from '@/app/proposal/[token]/_components/engagement-post'
import { sessionIdFor, visibleSecondsLedger } from '@/app/proposal/[token]/_components/engagement-session'

const token = '11111111-1111-4111-8111-111111111111'

describe('sessionIdFor', () => {
  // Unstub before clearing: the previous test may have replaced
  // `sessionStorage` with a fake lacking `.clear`, and clearing the real
  // storage only matters once it is back in place.
  afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })
  it('is stable within a tab and per token', () => {
    const a = sessionIdFor(token)
    expect(a).toHaveLength(36)
    expect(sessionIdFor(token)).toBe(a)
    expect(sessionIdFor('22222222-2222-4222-8222-222222222222')).not.toBe(a)
  })
  it('still returns an id when sessionStorage throws', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(sessionIdFor(token).length).toBeGreaterThanOrEqual(8)
  })
})

describe('visibleSecondsLedger', () => {
  it('accumulates whole seconds per id and drains deltas while keeping visible ids running', () => {
    const l = visibleSecondsLedger()
    l.start('a', 0)
    l.start('b', 0)
    l.stop('b', 2500)
    expect(l.drain(10_000)).toEqual([{ id: 'a', seconds: 10 }, { id: 'b', seconds: 2 }])
    expect(l.drain(15_000)).toEqual([{ id: 'a', seconds: 5 }])
    l.stopAll(16_000)
    expect(l.drain(20_000)).toEqual([{ id: 'a', seconds: 1 }])
    expect(l.drain(30_000)).toEqual([])
  })

  it('keeps the original start time when an already-visible id starts again', () => {
    // A real IntersectionObserver can report the same target as intersecting
    // twice with no exit in between, which must not discard accrued time.
    const l = visibleSecondsLedger()
    l.start('a', 0)
    l.start('a', 4_000)
    expect(l.drain(6_000)).toEqual([{ id: 'a', seconds: 6 }])
  })
})

describe('postEvents', () => {
  afterEach(() => vi.unstubAllGlobals())
  const body = { token, sessionId: 'sess-abcdef', events: [{ id: 'ev-1', type: 'opened' as const, payload: {} }] }
  it('uses sendBeacon with a text/plain blob when asked, resolving its own boolean', async () => {
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon })
    await expect(postEvents(body, { beacon: true })).resolves.toBe(true)
    expect(sendBeacon).toHaveBeenCalledWith('/api/proposal/events', expect.any(Blob))
  })
  it('C2: resolves false when sendBeacon itself reports failure', async () => {
    vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => false) })
    await expect(postEvents(body, { beacon: true })).resolves.toBe(false)
  })
  it('falls back to keepalive fetch, resolving true on a 2xx response', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    vi.stubGlobal('fetch', fetch)
    await expect(postEvents(body, { beacon: false })).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/proposal/events', expect.objectContaining({ method: 'POST', keepalive: true }))
  })
  it('C2: resolves false (never throws) on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 429 }))))
    await expect(postEvents(body, { beacon: false })).resolves.toBe(false)
  })
  it('C2: resolves false (never rejects) when the fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    await expect(postEvents(body, { beacon: false })).resolves.toBe(false)
  })
})
