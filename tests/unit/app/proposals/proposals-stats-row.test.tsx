/**
 * The /proposals account strip: acceptance rate, median time to open and
 * revenue accepted this month, with explicit empty, loading and error states.
 *
 * @module tests/unit/app/proposals/proposals-stats-row
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProposalsStatsRow } from '@/app/(dashboard)/proposals/proposals-stats-row'
import type { AccountSummary } from '@/features/proposals'

const summary: AccountSummary = { sent: 3, accepted: 1, acceptancePct: 33, medianOpenSeconds: 5400, revenueThisMonth: 1000 }
const base = { loading: false, error: null, onRetry: () => {} }

describe('ProposalsStatsRow', () => {
  it('renders the three figures with their labels', () => {
    render(<ProposalsStatsRow summary={summary} {...base} />)
    expect(screen.getByText('33%')).toBeInTheDocument()
    expect(screen.getByText('Acceptance rate')).toBeInTheDocument()
    expect(screen.getByText('1h 30m')).toBeInTheDocument()
    expect(screen.getByText('Median time to open')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()
    expect(screen.getByText('Accepted this month')).toBeInTheDocument()
  })

  it('shows an en dash, never 0% or 0s, when nothing is sent or opened', () => {
    render(<ProposalsStatsRow summary={{ ...summary, sent: 0, accepted: 0, acceptancePct: null, medianOpenSeconds: null }} {...base} />)
    expect(screen.getAllByText('–')).toHaveLength(2)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.queryByText('0s')).not.toBeInTheDocument()
    expect(screen.getByText('Nothing sent yet', { selector: '.sr-only' })).toBeInTheDocument()
    expect(screen.getByText('No opens yet', { selector: '.sr-only' })).toBeInTheDocument()
  })

  it('renders the skeleton while loading', () => {
    const { container } = render(<ProposalsStatsRow summary={undefined} {...base} loading />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
    expect(screen.queryByText('Acceptance rate')).not.toBeInTheDocument()
  })

  it('renders an ErrorState with a working retry', () => {
    const onRetry = vi.fn()
    render(<ProposalsStatsRow summary={undefined} loading={false} error={new Error('boom')} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('F5: keeps the figures when a background refetch fails with a summary already loaded', () => {
    render(<ProposalsStatsRow summary={summary} loading={false} error={new Error('boom')} onRetry={() => {}} />)
    expect(screen.getByText('33%')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()
    expect(screen.queryByText('Could not load your proposal figures')).not.toBeInTheDocument()
  })
})
