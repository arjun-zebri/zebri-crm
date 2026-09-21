/**
 * `CanvasFrame`'s `scrollRef` prop (Proposal Layout v2 Phase 2 Task 14):
 * when a caller supplies its own ref object, it must end up pointing at
 * the real scroll viewport (`[data-canvas-scroll]`), the same element the
 * frame already positions and pans internally - so a bar mounted through
 * `overlay` can use it as a Radix popover `collisionBoundary`.
 *
 * @module tests/unit/components/editor/canvas-frame
 */
import { render } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CanvasFrame } from '@/components/editor'

// jsdom has no ResizeObserver; CanvasFrame observes the viewport to compute
// its fit-to-width zoom. A minimal stub is enough for this test, which
// never asserts on zoom behaviour.
class ResizeObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

describe('CanvasFrame scrollRef', () => {
  it('points a caller-supplied ref at the real scroll viewport', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const scrollRef = createRef<HTMLDivElement>()
    const { container } = render(
      <CanvasFrame device="desktop" zoom={1} setZoom={() => {}} scrollRef={scrollRef}>
        <div>content</div>
      </CanvasFrame>,
    )
    const scrollEl = container.querySelector('[data-canvas-scroll]')
    expect(scrollEl).not.toBeNull()
    expect(scrollRef.current).toBe(scrollEl)
    vi.unstubAllGlobals()
  })
})

// UX audit §3.1/§3.10: the proposal page canvas is a cooler, dot-grid-free
// workbench so the page sheet (`page-sheet.tsx`) itself carries the
// "this is a document" read. Auto-fit on mount is kept for both modes: the
// 1200px page would overflow a laptop viewport at 100%.
describe('CanvasFrame page mode', () => {
  it('sizes the page to the viewport (720 to 1200px) at 100% instead of scaling a fixed 1200px page down', () => {
    // A fixed 1200px page auto-fit to ~69% on a laptop shrank every piece
    // of chrome inside the sheet (toolbars, name tags, the text bar) with
    // it. The page reflows to the canvas width like the public page does.
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
    const setZoom = vi.fn()
    const { container } = render(
      <CanvasFrame device="desktop" zoom={0.5} setZoom={setZoom} page>
        <div>content</div>
      </CanvasFrame>,
    )
    const sheet = container.querySelector('.\\@container\\/doc') as HTMLElement
    // jsdom reports 0 padding, so the whole 1000px is available.
    expect(sheet.style.width).toBe('1000px')
    expect(setZoom).toHaveBeenCalledWith(1)
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })


  it('paints the workbench with the bg-surface-emphasis token class and no dot grid, unlike the document canvas', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const { container: pageContainer } = render(
      <CanvasFrame device="desktop" zoom={1} setZoom={() => {}} page>
        <div>content</div>
      </CanvasFrame>,
    )
    const pageRoot = pageContainer.firstElementChild as HTMLElement
    expect(pageRoot.className).toContain('bg-surface-emphasis')
    expect(pageRoot.querySelector('[data-canvas-dots]')).toBeNull()

    const { container: docContainer } = render(
      <CanvasFrame device="desktop" zoom={1} setZoom={() => {}}>
        <div>content</div>
      </CanvasFrame>,
    )
    const docRoot = docContainer.firstElementChild as HTMLElement
    expect(docRoot.className).not.toContain('bg-surface-emphasis')
    expect(docRoot.querySelector('[data-canvas-dots]')).not.toBeNull()
    vi.unstubAllGlobals()
  })
})
