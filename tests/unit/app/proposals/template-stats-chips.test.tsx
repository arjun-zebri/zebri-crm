/**
 * The outcome chips over a template card, now fed by real figures.
 *
 * @module tests/unit/app/proposals/template-stats-chips
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TemplateStatsChips } from '@/app/(dashboard)/proposals/templates/template-stats-chips'

describe('TemplateStatsChips', () => {
  it('reads sent / rate / revenue plus the median open time', () => {
    render(<TemplateStatsChips stats={{ sent: 2, accepted: 1, revenue: 1000, medianOpenSeconds: 5400 }} />)
    expect(screen.getByText('2 sent')).toBeInTheDocument()
    expect(screen.getByText('50% accepted')).toBeInTheDocument()
    expect(screen.getByText('$1,000 won')).toBeInTheDocument()
    expect(screen.getByText('Opened in 1h 30m (median)')).toBeInTheDocument()
  })

  it('renders nothing when nothing was sent', () => {
    const { container } = render(<TemplateStatsChips stats={{ sent: 0, accepted: 0, revenue: 0, medianOpenSeconds: null }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('omits the clock chip when no proposal has been opened', () => {
    render(<TemplateStatsChips stats={{ sent: 2, accepted: 0, revenue: 0, medianOpenSeconds: null }} />)
    expect(screen.queryByText(/Opened in/)).not.toBeInTheDocument()
  })
})
