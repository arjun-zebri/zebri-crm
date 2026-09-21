import { describe, expect, it } from 'vitest'

import { isHeartbeatStale, TICK_STALE_MS } from '@/lib/workflows/heartbeat'

describe('isHeartbeatStale', () => {
  const now = new Date('2026-09-20T10:00:00Z')

  it('treats a missing heartbeat as stale', () => {
    expect(isHeartbeatStale(null, now, TICK_STALE_MS)).toBe(true)
  })

  it('is fresh inside the window and stale past it', () => {
    expect(isHeartbeatStale('2026-09-20T09:30:00Z', now, TICK_STALE_MS)).toBe(false)
    expect(isHeartbeatStale('2026-09-20T09:14:59Z', now, TICK_STALE_MS)).toBe(true)
  })

  it('is 45 minutes: three missed 15-minute ticks', () => {
    expect(TICK_STALE_MS).toBe(45 * 60_000)
  })
})
