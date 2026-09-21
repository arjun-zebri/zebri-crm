/**
 * `LayoutThumbnail`: a non-interactive, scaled preview used by the
 * "Use a template" gallery and the templates grid (UX audit §3.9).
 *
 * @module tests/unit/features/proposals/render/layout-thumbnail
 */
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { blankTemplateLayout, defaultTemplateLayout, layoutIsBlank, LayoutThumbnail } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

// jsdom has no ResizeObserver; this stub fires the callback once, synchronously,
// with a fixed box width so the thumbnail's scaled content actually renders
// (matches the stub in tests/unit/components/editor/canvas-frame.test.tsx).
class ResizeObserverStub {
  private readonly cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }
  observe(target: Element) {
    this.cb([{ target, contentRect: { width: 300 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
  unobserve() {}
  disconnect() {}
}

describe('LayoutThumbnail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the first section heading text from the sample proposal doc', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const layout = defaultTemplateLayout('mc')
    const { container } = render(<LayoutThumbnail layout={layout} branding={branding} />)
    // The whole box is `aria-hidden`, so `getByRole` (which excludes
    // hidden elements by default) can't see into it - assert on the DOM
    // directly instead. The hero's heading is the couple's names, drawn
    // from the variable resolved against SAMPLE_PROPOSAL_DOC.
    expect(container.querySelector('h1')).toHaveTextContent('Anna & Jake')
  })

  it('is aria-hidden and never grows the box beyond its aspect ratio', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const layout = defaultTemplateLayout('mc')
    const { container } = render(<LayoutThumbnail layout={layout} branding={branding} className="w-72" />)
    const box = container.firstElementChild!
    expect(box).toHaveAttribute('aria-hidden', 'true')
    expect(box.className).toContain('aspect-[4/3]')
    expect(box.className).toContain('overflow-hidden')
  })

  it('never mounts a live iframe: an embed node renders as a link, as in print', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const layout = defaultTemplateLayout('mc')
    const first = layout.sections[0]!
    first.content = { type: 'doc', content: [{ type: 'embed', attrs: { url: 'https://player.vimeo.com/video/123456' } }] }
    const { container } = render(<LayoutThumbnail layout={layout} branding={branding} />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('a[href="https://player.vimeo.com/video/123456"]')).not.toBeNull()
  })

  it('labels a blank layout so an empty template card is not a bare white box', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    expect(layoutIsBlank(blankTemplateLayout())).toBe(true)
    expect(layoutIsBlank(defaultTemplateLayout('mc'))).toBe(false)
    const { container } = render(<LayoutThumbnail layout={blankTemplateLayout()} branding={branding} />)
    expect(container.textContent).toContain('Blank page')
  })

  it('renders nothing but the empty box before the first resize measurement', () => {
    // No observe() call at all: scale stays 0, so the scaled inner content
    // never mounts (would otherwise render at the wrong, un-scaled size).
    class NeverFiresObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', NeverFiresObserver)
    const layout = defaultTemplateLayout('mc')
    const { container } = render(<LayoutThumbnail layout={layout} branding={branding} />)
    expect(container.querySelector('h1')).toBeNull()
  })
})
