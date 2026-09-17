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
