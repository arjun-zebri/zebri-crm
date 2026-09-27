/**
 * The Admin Scheduler card: configured badge, job outcomes, tick
 * heartbeat staleness, and the Sync scheduler button.
 *
 * `now` is passed explicitly so the staleness assertion does not depend
 * on the wall clock at test time.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SchedulerCard } from '@/app/(dashboard)/admin/sections/scheduler-card'
import type { SchedulerStatus } from '@/lib/admin/scheduler'

vi.mock('@/app/admin/scheduler-actions', () => ({
  syncSchedulerAction: vi.fn(async () => ({ ok: true })),
  refreshSchedulerStatusAction: vi.fn(async () => ({
    configured: true,
    slackConfigured: true,
    baseUrl: 'https://x',
    jobs: [],
    tickHeartbeat: null,
    tickTruncated: null,
    tickFailedPasses: [],
    tickFailedReads: 0,
    tickFailedReadSite: null,
    staleEvents: null,
    // Typed, so a field added to the status fails this fixture at
    // typecheck instead of rendering undefined (Phase 6 residual pass).
  }) satisfies SchedulerStatus),
}))

const now = new Date('2026-09-20T10:00:00Z')

describe('SchedulerCard', () => {
  it('shows Not configured and the sync button when secrets are missing', () => {
    render(
      <SchedulerCard
        now={now}
        status={{ configured: false, slackConfigured: false, baseUrl: null, jobs: [], tickHeartbeat: null, tickTruncated: null, tickFailedPasses: [], tickFailedReads: 0, tickFailedReadSite: null, staleEvents: null }}
      />,
    )
    expect(screen.getByText('Not configured')).toBeInTheDocument()
    expect(screen.getByText(/Watchdog has no Slack webhook/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync scheduler' })).toBeInTheDocument()
  })

  it('lists jobs with their last outcome and flags a stale tick', () => {
    render(
      <SchedulerCard
        now={now}
        status={{
          configured: true,
          slackConfigured: true,
          baseUrl: 'https://app.zebri.com.au',
          jobs: [
            {
              name: 'zebri:automations-tick',
              schedule: '*/15 * * * *',
              active: true,
              lastStatus: 'failed',
              lastStart: '2026-09-20T08:00:00Z',
              lastMessage: 'timeout',
            },
          ],
          tickHeartbeat: '2026-09-20T08:00:00Z',
          tickTruncated: null,
          tickFailedPasses: [],
          tickFailedReads: 0,
          tickFailedReadSite: null,
          staleEvents: null,
        }}
      />,
    )
    expect(screen.getByText('Configured')).toBeInTheDocument()
    expect(screen.getByText('zebri:automations-tick')).toBeInTheDocument()
    // pg_cron's own "failed" (enqueue to pg_net, not the route's HTTP
    // result) is relabelled so it does not imply the route failed.
    expect(screen.getByText('queue failed')).toBeInTheDocument()
    expect(screen.getByText(/Tick stale/)).toBeInTheDocument()
  })

  it('reads a fresh tick as healthy', () => {
    render(
      <SchedulerCard
        now={now}
        status={{
          configured: true,
          slackConfigured: true,
          baseUrl: 'https://x',
          jobs: [],
          tickHeartbeat: '2026-09-20T09:58:00Z',
          tickTruncated: null,
          tickFailedPasses: [],
          tickFailedReads: 0,
          tickFailedReadSite: null,
          staleEvents: null,
        }}
      />,
    )
    expect(screen.getByText(/Tick healthy/)).toBeInTheDocument()
  })

  it('flags a truncated tick even when the heartbeat is otherwise fresh', () => {
    render(
      <SchedulerCard
        now={now}
        status={{
          configured: true,
          slackConfigured: true,
          baseUrl: 'https://x',
          jobs: [],
          tickHeartbeat: '2026-09-20T09:58:00Z',
          tickTruncated: true,
          tickFailedPasses: [],
          tickFailedReads: 0,
          tickFailedReadSite: null,
          staleEvents: null,
        }}
      />,
    )
    expect(screen.getByText(/Tick healthy/)).toBeInTheDocument()
    expect(screen.getByText(/last tick truncated/)).toBeInTheDocument()
  })

  // Task 36 (audit M4): stale events used to be dropped with no trace.
  it('shows the last stale-event skip with its count', () => {
    render(
      <SchedulerCard
        now={now}
        status={{
          configured: true,
          slackConfigured: true,
          baseUrl: 'https://x',
          jobs: [],
          tickHeartbeat: '2026-09-20T09:58:00Z',
          tickTruncated: false,
          tickFailedPasses: [],
          tickFailedReads: 0,
          tickFailedReadSite: null,
          staleEvents: { count: 12, at: '2026-09-20T08:00:00Z' },
        }}
      />,
    )
    expect(screen.getByText(/12 stale events skipped in the last batch/)).toBeInTheDocument()
  })

  it('says so when no stale event has been skipped', () => {
    render(
      <SchedulerCard
        now={now}
        status={{
          configured: true,
          slackConfigured: true,
          baseUrl: 'https://x',
          jobs: [],
          tickHeartbeat: '2026-09-20T09:58:00Z',
          tickTruncated: false,
          tickFailedPasses: [],
          tickFailedReads: 0,
          tickFailedReadSite: null,
          staleEvents: null,
        }}
      />,
    )
    expect(screen.getByText(/No stale events skipped/)).toBeInTheDocument()
  })

  it('names the passes the last tick could not run', () => {
    render(
      <SchedulerCard
        now={now}
        status={{
          configured: true,
          slackConfigured: true,
          baseUrl: 'https://x',
          jobs: [],
          tickHeartbeat: '2026-09-20T09:58:00Z',
          tickTruncated: false,
          tickFailedPasses: ['workflows.executor'],
          tickFailedReads: 0,
          tickFailedReadSite: null,
          staleEvents: null,
        }}
      />,
    )
    expect(screen.getByText(/last tick failed: workflows.executor/)).toBeInTheDocument()
  })

  // Phase 6 review I2: the failed-read alert can be lost, so the card
  // names the last tick's failed reads and where the first one failed.
  it('names the reads the last tick could not do, and where', () => {
    render(
      <SchedulerCard
        now={now}
        status={{
          configured: true,
          slackConfigured: true,
          baseUrl: 'https://x',
          jobs: [],
          tickHeartbeat: '2026-09-20T09:58:00Z',
          tickTruncated: false,
          tickFailedPasses: [],
          tickFailedReads: 4,
          tickFailedReadSite: 'executor.load_instance',
          staleEvents: null,
        }}
      />,
    )
    expect(screen.getByText(/4 failed reads in the last tick, first at executor.load_instance/)).toBeInTheDocument()
  })
})
