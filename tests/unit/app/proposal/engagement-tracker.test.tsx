import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { emitEngagement } from '@/app/proposal/[token]/_components/engagement-bus'
import { EngagementTracker } from '@/app/proposal/[token]/_components/engagement-tracker'

const token = '11111111-1111-4111-8111-111111111111'

/**
 * A controllable IntersectionObserver stub: one instance per `observe()`
 * call site, each remembering which targets it was asked to watch so a
 * test can fire an `isIntersecting` entry for a specific element without
 * a real layout engine.
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  elements: Element[] = []
  constructor(private callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this)
  }
  observe(el: Element) {
    this.elements.push(el)
  }
  unobserve() {}
  disconnect() {}
  /** `intersectionRatio` defaults to a plausible value for `isIntersecting`, but a test can pass its own (M3: a low ratio while `isIntersecting` is still true, matching a real browser's initial-observation notification). */
  fire(el: Element, isIntersecting: boolean, intersectionRatio: number = isIntersecting ? 1 : 0) {
    this.callback([{ target: el, isIntersecting, intersectionRatio } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

/** Finds the fake observer instance watching a given element. */
function observerFor(el: Element): FakeIntersectionObserver {
  const found = FakeIntersectionObserver.instances.find((io) => io.elements.includes(el))
  if (!found) throw new Error('no observer watching that element')
  return found
}

function lastPostedBody(fetch: ReturnType<typeof vi.fn>): { token: string; sessionId: string; events: Array<{ id: string; type: string; payload: unknown }> } {
  const call = fetch.mock.calls.at(-1)
  if (!call) throw new Error('fetch was never called')
  return JSON.parse((call[1] as { body: string }).body)
}

describe('EngagementTracker', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let sendBeacon: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    FakeIntersectionObserver.instances = []
    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    sendBeacon = vi.fn(() => true)
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('navigator', { sendBeacon })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('1. flushes an `opened` event on the first interval tick with no section rows when nothing intersected', () => {
    render(<EngagementTracker token={token} enabled />)
    vi.advanceTimersByTime(10_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = lastPostedBody(fetchMock)
    expect(body.token).toBe(token)
    expect(body.events).toHaveLength(1)
    expect(body.events[0]).toMatchObject({ type: 'opened', payload: {} })
    expect(typeof body.events[0]!.id).toBe('string')
    expect(body.events[0]!.id.length).toBeGreaterThan(0)
  })

  it('2. a visible section and package card produce section_viewed / package_viewed on the next flush', () => {
    // The tracker finds sections/cards by document-wide selector at mount,
    // so they must already be in the DOM before it renders.
    const section = document.createElement('section')
    section.setAttribute('data-block-id', 'h')
    section.setAttribute('data-block-type', 'hero')
    const card = document.createElement('article')
    card.setAttribute('data-option-id', 'o1')
    document.body.append(section, card)

    render(<EngagementTracker token={token} enabled />)
    observerFor(section).fire(section, true)
    observerFor(card).fire(card, true)

    vi.advanceTimersByTime(10_000)

    const body = lastPostedBody(fetchMock)
    expect(body.events).toContainEqual(expect.objectContaining({ type: 'section_viewed', payload: { blockId: 'h', blockType: 'hero', seconds: 10 } }))
    expect(body.events).toContainEqual(expect.objectContaining({ type: 'package_viewed', payload: { optionId: 'o1', seconds: 10 } }))

    document.body.removeChild(section)
    document.body.removeChild(card)
  })

  it('3. bus events queued between flushes ride the next flush', () => {
    render(<EngagementTracker token={token} enabled />)
    emitEngagement({ type: 'package_selected', payload: { optionId: 'o1' } })
    vi.advanceTimersByTime(10_000)
    const body = lastPostedBody(fetchMock)
    expect(body.events).toContainEqual(expect.objectContaining({ type: 'package_selected', payload: { optionId: 'o1' } }))
    expect(body.events).toContainEqual(expect.objectContaining({ type: 'opened', payload: {} }))
  })

  it('4. pagehide flushes via sendBeacon instead of fetch', () => {
    render(<EngagementTracker token={token} enabled />)
    window.dispatchEvent(new Event('pagehide'))
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon).toHaveBeenCalledWith('/api/proposal/events', expect.any(Blob))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('5. a hidden document stops seconds accumulating for anything intersecting', () => {
    const section = document.createElement('section')
    section.setAttribute('data-block-id', 'h')
    section.setAttribute('data-block-type', 'hero')
    document.body.append(section)

    render(<EngagementTracker token={token} enabled />)
    const io = observerFor(section)
    io.fire(section, true)

    // Go hidden immediately: stopAll banks whatever elapsed so far (~0s).
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))

    vi.advanceTimersByTime(10_000)
    const body = lastPostedBody(fetchMock)
    expect(body.events.some((e) => e.type === 'section_viewed')).toBe(false)

    document.body.removeChild(section)
  })

  it('6. enabled=false observes nothing and sends nothing', () => {
    render(<EngagementTracker token={token} enabled={false} />)
    vi.advanceTimersByTime(30_000)
    window.dispatchEvent(new Event('pagehide'))
    expect(FakeIntersectionObserver.instances).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('7. M3: a low intersection ratio does not bank time, even though isIntersecting is true', () => {
    const section = document.createElement('section')
    section.setAttribute('data-block-id', 'h')
    section.setAttribute('data-block-type', 'hero')
    document.body.append(section)

    render(<EngagementTracker token={token} enabled />)
    // Below the section observer's own 0.5 threshold: a real browser's
    // initial notification reports isIntersecting=true (any overlap) at
    // whatever the actual ratio is, which can be under the threshold.
    observerFor(section).fire(section, true, 0.2)
    vi.advanceTimersByTime(10_000)
    const body = lastPostedBody(fetchMock)
    expect(body.events.some((e) => e.type === 'section_viewed')).toBe(false)

    document.body.removeChild(section)
  })

  it('8. C2: a batch that fails to post is requeued at the front and resent on the next flush, carrying the SAME ids', async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 500 })))
      .mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 200 })))
    render(<EngagementTracker token={token} enabled />)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const first = lastPostedBody(fetchMock)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const second = lastPostedBody(fetchMock)
    expect(second.events).toContainEqual(expect.objectContaining({ type: 'opened', payload: {} }))
    // The single most important detail this fix depends on: a requeued
    // retry must NOT mint a fresh id, or the server could never tell it
    // apart from a new event and the dedup constraint would never fire.
    expect(second.events.map((e) => e.id)).toEqual(first.events.map((e) => e.id))
  })

  it('9. C2: a flush over the batch cap is chunked into multiple posts', () => {
    render(<EngagementTracker token={token} enabled />)
    for (let i = 0; i < 60; i++) emitEngagement({ type: 'package_selected', payload: { optionId: `o${i}` } })
    vi.advanceTimersByTime(10_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [first, second] = fetchMock.mock.calls
    if (!first || !second) throw new Error('expected two chunked posts')
    const firstBody = JSON.parse((first[1] as { body: string }).body)
    const secondBody = JSON.parse((second[1] as { body: string }).body)
    expect(firstBody.events).toHaveLength(50)
    expect(secondBody.events).toHaveLength(11)
  })

  it('10. C2: unmounting (with no pagehide) still flushes once via sendBeacon', () => {
    const { unmount } = render(<EngagementTracker token={token} enabled />)
    unmount()
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon).toHaveBeenCalledWith('/api/proposal/events', expect.any(Blob))
  })
})
