import { describe, expect, it } from 'vitest'

import { isHeartbeatStale, TICK_STALE_MS } from '@/lib/workflows/heartbeat'

describe('isHeartbeatStale', () => {
  const now = new Date('2026-09-20T10:00:00Z')

  it('treats a missing heartbeat as stale', () => {
    expect(isHeartbeatStale(null, now, TICK_STALE_MS)).toBe(true)
  })

  it('is fresh inside the window and stale past it', () => {
    expect(isHeartbeatStale('2026-09-20T09:40:00Z', now, TICK_STALE_MS)).toBe(false)
    expect(isHeartbeatStale('2026-09-20T09:34:59Z', now, TICK_STALE_MS)).toBe(true)
  })

  it('is 25 minutes: past one missed quarter-hour call, the same window as tick_watchdog()', () => {
    expect(TICK_STALE_MS).toBe(25 * 60_000)
  })
})
