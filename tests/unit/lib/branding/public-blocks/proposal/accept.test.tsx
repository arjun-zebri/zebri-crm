import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

  it('renders no heading and no reassurance line when both are empty (a v2 layout section strips them), keeping the button', () => {
    const { container } = render(
      <RenderAccept block={{ ...block, heading: '', reassurance: '' }} branding={branding} doc={doc} variableValues={variableValues} />,
    )
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: block.buttonLabel })).toBeInTheDocument()
    // No stray empty fine-print wrapper carrying its `mt-4` under the button.
    expect(container.querySelectorAll('.mt-4')).toHaveLength(0)
  })

  it('follows the section alignment (`--doc-align`), centred when nothing sets one, for the wrapper, heading and fine print', () => {
    // 2026-09-19 live bug: the block hard-coded `text-center` and pinned
    // the fine print centre inline, so the section Style popover's
    // Alignment pill did nothing here. A v1 tree (public-renderer.tsx)
    // sets no `--doc-align`, so the fallback keeps it centred there.
    const { container } = render(<RenderAccept block={block} branding={branding} doc={doc} variableValues={variableValues} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.textAlign).toBe('var(--doc-align, center)')
    expect(wrapper.className).not.toContain('text-center')
    expect((screen.getByRole('heading', { level: 2 }) as HTMLElement).style.textAlign).toBe('var(--doc-align, center)')
    expect((screen.getByText(/25%/).closest('[style]') as HTMLElement).style.textAlign).toBe('var(--doc-align, center)')
  })

  it('an explicit heading alignment on the block still wins over the section', () => {
    render(<RenderAccept block={{ ...block, headingStyle: { align: 'right' } }} branding={branding} doc={doc} variableValues={variableValues} />)
    expect((screen.getByRole('heading', { level: 2 }) as HTMLElement).style.textAlign).toBe('right')
  })

  it('uses block.buttonColor over the brand color when set', () => {
    render(<RenderAccept block={{ ...block, buttonColor: '#ff0000' }} branding={branding} doc={doc} variableValues={variableValues} />)
    const button = screen.getByRole('button', { name: block.buttonLabel })
    expect(button.getAttribute('style')).toContain(hexToRgb('#ff0000'))
  })

  it('resolves {{ id | fallback }} tokens in the button label', () => {
    const templated = { ...block, buttonLabel: 'Book {{couple_name | us}} in' }
    render(<RenderAccept block={templated} branding={branding} doc={doc} variableValues={{ ...variableValues, couple_name: 'Ada & Bo' }} />)
    expect(screen.getByRole('button', { name: 'Book Ada & Bo in' })).toBeInTheDocument()
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

  it('never renders an expiry line under the button (2026-09-19: the section is the button alone)', () => {
    render(<RenderAccept block={block} branding={branding} doc={{ ...doc, expiresAt: '2026-12-01' }} variableValues={variableValues} />)
    expect(screen.queryByText(/This offer is open until/)).toBeNull()
  })
})
