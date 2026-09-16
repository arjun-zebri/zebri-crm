import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import type { AcceptBlock } from '@/app/(dashboard)/branding/blocks/types'
import { RenderAccept } from '@/lib/branding/public-blocks/proposal/accept'
import { fmtDate } from '@/lib/branding/public-blocks/shared'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({})
const block = blockTemplate('accept') as AcceptBlock
const doc = SAMPLE_PROPOSAL_DOC
const variableValues = { deposit_percent: '25%' }

/** jsdom normalizes an inline hex colour to `rgb(...)`; convert to compare against `getAttribute('style')`. */
function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

describe('RenderAccept', () => {
  it('renders null when there is no proposal and no slot', () => {
    const { container } = render(
      <RenderAccept block={block} branding={branding} doc={{ title: '', refNumber: '', expiresAt: null, items: [], subtotal: 0, taxRate: 0 }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the heading and a button styled with the block color, resolving the deposit reassurance', () => {
    render(<RenderAccept block={block} branding={branding} doc={doc} variableValues={variableValues} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(String(block.heading))
    const button = screen.getByRole('button', { name: block.buttonLabel })
    expect(button.getAttribute('style')).toContain(hexToRgb(branding.brand_color))
    expect(screen.getByText(/25%/)).toBeInTheDocument()
  })

  it('uses block.buttonColor over the brand color when set', () => {
    render(<RenderAccept block={{ ...block, buttonColor: '#ff0000' }} branding={branding} doc={doc} variableValues={variableValues} />)
    const button = screen.getByRole('button', { name: block.buttonLabel })
    expect(button.getAttribute('style')).toContain(hexToRgb('#ff0000'))
  })

  it('calls onAccept when clicked', () => {
    const onAccept = vi.fn()
    render(<RenderAccept block={block} branding={branding} doc={doc} proposal={{ onAccept }} variableValues={variableValues} />)
    fireEvent.click(screen.getByRole('button', { name: block.buttonLabel }))
    expect(onAccept).toHaveBeenCalled()
  })

  it('shows the accepted date and no button when accepted', () => {
    const acceptedDoc = { ...doc, proposal: { ...doc.proposal!, state: 'accepted' as const, acceptedAt: '2026-09-10T12:00:00Z' } }
    render(<RenderAccept block={block} branding={branding} doc={acceptedDoc} variableValues={variableValues} />)
    expect(screen.getByText(`Accepted on ${fmtDate('2026-09-10')}`)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows an expired message and no button when expired', () => {
    const expiredDoc = { ...doc, proposal: { ...doc.proposal!, state: 'expired' as const } }
    render(<RenderAccept block={block} branding={branding} doc={expiredDoc} variableValues={variableValues} />)
    expect(screen.getByText('This proposal has expired')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a declined message and no button when declined', () => {
    const declinedDoc = { ...doc, proposal: { ...doc.proposal!, state: 'declined' as const } }
    render(<RenderAccept block={block} branding={branding} doc={declinedDoc} variableValues={variableValues} />)
    expect(screen.getByText('This proposal was declined')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a sign-to-confirm message and no button while signing', () => {
    const signingDoc = { ...doc, proposal: { ...doc.proposal!, state: 'signing' as const } }
    render(<RenderAccept block={block} branding={branding} doc={signingDoc} variableValues={variableValues} />)
    expect(screen.getByText('Almost there: sign to confirm')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a pay-the-deposit message and no button while paying', () => {
    const payingDoc = { ...doc, proposal: { ...doc.proposal!, state: 'paying' as const } }
    render(<RenderAccept block={block} branding={branding} doc={payingDoc} variableValues={variableValues} />)
    expect(screen.getByText('Booked. Pay the deposit below')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  describe('expiry message', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-09-15T00:00:00Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows nothing when there is no expiry date', () => {
      const noExpiryDoc = { ...doc, expiresAt: null }
      render(<RenderAccept block={block} branding={branding} doc={noExpiryDoc} variableValues={variableValues} />)
      expect(screen.queryByText(/This offer is open until/)).toBeNull()
    })

    it('states a plain date when the expiry is months away', () => {
      // SAMPLE_PROPOSAL_DOC carries expires_at 2026-12-01, well past the
      // near-term window, so no day count is appended.
      render(<RenderAccept block={block} branding={branding} doc={doc} variableValues={variableValues} />)
      expect(screen.getByText(`This offer is open until ${fmtDate('2026-12-01')}.`)).toBeInTheDocument()
    })

    it('names "today" when the proposal expires today', () => {
      const todayDoc = { ...doc, expiresAt: '2026-09-15' }
      render(<RenderAccept block={block} branding={branding} doc={todayDoc} variableValues={variableValues} />)
      expect(screen.getByText(`This offer is open until ${fmtDate('2026-09-15')} (today).`)).toBeInTheDocument()
    })

    it('names "tomorrow" the day before expiry', () => {
      const tomorrowDoc = { ...doc, expiresAt: '2026-09-16' }
      render(<RenderAccept block={block} branding={branding} doc={tomorrowDoc} variableValues={variableValues} />)
      expect(screen.getByText(`This offer is open until ${fmtDate('2026-09-16')} (tomorrow).`)).toBeInTheDocument()
    })

    it('counts the days when expiry is a few days out', () => {
      const soonDoc = { ...doc, expiresAt: '2026-09-18' }
      render(<RenderAccept block={block} branding={branding} doc={soonDoc} variableValues={variableValues} />)
      expect(screen.getByText(`This offer is open until ${fmtDate('2026-09-18')} (in 3 days).`)).toBeInTheDocument()
    })

    it('never shows the expiry line once the proposal has left the open state', () => {
      const expiredDoc = { ...doc, expiresAt: '2026-12-01', proposal: { ...doc.proposal!, state: 'expired' as const } }
      render(<RenderAccept block={block} branding={branding} doc={expiredDoc} variableValues={variableValues} />)
      expect(screen.queryByText(/This offer is open until/)).toBeNull()
    })
  })
})
