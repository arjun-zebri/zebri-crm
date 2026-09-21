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
  applyTextStyle, bubbleShouldShow, buildRichDocExtensions, defaultTheme, doc, LINK_ERROR, paragraph, readTextState, text,
  TextBar, TextBarRow, type ProposalTheme, type TextBarHandle,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const theme = defaultTheme(branding)

vi.mock('@tiptap/react/menus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiptap/react/menus')>()
  return {
    ...actual,
    BubbleMenu: ({ className, children, appendTo, pluginKey }: { className?: string; children?: ReactNode; appendTo?: HTMLElement | (() => HTMLElement); pluginKey?: string }) => {
      const host = typeof appendTo === 'function' ? appendTo() : appendTo
      return <div data-testid="bubble-menu-stub" className={className} data-append-to={host === document.body ? 'body' : host?.tagName ?? 'none'} data-plugin-key={pluginKey}>{children}</div>
    },
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
function Harness({
  onReady, ref, theme: t = theme,
}: { onReady: (editor: Editor) => void; ref?: Ref<TextBarHandle> | undefined; theme?: ProposalTheme }) {
  const editor = useEditor({
    extensions: buildRichDocExtensions({}),
    content: doc(paragraph(text('Hello world'))),
    immediatelyRender: false,
  })
  useEffect(() => {
    if (editor) onReady(editor)
  }, [editor, onReady])
  if (!editor) return null
  return <TextBarRow editor={editor} theme={t} ref={ref} />
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

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
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

  it('the "..." menu\'s Typography section writes a Weight override and the line-height/letter-spacing/top-spacing steppers', async () => {
    const editor = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))

    // "Semibold"/"Medium", not "Bold": that label already names the
    // primary row's Bold toggle, so picking it would collide with it.
    fireEvent.click(screen.getByRole('button', { name: 'Default' }))
    fireEvent.click(screen.getByRole('button', { name: 'Semibold' }))
    expect(editor.getAttributes('textStyle')).toEqual(expect.objectContaining({ fontWeight: '600' }))

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Line height' }), { target: { value: '1.6' } })
    expect(editor.getAttributes('paragraph')).toEqual(expect.objectContaining({ lineHeight: '1.60' }))

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Letter spacing' }), { target: { value: '0.02' } })
    expect(editor.getAttributes('textStyle')).toEqual(expect.objectContaining({ letterSpacing: '0.020em' }))

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Top spacing' }), { target: { value: '0.5' } })
    expect(editor.getAttributes('paragraph')).toEqual(expect.objectContaining({ topSpacing: '0.50em' }))
  })

  it('the ref handle\'s openLink() opens the link popover', async () => {
    const ref = createRef<TextBarHandle>()
    await setup(ref)
    act(() => ref.current?.openLink())
    expect(screen.getByRole('textbox', { name: 'Link' })).toBeInTheDocument()
  })

  it('the Size stepper reseeds from a Global style edit, for a selection with no fontSize override of its own', async () => {
    let current: Editor | null = null
    const { rerender } = render(<Harness onReady={(e) => { current = e }} theme={theme} />)
    await waitFor(() => expect(current).not.toBeNull())
    const editor = current!
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 6 })
      editor.chain().focus().setHeading({ level: 1 }).run()
    })

    expect(screen.getByRole('spinbutton', { name: 'Size' })).toHaveValue(theme.text.heading1.size)

    // Simulates a Global style edit to Heading 1: the same selection, still
    // with no fontSize override, must reflect the new theme value.
    const editedTheme: ProposalTheme = { ...theme, text: { ...theme.text, heading1: { ...theme.text.heading1, size: theme.text.heading1.size + 20 } } }
    rerender(<Harness onReady={() => {}} theme={editedTheme} />)

    expect(screen.getByRole('spinbutton', { name: 'Size' })).toHaveValue(editedTheme.text.heading1.size)
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
  return <TextBar editor={editor} theme={theme} />
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

  it('appends to its own host under body, never body itself, so the bubble still hides when focus moves to another field', async () => {
    // `BubbleMenuView.blurHandler` keeps the bubble open whenever
    // `element.parentNode.contains(event.relatedTarget)`. With body as the
    // parent that is every element on the page, so clicking from one field
    // into another never hid the bar (2026-09-19 testimonials feedback).
    let current: Editor | null = null
    render(<BubbleHarness onReady={(e) => { current = e }} />)
    await waitFor(() => expect(current).not.toBeNull())

    const stub = screen.getByTestId('bubble-menu-stub')
    expect(stub.dataset.appendTo).not.toBe('body')
    expect(stub.dataset.appendTo).not.toBe('none')
  })

  describe('hide on an outside pointerdown', () => {
    // The plugin only hides on an editor `blur`. After a bar control took
    // focus (Bold, a select, the link field) the editor is already blurred,
    // so clicking anywhere else never blurred it again and the bar stayed
    // put over a field nobody was editing (2026-09-19 testimonials
    // feedback). `TextBar` therefore also hides itself, through the
    // plugin's documented `setMeta(pluginKey, 'hide')`, on any pointerdown
    // outside both the editor and the bar's own popovers.
    async function mount(): Promise<{ editor: Editor; hides: () => number }> {
      let current: Editor | null = null
      render(<BubbleHarness onReady={(e) => { current = e }} />)
      await waitFor(() => expect(current).not.toBeNull())
      const editor = current!
      let count = 0
      editor.on('transaction', ({ transaction }) => { if (transaction.getMeta('textBar') === 'hide') count += 1 })
      act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }) })
      return { editor, hides: () => count }
    }

    it('names its plugin so the hide meta reaches the right BubbleMenu', async () => {
      await mount()
      expect(screen.getByTestId('bubble-menu-stub').dataset.pluginKey).toBe('textBar')
    })

    it('a pointerdown on the page outside the editor and the bar sends hide', async () => {
      const { hides } = await mount()
      fireEvent.pointerDown(document.body)
      expect(hides()).toBe(1)
    })

    it('a pointerdown inside the editor, or inside a bar popover, does not', async () => {
      const { editor, hides } = await mount()
      fireEvent.pointerDown(editor.view.dom)
      fireEvent.pointerDown(screen.getByRole('toolbar', { name: 'Text' }))
      const popover = document.createElement('div')
      popover.setAttribute('data-text-bar', '')
      document.body.appendChild(popover)
      fireEvent.pointerDown(popover)
      popover.remove()
      expect(hides()).toBe(0)
    })

    it('with no text selected there is nothing to hide, so nothing is dispatched', async () => {
      const { editor, hides } = await mount()
      act(() => { editor.commands.setTextSelection(1) })
      fireEvent.pointerDown(document.body)
      expect(hides()).toBe(0)
    })
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

  it('fontWeight/letterSpacing round-trip through the textStyle mark, independent of bold', async () => {
    const editor = await setup()
    act(() => applyTextStyle(editor, { fontWeight: '600', letterSpacing: '0.05em' }))

    const state = readTextState(editor)
    expect(state.fontWeight).toBe('600')
    expect(state.letterSpacing).toBe('0.05em')
    expect(state.bold).toBe(false)

    act(() => applyTextStyle(editor, { fontWeight: null, letterSpacing: null }))
    expect(readTextState(editor).fontWeight).toBeNull()
    expect(readTextState(editor).letterSpacing).toBeNull()
  })

  it('lineHeight/topSpacing round-trip as block attrs on the active paragraph', async () => {
    const editor = await setup()
    act(() => applyTextStyle(editor, { lineHeight: '1.4', topSpacing: '0.5em' }))

    const state = readTextState(editor)
    expect(state.lineHeight).toBe('1.4')
    expect(state.topSpacing).toBe('0.5em')
    expect(editor.getAttributes('paragraph')).toEqual(expect.objectContaining({ lineHeight: '1.4', topSpacing: '0.5em' }))
  })

  it('lineHeight/topSpacing write to whichever block type the selection is actually in (heading, not paragraph)', async () => {
    const editor = await setup()
    act(() => editor.chain().focus().setHeading({ level: 2 }).run())
    act(() => applyTextStyle(editor, { lineHeight: '1.1', topSpacing: '0.25em' }))

    const state = readTextState(editor)
    expect(state.lineHeight).toBe('1.1')
    expect(state.topSpacing).toBe('0.25em')
    expect(editor.getAttributes('heading')).toEqual(expect.objectContaining({ lineHeight: '1.1', topSpacing: '0.25em' }))
  })
})

describe('textAlign node attribute', () => {
  /**
   * Live bug 2026-09-20: "Align left" did nothing inside a centred
   * section (or on a heading whose theme role is centred), because a
   * `'left'` value was treated as "unset" and so fell through to the
   * section/role alignment. A user's explicit pick has to win over both,
   * exactly the way "Align center"/"Align right" already did.
   */
  it('"Align left" writes a real inline override, the same as "Align center"', async () => {
    const editor = await setup()
    act(() => applyTextStyle(editor, { align: 'center' }))
    expect(editor.view.dom.querySelector('p')?.style.textAlign).toBe('center')

    act(() => applyTextStyle(editor, { align: 'left' }))
    expect(editor.view.dom.querySelector('p')?.style.textAlign).toBe('left')
    expect(editor.getAttributes('paragraph').textAlign).toBe('left')
  })

  /**
   * The original reason `'left'` was once erased: pasted content (Word,
   * Google Docs, ...) very commonly carries an explicit
   * `text-align: left` that is its default, not the author's intent. If
   * it landed as a stored `'left'` it would pin every pasted paragraph
   * left for good and hide a later Global style Alignment change. That
   * is handled on parse instead, so only a deliberate pill pick stores
   * `'left'`.
   */
  it('a pasted "text-align: left" parses as unset, while a pasted "center" is kept', async () => {
    const editor = await setup()
    act(() => editor.commands.setContent('<p style="text-align: left">Pasted</p><p style="text-align: center">Centred</p>'))
    const [first, second] = editor.getJSON().content ?? []
    expect(first?.attrs?.textAlign).toBeNull()
    expect(second?.attrs?.textAlign).toBe('center')
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
