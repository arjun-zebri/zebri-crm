import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { HeroBlock } from '@/app/(dashboard)/branding/blocks/types'
import { heroHeightVh, heroTextDefaults, RenderHero } from '@/lib/branding/public-blocks/proposal/hero'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const doc = { title: '', refNumber: 'PR-001', expiresAt: null, items: [], subtotal: 0, taxRate: 0, coupleName: 'Anna & Jake' }
const base: HeroBlock = {
  id: 'h', type: 'hero', background: { kind: 'image', url: 'https://x/bg.jpg' },
  heading: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'variable', attrs: { id: 'couple_name' } }] }] },
  subheading: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Your day' }] }] },
  overlay: 40, height: 'full', textAlign: 'center',
}

describe('RenderHero', () => {
  it('resolves the couple name and paints the image with an overlay', () => {
    const { container } = render(<RenderHero block={base} branding={branding} doc={doc} frame="page" variableValues={{ couple_name: 'Anna & Jake' }} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anna & Jake')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/bg.jpg')
    expect(container.querySelector('[data-hero-overlay]')?.getAttribute('style')).toContain('0.4')
    expect(container.firstElementChild?.getAttribute('style')).toContain('min-height: 100svh')
  })
  it('resolves the dragged height, falling back to the legacy preset', () => {
    expect(heroHeightVh(base)).toBe(100)
    expect(heroHeightVh({ ...base, height: 'tall' })).toBe(70)
    expect(heroHeightVh({ ...base, height: 'short' })).toBe(45)
    expect(heroHeightVh({ ...base, height: 'short', heightVh: 62 })).toBe(62)
  })
  it('a dragged height renders as a share of the viewport on the page and of the canvas in the editor', () => {
    const { container, rerender } = render(<RenderHero block={{ ...base, heightVh: 62 }} branding={branding} doc={doc} frame="page" />)
    expect(container.firstElementChild?.getAttribute('style')).toContain('min-height: 62svh')
    rerender(<RenderHero block={{ ...base, heightVh: 62 }} branding={branding} doc={doc} frame="page" canvasViewportHeight={720} />)
    expect(container.firstElementChild?.getAttribute('style')).toContain('min-height: 446px')
    rerender(<RenderHero block={{ ...base, heightVh: 50 }} branding={branding} doc={doc} frame="print" />)
    expect(container.firstElementChild?.getAttribute('style')).toContain('min-height: 240px')
  })
  it('hides the heading or subheading when the MC turns it off, leaving no orphan spacing', () => {
    const { container, rerender } = render(<RenderHero block={{ ...base, showSubheading: false }} branding={branding} doc={doc} frame="page" />)
    expect(container.querySelector('h1')).not.toBeNull()
    expect(container.querySelector('[data-hero-subheading]')).toBeNull()
    rerender(<RenderHero block={{ ...base, showHeading: false }} branding={branding} doc={doc} frame="page" />)
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('[data-hero-subheading]')).not.toBeNull()
    expect(container.querySelector('[data-hero-subheading]')?.className).not.toContain('mt-3')
  })
  it('the page heading scales down with the container unless the MC set a size', () => {
    const { container, rerender } = render(<RenderHero block={base} branding={branding} doc={doc} frame="page" />)
    expect(container.querySelector('h1')?.getAttribute('style')).toContain('font-size: clamp(40px, 10.5cqw, 56px)')
    rerender(<RenderHero block={{ ...base, headingStyle: { fontSize: 48 } }} branding={branding} doc={doc} frame="page" />)
    expect(container.querySelector('h1')?.getAttribute('style')).toContain('font-size: 48px')
    rerender(<RenderHero block={base} branding={branding} doc={doc} frame="print" />)
    expect(container.querySelector('h1')?.getAttribute('style')).toContain('font-size: 40px')
  })
  it('a per-proposal hero override wins over the block background', () => {
    const { container } = render(
      <RenderHero block={base} branding={branding} frame="page" doc={{ ...doc, proposal: { options: [], introNote: null, depositPercent: null, heroOverride: { imagePath: 'https://x/override.jpg' }, expired: false, state: 'open', proposalNumber: 'PR-001', acceptedOptionId: null, acceptedAddonIds: [], acceptedAt: null } }} />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/override.jpg')
  })
  it('print frame uses a fixed height and renders a video as its poster', () => {
    const { container } = render(<RenderHero block={{ ...base, background: { kind: 'video', url: 'https://x/v.mp4', posterUrl: 'https://x/p.jpg' } }} branding={branding} doc={doc} frame="print" />)
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/p.jpg')
    expect(container.firstElementChild?.getAttribute('style')).toContain('480px')
  })
  it('a canvas viewport height replaces the svh classes with pixel heights', () => {
    // The editor canvas is not the browser viewport: an svh hero there fills
    // the whole window, so the toolbar has nowhere to sit and the canvas
    // height bears no relation to the sent page.
    const { container, rerender } = render(<RenderHero block={base} branding={branding} doc={doc} frame="page" canvasViewportHeight={720} />)
    expect(container.firstElementChild?.className).not.toContain('svh')
    expect(container.firstElementChild?.getAttribute('style')).toContain('min-height: 720px')
    rerender(<RenderHero block={{ ...base, height: 'tall' }} branding={branding} doc={doc} frame="page" canvasViewportHeight={720} />)
    expect(container.firstElementChild?.getAttribute('style')).toContain('min-height: 504px')
    rerender(<RenderHero block={{ ...base, height: 'short' }} branding={branding} doc={doc} frame="page" canvasViewportHeight={720} />)
    expect(container.firstElementChild?.getAttribute('style')).toContain('min-height: 324px')
  })
  it('renders the heading as phrasing content with line breaks, never a nested <p>', () => {
    const heading = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anna &' }, { type: 'hardBreak' }, { type: 'text', text: 'Jake' }] }] }
    const { container } = render(<RenderHero block={{ ...base, heading }} branding={branding} doc={doc} frame="page" />)
    const h1 = container.querySelector('h1')!
    expect(h1.querySelector('p')).toBeNull()
    expect(h1.innerHTML).toBe('Anna &amp;<br>Jake')
  })
  it('places the text by horizontal and vertical alignment', () => {
    const { container, rerender } = render(<RenderHero block={{ ...base, textAlign: 'right', verticalAlign: 'top' }} branding={branding} doc={doc} frame="page" />)
    expect(container.firstElementChild?.className).toContain('items-start')
    expect(container.firstElementChild?.className).toContain('text-right')
    rerender(<RenderHero block={{ ...base, textAlign: 'left', verticalAlign: 'bottom' }} branding={branding} doc={doc} frame="page" />)
    expect(container.firstElementChild?.className).toContain('items-end')
    expect(container.firstElementChild?.className).toContain('text-left')
    // Blocks saved before vertical alignment existed keep their old look:
    // centred text sat in the middle, left text sat at the bottom.
    rerender(<RenderHero block={{ ...base, textAlign: 'left' }} branding={branding} doc={doc} frame="page" />)
    expect(container.firstElementChild?.className).toContain('items-end')
  })
  it('exposes the rendered text defaults so the toolbar can show them', () => {
    const d = heroTextDefaults(branding, base, 'page')
    expect(d.heading.fontSize).toBe(56)
    expect(d.heading.color).toBe('#FFFFFF')
    expect(d.subheading.fontSize).toBe(20)
    const plain = heroTextDefaults(branding, { ...base, background: { kind: 'none' } }, 'page')
    expect(plain.heading.color).not.toBe('#FFFFFF')
  })
})
