import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { observe } from '@/app/proposal/[token]/_components/engagement-observe'
import { visibleSecondsLedger } from '@/app/proposal/[token]/_components/engagement-session'

/** A minimal IntersectionObserver stand-in that records its options and lets a test fire one entry. */
class FakeIO {
  static last: FakeIO | null = null
  options: IntersectionObserverInit | undefined
  constructor(private cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.options = options
    FakeIO.last = this
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  fire(entry: Partial<IntersectionObserverEntry> & { target: Element }) {
    this.cb([entry as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

/** A DOMRectReadOnly-shaped value; only `height` matters to `observe`. */
const rect = (height: number) => ({ height }) as DOMRectReadOnly

describe('observe (F1: tall sections)', () => {
  let el: HTMLElement
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIO)
    el = document.createElement('section')
    el.setAttribute('data-section-id', 's1')
    document.body.append(el)
  })
  afterEach(() => {
    el.remove()
    vi.unstubAllGlobals()
  })

  it('observes with several thresholds so a tall element keeps reporting as it scrolls', () => {
    observe('[data-section-id]', 'data-section-id', 0.5, visibleSecondsLedger(), new Set())
    const t = FakeIO.last?.options?.threshold
    expect(Array.isArray(t) && t.length > 2).toBe(true)
    expect(t).toContain(0.5)
    // A section five viewports tall peaks at ratio 0.2, so the list must
    // step finer than quarters for it to get callbacks mid-scroll.
    expect(t).toContain(0.15)
  })

  it('counts a section three times the viewport tall that fills the viewport (ratio 0.33)', () => {
    const visible = new Set<string>()
    observe('[data-section-id]', 'data-section-id', 0.5, visibleSecondsLedger(), visible)
    FakeIO.last?.fire({ target: el, isIntersecting: true, intersectionRatio: 0.33, intersectionRect: rect(844), rootBounds: rect(844) })
    expect(visible.has('s1')).toBe(true)
  })

  it('falls back to window.innerHeight when rootBounds is null', () => {
    const visible = new Set<string>()
    observe('[data-section-id]', 'data-section-id', 0.5, visibleSecondsLedger(), visible)
    FakeIO.last?.fire({ target: el, isIntersecting: true, intersectionRatio: 0.3, intersectionRect: rect(window.innerHeight), rootBounds: null })
    expect(visible.has('s1')).toBe(true)
  })

  it('does not count a small section at ratio 0.4 that covers little of the viewport', () => {
    const visible = new Set<string>()
    observe('[data-section-id]', 'data-section-id', 0.5, visibleSecondsLedger(), visible)
    FakeIO.last?.fire({ target: el, isIntersecting: true, intersectionRatio: 0.4, intersectionRect: rect(120), rootBounds: rect(844) })
    expect(visible.has('s1')).toBe(false)
  })

  it('still counts a normal section at the threshold and drops it when it leaves', () => {
    const visible = new Set<string>()
    observe('[data-section-id]', 'data-section-id', 0.5, visibleSecondsLedger(), visible)
    FakeIO.last?.fire({ target: el, isIntersecting: true, intersectionRatio: 0.5, intersectionRect: rect(200), rootBounds: rect(844) })
    expect(visible.has('s1')).toBe(true)
    FakeIO.last?.fire({ target: el, isIntersecting: false, intersectionRatio: 0, intersectionRect: rect(0), rootBounds: rect(844) })
    expect(visible.has('s1')).toBe(false)
  })

  it('fires onEnter once per entry into view, not on every threshold crossing while in view', () => {
    const onEnter = vi.fn()
    observe('[data-section-id]', 'data-section-id', 0.5, visibleSecondsLedger(), new Set(), onEnter)
    FakeIO.last?.fire({ target: el, isIntersecting: true, intersectionRatio: 0.5, intersectionRect: rect(400), rootBounds: rect(844) })
    FakeIO.last?.fire({ target: el, isIntersecting: true, intersectionRatio: 0.75, intersectionRect: rect(600), rootBounds: rect(844) })
    expect(onEnter).toHaveBeenCalledTimes(1)
  })
})
