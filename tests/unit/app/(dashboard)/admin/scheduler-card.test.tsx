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

vi.mock('@/app/admin/scheduler-actions', () => ({
  syncSchedulerAction: vi.fn(async () => ({ ok: true })),
  refreshSchedulerStatusAction: vi.fn(async () => ({
    configured: true,
    baseUrl: 'https://x',
    jobs: [],
    tickHeartbeat: null,
    tickTruncated: null,
  })),
}))

const now = new Date('2026-09-20T10:00:00Z')

describe('SchedulerCard', () => {
  it('shows Not configured and the sync button when secrets are missing', () => {
    render(
      <SchedulerCard
        now={now}
        status={{ configured: false, baseUrl: null, jobs: [], tickHeartbeat: null, tickTruncated: null }}
      />,
    )
    expect(screen.getByText('Not configured')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync scheduler' })).toBeInTheDocument()
  })

  it('lists jobs with their last outcome and flags a stale tick', () => {
    render(
      <SchedulerCard
        now={now}
        status={{
          configured: true,
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
          baseUrl: 'https://x',
          jobs: [],
          tickHeartbeat: '2026-09-20T09:50:00Z',
          tickTruncated: null,
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
          baseUrl: 'https://x',
          jobs: [],
          tickHeartbeat: '2026-09-20T09:50:00Z',
          tickTruncated: true,
        }}
      />,
    )
    expect(screen.getByText(/Tick healthy/)).toBeInTheDocument()
    expect(screen.getByText(/last tick truncated/)).toBeInTheDocument()
  })
})
