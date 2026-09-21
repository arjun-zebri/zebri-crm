import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { TestimonialsBlock } from '@/app/(dashboard)/branding/blocks/types'
import { RenderTestimonials } from '@/lib/branding/public-blocks/proposal/testimonials'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const items = [
  { id: '1', quote: 'Sam ran the night perfectly.', names: 'Anna & Jake' },
  { id: '2', quote: '', names: '' },
]
// Two non-blank quotes: `CarouselControls` hides its arrows entirely at count <= 1.
const twoItems = [
  { id: '1', quote: 'Sam ran the night perfectly.', names: 'Anna & Jake' },
  { id: '2', quote: 'Could not recommend more.', names: 'Priya & Tom' },
]

/** A minimal `TestimonialsBlock`, textBelow empty unless overridden. */
function testimonialsBlock(overrides: Partial<TestimonialsBlock> = {}): TestimonialsBlock {
  return { id: 't', type: 'testimonials', heading: 'Kind words', items: [], layout: 'cards', textBelow: '', ...overrides }
}

describe('RenderTestimonials', () => {
  it('renders null with no items', () => {
    const block = testimonialsBlock()
    expect(render(<RenderTestimonials block={block} branding={branding} />).container.firstChild).toBeNull()
  })

  it('skips an item with a blank quote on the public page, and renders null when every quote is blank', () => {
    const block = testimonialsBlock({ items })
    const { container } = render(<RenderTestimonials block={block} branding={branding} />)
    expect(screen.getByText('Sam ran the night perfectly.')).toBeInTheDocument()
    // One card in the grid, not two (the grid's direct children are the cards' wrappers).
    expect(container.querySelector('.grid')?.childElementCount).toBe(1)
    const blank = testimonialsBlock({ items: [items[1]!] })
    expect(render(<RenderTestimonials block={blank} branding={branding} />).container.firstChild).toBeNull()
  })

  it('cards layout parks a partial row where the section alignment says (`--doc-box-justify`), at the start when unset', () => {
    const { container } = render(<RenderTestimonials block={testimonialsBlock({ items: twoItems })} branding={branding} />)
    const grid = container.querySelector('.grid') as HTMLElement
    expect(grid.className).toContain('[justify-content:var(--doc-box-justify,start)]')
    expect(grid.className).toContain('@md/doc:grid-cols-[repeat(auto-fit,minmax(0,calc((100%-1rem)/2-0.02px)))]')
  })

  it('cards layout equalises every row, not just the row a long quote sits in', () => {
    // Same bug packages fixed on 2026-09-18: without `auto-rows-fr` a
    // long quote on row 2 leaves row 1's cards shorter than row 2's.
    const block = testimonialsBlock({ items: twoItems })
    const { container } = render(<RenderTestimonials block={block} branding={branding} />)
    expect(container.querySelector('.grid')).toHaveClass('auto-rows-fr')
  })

  it('renders the optional text below the cards', () => {
    const block = testimonialsBlock({ items, textBelow: 'Ask us for more references' })
    render(<RenderTestimonials block={block} branding={branding} />)
    expect(screen.getByText('Ask us for more references')).toBeInTheDocument()
  })

  it('cardBackgroundColor overrides every card surface', () => {
    const block = testimonialsBlock({ items, cardBackgroundColor: '#FF00AA' })
    const { container } = render(<RenderTestimonials block={block} branding={branding} />)
    const card = container.querySelector('.grid > div > div') as HTMLElement
    expect(card.style.background).toBe('rgb(255, 0, 170)')
  })

  it('carousel layout shows one item at a time with Previous/Next controls', () => {
    const block = testimonialsBlock({ items: twoItems, layout: 'carousel' })
    render(<RenderTestimonials block={block} branding={branding} />)
    expect(screen.getByText('Sam ran the night perfectly.')).toBeInTheDocument()
    expect(screen.queryByText('Could not recommend more.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next testimonial' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous testimonial' })).toBeInTheDocument()
  })

  it('carouselBackgroundColor/carouselIconColor override the arrow buttons', () => {
    const block = testimonialsBlock({ items: twoItems, layout: 'carousel', carouselBackgroundColor: '#FF00AA', carouselIconColor: '#00FF00' })
    render(<RenderTestimonials block={block} branding={branding} />)
    const next = screen.getByRole('button', { name: 'Next testimonial' })
    expect(next.style.background).toBe('rgb(255, 0, 170)')
    expect(next.style.color).toBe('rgb(0, 255, 0)')
  })

  it('layout cards with mobileLayout carousel shows the grid once and a mobile-only carousel with the same cards', () => {
    const block = testimonialsBlock({ items: twoItems, layout: 'cards', mobileLayout: 'carousel' })
    render(<RenderTestimonials block={block} branding={branding} />)
    // Two Previous/Next pairs would only exist if it also rendered as a full carousel; only the mobile-only one shows.
    expect(screen.getAllByRole('button', { name: 'Next testimonial' })).toHaveLength(1)
    expect(screen.getAllByText('Sam ran the night perfectly.')).toHaveLength(2) // once in the desktop grid, once in the mobile carousel
  })
})
