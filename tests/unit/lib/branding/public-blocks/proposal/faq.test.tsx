import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { FaqBlock } from '@/app/(dashboard)/branding/blocks/types'
import { RenderFaq } from '@/lib/branding/public-blocks/proposal/faq'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const items = [
  { id: '1', question: 'How does payment work?', answer: 'A deposit secures the date.' },
  { id: '2', question: 'Can we bring our own playlist?', answer: 'Of course, send it through beforehand.' },
]

describe('RenderFaq', () => {
  it('renders null with no items', () => {
    const block: FaqBlock = { id: 'f', type: 'faq', heading: 'FAQ', items: [] }
    const { container } = render(<RenderFaq block={block} branding={branding} />)
    expect(container.firstChild).toBeNull()
  })

  it('skips an item with a blank question on the public page (the editor still shows it through its slot)', () => {
    const block: FaqBlock = { id: 'f', type: 'faq', heading: 'FAQ', items: [...items, { id: '3', question: '', answer: '' }] }
    render(<RenderFaq block={block} branding={branding} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('renders each question collapsed, expanding on click', () => {
    const block: FaqBlock = { id: 'f', type: 'faq', heading: 'FAQ', items }
    render(<RenderFaq block={block} branding={branding} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    buttons.forEach((btn) => expect(btn).toHaveAttribute('aria-expanded', 'false'))
    // The closed panel is `inert`, not `hidden` (Tailwind grid-rows handles
    // the collapsed-height animation instead) - jsdom has no layout engine
    // to assert the animated height against, so `inert` is the visibility
    // signal this test can actually see.
    const panel = document.getElementById('faq-panel-1')
    expect(panel).toHaveAttribute('inert')

    fireEvent.click(buttons[0] as HTMLElement)
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('inert')
  })

  it('renders every answer open with no toggle when collapsible is off', () => {
    const block: FaqBlock = { id: 'f', type: 'faq', heading: 'FAQ', items, collapsible: false }
    render(<RenderFaq block={block} branding={branding} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText(items[0]?.question ?? '')).toBeInTheDocument()
    expect(screen.getByText(items[0]?.answer ?? '')).toBeInTheDocument()
    expect(screen.getByText(items[1]?.answer ?? '')).toBeInTheDocument()
  })
})
