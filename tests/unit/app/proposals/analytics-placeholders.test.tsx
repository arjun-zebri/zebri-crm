/**
 * The analytics placeholders: shapes render from sample data with a
 * visible "Sample data" pill, and the small derivations (acceptance rate,
 * biggest reach drop, lingered-vs-chosen) are right.
 *
 * @module tests/unit/app/proposals/analytics-placeholders
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProposalPackageComparison } from '@/app/(dashboard)/proposals/[id]/proposal-package-comparison'
import { biggestDropIndex, ProposalSectionEngagement } from '@/app/(dashboard)/proposals/[id]/proposal-section-engagement'
import {
  acceptanceRate, SAMPLE_SECTION_ENGAGEMENT, SAMPLE_TEMPLATE_STATS, samplePackageRows,
} from '@/app/(dashboard)/proposals/analytics-placeholders'
import { TemplateStatsChips } from '@/app/(dashboard)/proposals/templates/template-stats-chips'

describe('analytics placeholders', () => {
  it('acceptanceRate is null with nothing sent (0/0 is not 0%)', () => {
    expect(acceptanceRate({ sent: 0, accepted: 0, revenue: 0 })).toBeNull()
    expect(acceptanceRate({ sent: 12, accepted: 8, revenue: 0 })).toBe(67)
  })

  it('biggestDropIndex marks the section where reach fell the most', () => {
    expect(biggestDropIndex(SAMPLE_SECTION_ENGAGEMENT)).toBe(4) // 71 -> 52
    expect(biggestDropIndex([{ id: 'a', label: 'A', seconds: 1, reachPct: 100 }])).toBe(-1)
  })

  it('samplePackageRows uses the proposal\'s own package titles in position order', () => {
    const rows = samplePackageRows([
      { id: 'b', title: 'Second', position: 2 },
      { id: 'a', title: 'First', position: 1 },
    ])
    expect(rows.map((r) => r.title)).toEqual(['First', 'Second'])
    expect(rows[1]!.chosen).toBe(true)
    expect(samplePackageRows([]).map((r) => r.title)).toEqual(['Reception MC', 'Full day', 'Premium'])
  })

  it('section engagement renders every row with reach and names the drop-off', () => {
    render(<ProposalSectionEngagement rows={SAMPLE_SECTION_ENGAGEMENT} sample />)
    expect(screen.getByText('Sample data')).toBeInTheDocument()
    expect(screen.getByText('88% reached')).toBeInTheDocument()
    expect(screen.getByText(/Most readers leave around Questions couples ask/)).toBeInTheDocument()
  })

  it('package comparison shows the Chosen pill and the lingered-vs-chosen line only when they differ', () => {
    const rows = samplePackageRows([])
    const { rerender } = render(<ProposalPackageComparison rows={rows} />)
    expect(screen.getByText('Chosen')).toBeInTheDocument()
    expect(screen.queryByText(/Lingered on/)).not.toBeInTheDocument()
    rerender(<ProposalPackageComparison rows={rows.map((r, i) => ({ ...r, chosen: i === 2 }))} />)
    expect(screen.getByText('Lingered on Full day, chose Premium.')).toBeInTheDocument()
  })

  it('template stats chips read sent / rate / revenue, and render nothing when nothing was sent', () => {
    const { rerender, container } = render(<TemplateStatsChips stats={SAMPLE_TEMPLATE_STATS[0]!} />)
    expect(screen.getByText('12 sent')).toBeInTheDocument()
    expect(screen.getByText('67% accepted')).toBeInTheDocument()
    expect(screen.getByText('$17,600 won')).toBeInTheDocument()
    rerender(<TemplateStatsChips stats={{ sent: 0, accepted: 0, revenue: 0 }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
