// tests/unit/features/proposals/editor/node-bar-anchor.test.tsx
/**
 * Proposal Layout v2 UX audit slice D (§3.6/§7.3): `NodeBarAnchor`
 * positions its children directly over the selected node's own rendered
 * box - above it by default, flipped below when there is no room, and
 * clamped so it never runs past the frame's edges. Mirrors
 * `node-bar.test.tsx`'s harness (a bare, unmounted editor built with
 * `buildRichDocExtensions`), plus a `[frame > scroll, NodeBarAnchor]` DOM
 * shape matching `CanvasFrame`'s real one (`scrollRef.current.parentElement`
 * is the positioned frame the bar is measured against).
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import { useEditor } from '@tiptap/react'
import { createRef, useEffect } from 'react'
import { describe, expect, it } from 'vitest'

import { buildRichDocExtensions, doc, image, NodeBarAnchor } from '@/features/proposals'

/** A bare, unmounted editor holding `content`, with `NodeBarAnchor` rendered inside a `[frame > scroll, anchor]` shape matching `CanvasFrame`'s real DOM. */
function Harness({ content, pos = 0, zoom = 1, onReady }: { content: JSONContent; pos?: number; zoom?: number; onReady: (editor: Editor) => void }) {
  const editor = useEditor({ extensions: buildRichDocExtensions({}), content, immediatelyRender: false })
  const scrollRef = createRef<HTMLDivElement>()
  useEffect(() => {
    if (!editor) return
    editor.commands.setNodeSelection(0)
    onReady(editor)
  }, [editor, onReady])
  if (!editor) return null
  return (
    <div data-testid="frame">
      <div ref={scrollRef} data-testid="scroll" />
      <NodeBarAnchor editor={editor} pos={pos} scrollRef={scrollRef} zoom={zoom}>
        <div data-testid="bar" style={{ width: 120, height: 32 }}>Bar</div>
      </NodeBarAnchor>
    </div>
  )
}

/** Renders the harness and waits for the editor (and the anchor) to exist. */
async function setup(content: JSONContent, zoom = 1): Promise<Editor> {
  let current: Editor | null = null
  render(<Harness content={content} zoom={zoom} onReady={(e) => { current = e }} />)
  await waitFor(() => expect(current).not.toBeNull())
  return current!
}

/** Stubs `el.getBoundingClientRect()` to return `rect`, filling in `right`/`bottom` from `left`/`top`/`width`/`height`. */
function stubRect(el: Element, rect: { left: number; top: number; width: number; height: number }): void {
  const full: DOMRect = {
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect,
  }
  el.getBoundingClientRect = () => full
}

const NODE_CONTENT = doc(image({ src: 'https://x/y.jpg', alt: 'A couple', layout: 'inline', widthPct: 100 }))

describe('NodeBarAnchor', () => {
  it('positions the bar above the node, centred, offset by the frame it is measured against', async () => {
    const editor = await setup(NODE_CONTENT)
    const frame = screen.getByTestId('frame')
    const scroll = screen.getByTestId('scroll')
    const nodeEl = editor.view.nodeDOM(0) as Element

    stubRect(frame, { left: 0, top: 0, width: 800, height: 600 })
    stubRect(nodeEl, { left: 350, top: 300, width: 100, height: 40 })
    const bar = document.querySelector('[data-node-bar-anchor]') as HTMLElement
    stubRect(bar, { left: 0, top: 0, width: 120, height: 32 })

    // Re-triggers the anchor's recompute now that the stubs are in place.
    act(() => { scroll.dispatchEvent(new Event('scroll')) })

    await waitFor(() => expect(bar.style.left).toBe('400px'))
    // top = nodeTop(300) - frameTop(0) - GAP(8) - barHeight(32) = 260
    expect(bar.style.top).toBe('260px')
    expect(bar.style.transform).toBe('translateX(-50%)')
  })

  it('flips below the node when there is not enough room above it', async () => {
    const editor = await setup(NODE_CONTENT)
    const frame = screen.getByTestId('frame')
    const scroll = screen.getByTestId('scroll')
    const nodeEl = editor.view.nodeDOM(0) as Element

    stubRect(frame, { left: 0, top: 0, width: 800, height: 600 })
    // Near the frame's top edge: top - GAP - barHeight would be negative.
    stubRect(nodeEl, { left: 350, top: 20, width: 100, height: 40 })
    const bar = document.querySelector('[data-node-bar-anchor]') as HTMLElement
    stubRect(bar, { left: 0, top: 0, width: 120, height: 32 })

    act(() => { scroll.dispatchEvent(new Event('scroll')) })

    // top = nodeBottom(60) - frameTop(0) + GAP(8) = 68
    await waitFor(() => expect(bar.style.top).toBe('68px'))
  })

  it('pins the bar inside a node taller than the frame, at the frame top once the node has scrolled past it', async () => {
    const editor = await setup(NODE_CONTENT)
    const frame = screen.getByTestId('frame')
    const scroll = screen.getByTestId('scroll')
    const nodeEl = editor.view.nodeDOM(0) as Element

    stubRect(frame, { left: 0, top: 0, width: 800, height: 600 })
    const bar = document.querySelector('[data-node-bar-anchor]') as HTMLElement
    stubRect(bar, { left: 0, top: 0, width: 120, height: 32 })

    // A 1400px photo whose top is 20px into the frame: no room above, and
    // "below" (1428) is off the bottom of the 600px frame too.
    stubRect(nodeEl, { left: 350, top: 20, width: 100, height: 1400 })
    act(() => { scroll.dispatchEvent(new Event('scroll')) })
    // Just inside the node's top edge: nodeTop(20) + GAP(8).
    await waitFor(() => expect(bar.style.top).toBe('28px'))

    // Scrolled so the node's top is 300px above the frame: pinned to the gutter.
    stubRect(nodeEl, { left: 350, top: -300, width: 100, height: 1400 })
    act(() => { scroll.dispatchEvent(new Event('scroll')) })
    await waitFor(() => expect(bar.style.top).toBe('8px'))
  })

  it('clamps the left edge so the bar stays inside the frame with an 8px gutter', async () => {
    const editor = await setup(NODE_CONTENT)
    const frame = screen.getByTestId('frame')
    const scroll = screen.getByTestId('scroll')
    const nodeEl = editor.view.nodeDOM(0) as Element

    stubRect(frame, { left: 0, top: 0, width: 800, height: 600 })
    // Node centre would land at x=10 (left -40 + half-width 50) - well past the left gutter.
    stubRect(nodeEl, { left: -40, top: 300, width: 100, height: 40 })
    const bar = document.querySelector('[data-node-bar-anchor]') as HTMLElement
    stubRect(bar, { left: 0, top: 0, width: 120, height: 32 })

    act(() => { scroll.dispatchEvent(new Event('scroll')) })

    // Clamped to GUTTER(8) + barWidth/2(60) = 68, not the raw 10px centre.
    await waitFor(() => expect(bar.style.left).toBe('68px'))
  })

  it('renders nothing when `pos` does not resolve to a live node', async () => {
    let current: Editor | null = null
    // Well past the doc's end: `nodeDOM` resolves nothing for it, the same
    // as a node deleted out from under a still-selected position.
    render(<Harness content={NODE_CONTENT} pos={9999} onReady={(e) => { current = e }} />)
    await waitFor(() => expect(current).not.toBeNull())

    await waitFor(() => expect(document.querySelector('[data-node-bar-anchor]')).toBeNull())
  })
})
