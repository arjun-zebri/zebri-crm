/**
 * `parseSchedulerStatus`: the jsonb from `scheduler_status()` becomes the
 * typed shape the Admin card renders, and anything malformed reads as an
 * unconfigured scheduler rather than a crash.
 */
import { describe, expect, it } from 'vitest'

import { parseSchedulerStatus } from '@/lib/admin/scheduler'

describe('parseSchedulerStatus', () => {
  it('reads the RPC shape and defaults anything missing', () => {
    const status = parseSchedulerStatus({
      configured: true,
      base_url: 'https://app.zebri.com.au',
      jobs: [
        {
          name: 'zebri:automations-tick',
          schedule: '*/15 * * * *',
          active: true,
          last_status: 'succeeded',
          last_start: '2026-09-20T09:45:00Z',
          last_message: '1 row',
        },
      ],
      heartbeats: {
        'automations-tick': { last_run_at: '2026-09-20T09:45:03Z', detail: { truncated: true, durationMs: 31000 } },
      },
    })
    expect(status.configured).toBe(true)
    expect(status.jobs[0]?.lastStatus).toBe('succeeded')
    expect(status.tickHeartbeat).toBe('2026-09-20T09:45:03Z')
    expect(status.tickTruncated).toBe(true)
  })

  it('reads a heartbeat with no detail as not truncated (never null-crashes)', () => {
    const status = parseSchedulerStatus({
      configured: true,
      base_url: 'https://app.zebri.com.au',
      jobs: [],
      heartbeats: { 'automations-tick': { last_run_at: '2026-09-20T09:45:03Z', detail: null } },
    })
    expect(status.tickHeartbeat).toBe('2026-09-20T09:45:03Z')
    expect(status.tickTruncated).toBeNull()
  })

  it('treats null and garbage as unconfigured with no jobs', () => {
    expect(parseSchedulerStatus(null)).toEqual({
      configured: false,
      baseUrl: null,
      jobs: [],
      tickHeartbeat: null,
      tickTruncated: null,
    })
    expect(parseSchedulerStatus('nope').jobs).toEqual([])
  })
})
