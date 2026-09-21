import { render, waitFor } from '@testing-library/react'
import type { JSONContent } from '@tiptap/core'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bubbleShouldShow, RichText } from '@/app/(dashboard)/branding/blocks/rich-text/rich-text'

const para = (text: string): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
const chip: JSONContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'variable', attrs: { id: 'couple_name' } }] }] }

describe('RichText external value', () => {
  let consoleError: ReturnType<typeof vi.spyOn>
  beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { consoleError.mockRestore() })

  it('adopts a value pushed from outside (undo, reset) without a flushSync warning', async () => {
    // A variable chip is a React node view, and TipTap mounts those with
    // flushSync; setting content synchronously inside the effect that sees
    // the new value made React complain it was already rendering.
    const { container, rerender } = render(<RichText value={para('Hello')} onChange={vi.fn()} surface="proposal" />)
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull())
    rerender(<RichText value={chip} onChange={vi.fn()} surface="proposal" />)
    await waitFor(() => expect(container.textContent).toContain('Couple name'))
    const flushWarnings = consoleError.mock.calls.filter((c) => String(c[0]).includes('flushSync'))
    expect(flushWarnings).toEqual([])
  })
})

describe('bubbleShouldShow', () => {
  it('shows only for a real text selection, not a caret or a chip-only selection', () => {
    // A caret-triggered bar sat over the words you were trying to click, and a
    // chip-only selection (select-all on a `{{ couple_name }}` heading) popped
    // a bar with nothing to format. Both read as a second toolbar.
    expect(bubbleShouldShow({ menuFocused: false, hasTextSelection: false })).toBe(false)
    expect(bubbleShouldShow({ menuFocused: false, hasTextSelection: true })).toBe(true)
  })
  it('stays up while one of its own menus has focus', () => {
    expect(bubbleShouldShow({ menuFocused: true, hasTextSelection: false })).toBe(true)
  })
})

describe('RichText keyboard', () => {
  // The floating toolbar shows on a selection and positions itself from the
  // selection's client rects, which jsdom's Range does not implement.
  beforeEach(() => {
    const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }
    Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
    Range.prototype.getBoundingClientRect = () => rect as DOMRect
  })
  async function mount(props: Partial<React.ComponentProps<typeof RichText>>) {
    const onChange = vi.fn()
    const utils = render(<RichText value={para('Hello')} onChange={onChange} surface="proposal" {...props} />)
    await waitFor(() => expect(utils.container.querySelector('.ProseMirror')).not.toBeNull())
    const pm = utils.container.querySelector('.ProseMirror') as HTMLElement
    pm.tabIndex = -1 // jsdom will not focus a contenteditable otherwise
    pm.focus()
    return { ...utils, pm, onChange }
  }
  const key = (el: HTMLElement, key: string, init: KeyboardEventInit = {}) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))

  it('Enter inserts a line break in lineBreak mode and keeps focus', async () => {
    const { pm, onChange } = await mount({ enterKey: 'lineBreak' })
    key(pm, 'Enter')
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const doc = onChange.mock.calls.at(-1)![0] as JSONContent
    expect(doc.content).toHaveLength(1)
    expect(JSON.stringify(doc)).toContain('"hardBreak"')
    expect(document.activeElement).toBe(pm)
  })

  it('Enter blurs in blur mode without changing the text', async () => {
    const { pm, onChange } = await mount({ enterKey: 'blur' })
    key(pm, 'Enter')
    expect(document.activeElement).not.toBe(pm)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Escape leaves the field in every mode', async () => {
    const { pm } = await mount({ enterKey: 'paragraph' })
    key(pm, 'Escape')
    expect(document.activeElement).not.toBe(pm)
  })
})
