import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { PageSection } from '@/lib/branding/page-section'
import type { PublicBranding } from '@/lib/branding/public-surface'

const branding = { density: 'cozy', corner_radius: 8 } as PublicBranding
const text: Block = { id: 't1', type: 'text', text: 'hi', sectionBackground: { color: '#123456', imageUrl: 'https://x/y.jpg', overlay: 40 } }

describe('PageSection', () => {
  it('renders a full-width section with the background colour, image and overlay', () => {
    const { container } = render(<PageSection block={text} branding={branding} frame="page"><p>body</p></PageSection>)
    const section = container.querySelector('section')!
    expect(section.getAttribute('data-block-id')).toBe('t1')
    expect(section.style.background).toContain('rgb(18, 52, 86)')
    expect(container.querySelector('[data-section-image]')?.getAttribute('style')).toContain('y.jpg')
    expect(container.querySelector('[data-section-overlay]')?.getAttribute('style')).toContain('0.4')
    expect(screen.getByText('body').closest('.max-w-doc-page')).not.toBeNull()
  })
  it('the hero gets no inner column', () => {
    const hero = { ...text, id: 'h', type: 'hero' } as unknown as Block
    const { container } = render(<PageSection block={hero} branding={branding} frame="page"><p>hero</p></PageSection>)
    expect(container.querySelector('.max-w-doc-page')).toBeNull()
  })
  it('print frame never animates and is visible without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { container } = render(<PageSection block={text} branding={branding} frame="print"><p>x</p></PageSection>)
    expect(container.querySelector('section')?.className).not.toContain('opacity-0')
    vi.unstubAllGlobals()
  })
  it('a reveal-hidden page section still forces print:opacity-100, so a section never scrolled into view is not blank on browser print', () => {
    // A fake IntersectionObserver that never fires keeps the section
    // reveal-hidden (opacity-0) past mount, the state a native print of the
    // live page can capture below the fold.
    vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(() => ({ observe: () => {}, disconnect: () => {} })))
    const { container } = render(<PageSection block={text} branding={branding} frame="page"><p>x</p></PageSection>)
    const className = container.querySelector('section')?.className ?? ''
    expect(className).toContain('opacity-0')
    expect(className).toContain('motion-reduce:opacity-100')
    expect(className).toContain('print:opacity-100')
    vi.unstubAllGlobals()
  })
})
