// tests/unit/features/proposals/editor/text-bar.test.tsx
/**
 * Task 10: `TextBarRow` (the bubble text bar's plain row) and its pure
 * helpers, `readTextState`/`applyTextStyle`/`bubbleShouldShow`
 * (`text-bar-style.ts`). Nothing mounts `TextBar` (the `BubbleMenu`
 * wrapper) yet: Task 12 does, resolving `editor` through
 * `useRegisteredEditor`. So these tests build a bare editor directly
 * with `buildRichDocExtensions({})` and render `TextBarRow` against it
 * headlessly (no `EditorContent`, no floating-ui), per the brief.
 *
 * The `TextBar` describe block below (final review Finding 1) mounts the
 * real `BubbleMenu`-wrapped component, with `@tiptap/react/menus`'
 * `BubbleMenu` itself stubbed to a plain passthrough `div`: a throwaway
 * spike confirmed the real one never renders anything into the DOM under
 * jsdom (no `ResizeObserver`-driven floating-ui lifecycle runs, so the
 * portal never opens) - stubbing it is the only way to assert what
 * `TextBar` actually passes to it without a real browser.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { useEditor } from '@tiptap/react'
import { createRef, useEffect, type ReactNode, type Ref } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  applyTextStyle, bubbleShouldShow, buildRichDocExtensions, doc, LINK_ERROR, paragraph, readTextState, text,
  TextBar, TextBarRow, type TextBarHandle,
} from '@/features/proposals'

vi.mock('@tiptap/react/menus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiptap/react/menus')>()
  return {
    ...actual,
    BubbleMenu: ({ className, children }: { className?: string; children?: ReactNode }) => (
      <div data-testid="bubble-menu-stub" className={className}>{children}</div>
    ),
  }
})

/**
 * A bare editor (no `EditorContent`, no `BubbleMenu`) holding "Hello
 * world", handed to `onReady` once TipTap has created it, with
 * `TextBarRow` rendered against it. A TipTap `Editor` builds its own
 * `EditorView` on an offscreen element internally; it works fully
 * (commands, selection, `isActive`) without ever being mounted into the
 * DOM via `EditorContent`.
 */
function Harness({ onReady, ref }: { onReady: (editor: Editor) => void; ref?: Ref<TextBarHandle> | undefined }) {
  const editor = useEditor({
    extensions: buildRichDocExtensions({}),
    content: doc(paragraph(text('Hello world'))),
    immediatelyRender: false,
  })
  useEffect(() => {
    if (editor) onReady(editor)
  }, [editor, onReady])
  if (!editor) return null
  return <TextBarRow editor={editor} ref={ref} />
}

/** Renders the harness, waits for the editor, and selects "Hello" (positions 1..6: the doc's first 5 characters). */
async function setup(ref?: Ref<TextBarHandle>): Promise<Editor> {
  let current: Editor | null = null
  render(<Harness onReady={(e) => { current = e }} ref={ref} />)
  await waitFor(() => expect(current).not.toBeNull())
  const editor = current!
  act(() => {
    editor.commands.setTextSelection({ from: 1, to: 6 })
  })
  return editor
}

describe('TextBarRow', () => {
  it('exposes role="toolbar" with aria-label="Text" over a text selection', async () => {
    await setup()
    expect(screen.getByRole('toolbar', { name: 'Text' })).toBeInTheDocument()
  })

  it('clicking Bold toggles the bold mark on the selection', async () => {
    const editor = await setup()
    expect(editor.isActive('bold')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(editor.isActive('bold')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Regular' }))
    expect(editor.isActive('bold')).toBe(false)
  })

  it('choosing "Heading 2" converts the paragraph', async () => {
    const editor = await setup()
    expect(editor.isActive('paragraph')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Paragraph' }))
    fireEvent.click(screen.getByRole('button', { name: 'Heading 2' }))

    expect(editor.isActive('heading', { level: 2 })).toBe(true)
  })

  it('the link popover applies a valid href and rejects an unsafe one', async () => {
    const editor = await setup()

    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Link' }), { target: { value: 'https://zebri.com.au' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(editor.getAttributes('link').href).toBe('https://zebri.com.au')

    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Link' }), { target: { value: 'javascript:alert(1)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByText(LINK_ERROR)).toBeInTheDocument()
    // Rejected: the mark from the first, valid apply is untouched.
    expect(editor.getAttributes('link').href).toBe('https://zebri.com.au')
  })

  it('the link popover\'s Remove clears an active link', async () => {
    const editor = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Link' }), { target: { value: 'https://zebri.com.au' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(editor.isActive('link')).toBe(false)
  })

  it('the "..." menu\'s "Aa" UPPER sets the textCase mark to uppercase', async () => {
    const editor = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'UPPER' }))

    expect(editor.isActive('textCase')).toBe(true)
    expect(editor.getAttributes('textCase')).toEqual({ value: 'uppercase' })
  })

  it('the "..." menu\'s Bulleted list toggles the bulletList node on and back off', async () => {
    const editor = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Bulleted list' }))
    expect(editor.isActive('bulletList')).toBe(true)

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Bulleted list' }))
    expect(editor.isActive('bulletList')).toBe(false)
  })

  it('the ref handle\'s openLink() opens the link popover', async () => {
    const ref = createRef<TextBarHandle>()
    await setup(ref)
    act(() => ref.current?.openLink())
    expect(screen.getByRole('textbox', { name: 'Link' })).toBeInTheDocument()
  })
})

/** Mounts the real `BubbleMenu`-wrapped `TextBar` (not `TextBarRow`) against a fresh headless editor. */
function BubbleHarness({ onReady }: { onReady: (editor: Editor) => void }) {
  const editor = useEditor({
    extensions: buildRichDocExtensions({}),
    content: doc(paragraph(text('Hello world'))),
    immediatelyRender: false,
  })
  useEffect(() => {
    if (editor) onReady(editor)
  }, [editor, onReady])
  if (!editor) return null
  return <TextBar editor={editor} />
}

describe('TextBar', () => {
  it('mounts BubbleMenu with the z-30 class that clears the overlay strip (final review Finding 1)', async () => {
    let current: Editor | null = null
    render(<BubbleHarness onReady={(e) => { current = e }} />)
    await waitFor(() => expect(current).not.toBeNull())

    const stub = screen.getByTestId('bubble-menu-stub')
    expect(stub.className.split(' ')).toContain('z-30')
    // The real `TextBarRow` still renders inside it, wired to the same editor.
    expect(screen.getByRole('toolbar', { name: 'Text' })).toBeInTheDocument()
  })
})

describe('readTextState', () => {
  it('detects the active heading level, falling back to paragraph', async () => {
    const editor = await setup()
    expect(readTextState(editor).style).toBe('paragraph')

    act(() => {
      editor.chain().focus().setHeading({ level: 3 }).run()
    })
    expect(readTextState(editor).style).toBe('heading3')
  })

  it('detects active marks written through applyTextStyle', async () => {
    const editor = await setup()
    act(() => applyTextStyle(editor, { bold: true, italic: true, underline: true }))

    const state = readTextState(editor)
    expect(state.bold).toBe(true)
    expect(state.italic).toBe(true)
    expect(state.underline).toBe(true)
    expect(state.strike).toBe(false)
  })
})

describe('bubbleShouldShow', () => {
  it('shows for a real text selection', () => {
    expect(bubbleShouldShow({ hasTextSelection: true, menuFocused: false })).toBe(true)
  })
  it('stays visible while one of its own popovers holds focus, even with no selection', () => {
    expect(bubbleShouldShow({ hasTextSelection: false, menuFocused: true })).toBe(true)
  })
  it('hides with neither a selection nor focus in a popover', () => {
    expect(bubbleShouldShow({ hasTextSelection: false, menuFocused: false })).toBe(false)
  })
})
