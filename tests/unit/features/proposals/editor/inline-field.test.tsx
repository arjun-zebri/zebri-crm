// tests/unit/features/proposals/editor/inline-field.test.tsx
/**
 * Slice E1 deliverable 3: `InlineField`, the inline TipTap field every
 * data-section editor (FAQ, testimonials, accept, packages) builds on.
 * Covers: renders the given value (doc JSON and a legacy plain string),
 * emits normalised JSON on every edit, a single-line field blurs on
 * Enter without starting a new paragraph, and it re-hydrates only when
 * `externalVersion` bumps - never on a bare `value` prop change, the same
 * rule `content-section-editor.test.tsx` proves for content sections.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { describe, expect, it, vi } from 'vitest'

import { doc, FieldShortcutsProvider, InlineField, paragraph, text } from '@/features/proposals'

/** Waits for `onReady` to have captured a live editor instance and returns it. */
async function waitForReady(getEditor: () => Editor | null): Promise<Editor> {
  await waitFor(() => expect(getEditor()).not.toBeNull())
  return getEditor()!
}

describe('InlineField', () => {
  it('renders a TipTap JSON value', () => {
    render(<InlineField value={doc(paragraph(text('Hello')))} onChange={() => {}} externalVersion={0} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('renders a stored "left" alignment as a real inline override, the same as centre', () => {
    // Live bug 2026-09-20: a stored 'left' used to be erased as "unset",
    // so "Align left" could never pull a heading out of a centred section
    // or centred theme role. Same rule as `extensions/text-align.ts` for a
    // content section: a stored value is always the author's pick (pasted
    // `text-align: left` is dropped on parse), so it always renders.
    const { container } = render(
      <div>
        <InlineField value={doc({ type: 'paragraph', attrs: { textAlign: 'left' }, content: [text('Left')] })} onChange={() => {}} externalVersion={0} />
        <InlineField value={doc({ type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('Centre')] })} onChange={() => {}} externalVersion={0} />
      </div>,
    )
    expect(screen.getByText('Left').closest('p')?.getAttribute('style')).toContain('text-align: left')
    expect(screen.getByText('Centre').closest('p')?.getAttribute('style')).toContain('text-align: center')
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('renders a legacy plain-string value as a paragraph', () => {
    render(<InlineField value="Plain text" onChange={() => {}} externalVersion={0} />)
    expect(screen.getByText('Plain text')).toBeInTheDocument()
  })

  it('emits normalised JSON on every edit', async () => {
    const onChange = vi.fn()
    let live: Editor | null = null
    render(
      <InlineField
        value={doc(paragraph(text('Hi')))}
        onChange={onChange}
        externalVersion={0}
        onReady={(e) => { live = e }}
      />,
    )
    const editor = await waitForReady(() => live)
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, '!')
    })
    const last = onChange.mock.calls.at(-1)?.[0]
    expect(JSON.stringify(last)).toContain('Hi!')
  })

  it('typing @ opens the variable list and picking one inserts the chip (variables anywhere)', async () => {
    const onChange = vi.fn()
    let live: Editor | null = null
    render(
      <InlineField
        value={doc(paragraph(text('Hi ')))}
        onChange={onChange}
        externalVersion={0}
        onReady={(e) => { live = e }}
      />,
    )
    const editor = await waitForReady(() => live)
    act(() => {
      editor.commands.focus('end')
      editor.commands.insertContent('@ven')
    })
    // The floating list mounts on `body`, outside the field.
    const item = await screen.findByRole('menuitem', { name: 'Venue' })
    act(() => { fireEvent.click(item) })
    await waitFor(() => expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).toContain('"id":"venue"'))
    expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).not.toContain('@ven')
  })

  it('typing / opens the same variable list, since a data-section field has no block-insertion / menu (2026-09-19 feedback)', async () => {
    const onChange = vi.fn()
    let live: Editor | null = null
    render(
      <InlineField
        value={doc(paragraph(text('Hi ')))}
        onChange={onChange}
        externalVersion={0}
        onReady={(e) => { live = e }}
      />,
    )
    const editor = await waitForReady(() => live)
    act(() => {
      editor.commands.focus('end')
      editor.commands.insertContent('/ven')
    })
    const item = await screen.findByRole('menuitem', { name: 'Venue' })
    act(() => { fireEvent.click(item) })
    await waitFor(() => expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).toContain('"id":"venue"'))
    expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).not.toContain('/ven')
  })

  it('single-line: Enter picks from an open variable list instead of blurring the field', async () => {
    const onChange = vi.fn()
    let live: Editor | null = null
    render(
      <InlineField
        value={doc(paragraph(text('Hi ')))}
        onChange={onChange}
        externalVersion={0}
        singleLine
        onReady={(e) => { live = e }}
      />,
    )
    const editor = await waitForReady(() => live)
    act(() => {
      editor.commands.focus('end')
      editor.commands.insertContent('@venu')
    })
    await screen.findByRole('menuitem', { name: 'Venue' })
    act(() => { fireEvent.keyDown(editor.view.dom, { key: 'Enter' }) })
    await waitFor(() => expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).toContain('"id":"venue"'))
  })

  it('single-line: Enter blurs instead of starting a new paragraph', async () => {
    let live: Editor | null = null
    render(
      <InlineField
        value={doc(paragraph(text('Hi')))}
        onChange={() => {}}
        externalVersion={0}
        singleLine
        onReady={(e) => { live = e }}
      />,
    )
    const editor = await waitForReady(() => live)
    act(() => {
      editor.view.dom.focus()
    })
    expect(editor.isFocused).toBe(true)
    fireEvent.keyDown(editor.view.dom, { key: 'Enter' })
    expect(editor.isFocused).toBe(false)
    // No second paragraph was inserted.
    expect(editor.state.doc.content.childCount).toBe(1)
  })

  it('not single-line: Enter starts a new paragraph and stays focused (2026-09-19 feedback: a field for real text, not a one-line label, needs Enter/Backspace to behave normally)', async () => {
    let live: Editor | null = null
    render(
      <InlineField
        value={doc(paragraph(text('Hi')))}
        onChange={() => {}}
        externalVersion={0}
        onReady={(e) => { live = e }}
      />,
    )
    const editor = await waitForReady(() => live)
    act(() => {
      editor.view.dom.focus()
    })
    fireEvent.keyDown(editor.view.dom, { key: 'Enter' })
    expect(editor.isFocused).toBe(true)
    expect(editor.state.doc.content.childCount).toBe(2)
  })

  it('Shift+Enter still inserts a hard break in a single-line field', async () => {
    let live: Editor | null = null
    render(
      <InlineField
        value={doc(paragraph(text('Hi')))}
        onChange={() => {}}
        externalVersion={0}
        singleLine
        onReady={(e) => { live = e }}
      />,
    )
    const editor = await waitForReady(() => live)
    act(() => {
      editor.view.dom.focus()
    })
    fireEvent.keyDown(editor.view.dom, { key: 'Enter', shiftKey: true })
    expect(editor.isFocused).toBe(true)
  })

  it('re-hydrates only when externalVersion changes, never on a bare value prop change', async () => {
    let live: Editor | null = null
    const { rerender } = render(
      <InlineField
        value={doc(paragraph(text('First')))}
        onChange={() => {}}
        externalVersion={0}
        onReady={(e) => { live = e }}
      />,
    )
    await waitForReady(() => live)
    expect(screen.getByText('First')).toBeInTheDocument()

    rerender(
      <InlineField value={doc(paragraph(text('Second')))} onChange={() => {}} externalVersion={0} />,
    )
    expect(screen.getByText('First')).toBeInTheDocument()

    rerender(
      <InlineField value={doc(paragraph(text('Second')))} onChange={() => {}} externalVersion={1} />,
    )
    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument())
  })

  it('calls onFocus when the field gains focus', async () => {
    const onFocus = vi.fn()
    let live: Editor | null = null
    render(
      <InlineField
        value={doc(paragraph(text('Hi')))}
        onChange={() => {}}
        externalVersion={0}
        onFocus={onFocus}
        onReady={(e) => { live = e }}
      />,
    )
    const editor = await waitForReady(() => live)
    act(() => {
      editor.view.dom.focus()
    })
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it('Cmd+Z / Shift+Cmd+Z inside a field forward to the provider\'s undo/redo, and Escape blurs without throwing (no `callbacks` crash)', async () => {
    const undo = vi.fn()
    const redo = vi.fn()
    let live: Editor | null = null
    render(
      <FieldShortcutsProvider value={{ undo, redo }}>
        <InlineField value={doc(paragraph(text('Hi')))} onChange={() => {}} externalVersion={0} onReady={(e) => { live = e }} />
      </FieldShortcutsProvider>,
    )
    const editor = await waitForReady(() => live)
    await waitFor(() => expect(editor.storage.proposalEditor.callbacks.undo).toBeDefined())
    fireEvent.keyDown(editor.view.dom, { key: 'z', ctrlKey: true })
    expect(undo).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(editor.view.dom, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(redo).toHaveBeenCalledTimes(1)
    expect(() => fireEvent.keyDown(editor.view.dom, { key: 'Escape' })).not.toThrow()
  })

  it('outside any provider a field\'s Cmd+Z and Escape are inert, not errors', async () => {
    let live: Editor | null = null
    render(<InlineField value={doc(paragraph(text('Hi')))} onChange={() => {}} externalVersion={0} onReady={(e) => { live = e }} />)
    const editor = await waitForReady(() => live)
    expect(() => {
      fireEvent.keyDown(editor.view.dom, { key: 'z', ctrlKey: true })
      fireEvent.keyDown(editor.view.dom, { key: 'Escape' })
    }).not.toThrow()
  })
})
