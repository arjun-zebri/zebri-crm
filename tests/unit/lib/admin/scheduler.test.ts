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
      slack_configured: true,
      base_url: 'https://app.zebri.com.au',
      jobs: [
        {
          name: 'zebri:automations-tick',
          schedule: '* * * * *',
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
    expect(status.slackConfigured).toBe(true)
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
      slackConfigured: false,
      baseUrl: null,
      jobs: [],
      tickHeartbeat: null,
      tickTruncated: null,
      tickFailedPasses: [],
      tickFailedReads: 0,
      tickFailedReadSite: null,
      staleEvents: null,
    })
    expect(parseSchedulerStatus('nope').jobs).toEqual([])
  })

  // Task 36 (audit M4): the last stale-event skip and the tick's failed
  // passes both ride on heartbeat rows the RPC already returns, so the
  // card shows them without a query of its own.
  it('reads the last stale-event skip and the failed passes from the heartbeats', () => {
    const status = parseSchedulerStatus({
      configured: true,
      jobs: [],
      heartbeats: {
        'automations-tick': {
          last_run_at: '2026-09-20T09:45:03Z',
          detail: { truncated: false, failedPasses: ['workflows.executor'] },
        },
        'workflow-stale-events': { last_run_at: '2026-09-20T08:00:00Z', detail: { count: 12 } },
      },
    })
    expect(status.staleEvents).toEqual({ count: 12, at: '2026-09-20T08:00:00Z' })
    expect(status.tickFailedPasses).toEqual(['workflows.executor'])
  })

  it('reads a malformed stale record as none, and odd failed passes as none', () => {
    const status = parseSchedulerStatus({
      configured: true,
      jobs: [],
      heartbeats: {
        'automations-tick': { last_run_at: '2026-09-20T09:45:03Z', detail: { failedPasses: 'executor' } },
        'workflow-stale-events': { last_run_at: '2026-09-20T08:00:00Z', detail: { count: 'lots' } },
      },
    })
    expect(status.staleEvents).toBeNull()
    expect(status.tickFailedPasses).toEqual([])
  })

  // Phase 6 review I2: a failed read must be visible without Slack.
  it('reads the last tick\'s failed read count and site from its heartbeat', () => {
    const status = parseSchedulerStatus({
      configured: true,
      jobs: [],
      heartbeats: {
        'automations-tick': {
          last_run_at: '2026-09-20T09:45:03Z',
          detail: { failedReads: 3, failedReadSite: 'executor.load_instance' },
        },
      },
    })
    expect(status.tickFailedReads).toBe(3)
    expect(status.tickFailedReadSite).toBe('executor.load_instance')

    const old = parseSchedulerStatus({
      configured: true,
      jobs: [],
      heartbeats: { 'automations-tick': { last_run_at: '2026-09-20T09:45:03Z', detail: { failedReads: 'x' } } },
    })
    expect(old.tickFailedReads).toBe(0)
    expect(old.tickFailedReadSite).toBeNull()
  })
})
