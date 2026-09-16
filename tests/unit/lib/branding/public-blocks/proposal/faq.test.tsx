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

  it('renders each question collapsed, expanding on click', () => {
    const block: FaqBlock = { id: 'f', type: 'faq', heading: 'FAQ', items }
    render(<RenderFaq block={block} branding={branding} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    buttons.forEach((btn) => expect(btn).toHaveAttribute('aria-expanded', 'false'))
    expect(screen.getByText(items[0]?.answer ?? '')).not.toBeVisible()

    fireEvent.click(buttons[0] as HTMLElement)
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(items[0]?.answer ?? '')).toBeVisible()
  })
})
