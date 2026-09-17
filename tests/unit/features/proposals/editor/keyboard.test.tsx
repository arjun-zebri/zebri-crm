// tests/unit/features/proposals/editor/keyboard.test.tsx
/**
 * Task 15: Meta+Z / Shift+Meta+Z undoing/redoing a committed content edit
 * from inside a section's TipTap editor, forwarded through
 * `extensions/history-keymap.ts` + `use-editor-shortcuts.ts` (TipTap's own
 * history is off, and `lib/branding/use-history.ts`'s window listener
 * explicitly skips a `.ProseMirror` target - without this wiring the key
 * would reach no handler at all while an editor has focus); `Mod-k`
 * opening the Text bar's Link popover the same way; the 40-section cap
 * surfacing in the add palette's trailing button as a disabled control
 * with a tooltip; and (fix round 1) `Escape` with a node selected inside
 * a focused editor landing at section level in one press, now that
 * `use-canvas-keys.ts`'s window listener skips the in-editor case
 * entirely and leaves it to the TipTap keymap alone.
 *
 * jsdom reports no Mac platform (`navigator.platform` is `""`), so
 * `prosemirror-keymap` resolves every `Mod-` binding here to `Ctrl-`, not
 * `Meta-` - these tests fire `ctrlKey`, matching the spec's own "(and
 * Ctrl on non-Mac)" note for the shortcut, not `metaKey`.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ContentSectionEditor, doc, getEditor, layoutReducer, LAYOUT_LIMITS, newSectionFor, paragraph, SectionCanvas,
  SECTION_CAP_MESSAGE, text, TextBarRow, useEditorShortcuts, useLayoutEditor, useRegisteredEditor,
  type LayoutAction, type LayoutEditorState, type ProposalLayout, type Section, type TextBarHandle,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

/** A content section pre-filled with "Hello" - the harness's only section, so its id is known up front. */
function helloSection(): Section {
  return { ...newSectionFor('content'), content: doc(paragraph(text('Hello'))) }
}

/** Waits for `sectionId`'s editor to register (`editor-registry.ts`) and returns it. */
async function waitForEditor(sectionId: string): Promise<Editor> {
  await waitFor(() => expect(getEditor(sectionId)).not.toBeNull())
  return getEditor(sectionId)!
}

/** What {@link Harness}'s `onState` reports on every render - everything a test needs without the harness owning any buttons of its own. */
interface HarnessState {
  canUndo: boolean
  canRedo: boolean
  selection: LayoutEditorState['selection']
  /** The real `dispatch` from `useLayoutEditor`, so a test can force a selection (e.g. a node selection) without driving it through the DOM. */
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
}

/**
 * Mounts one content section's editor behind the real `useLayoutEditor` +
 * `useEditorShortcuts` wiring `template-editor-body.tsx` uses, minus the
 * header/canvas chrome this test does not need. Renders `TextBarRow`
 * (not the `BubbleMenu`-wrapped `TextBar`) for the same reason
 * `text-bar.test.tsx` does: `Mod-k`'s effect is `TextBarHandle.openLink()`
 * setting the row's own `linkOpen` state, independent of whether a
 * floating bubble would currently be visible.
 *
 * `onState` reports the hook's latest state on every render, since the
 * harness renders no undo/redo/selection UI of its own.
 */
function Harness({ initial, onState }: { initial: ProposalLayout; onState: (s: HarnessState) => void }) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useLayoutEditor(initial)
  const textBarRef = useRef<TextBarHandle>(null)
  const sectionEditor = useRegisteredEditor(state.selection.sectionId)
  useEditorShortcuts({ state, dispatch, undo, redo, textBarRef })
  onState({ canUndo, canRedo, selection: state.selection, dispatch })

  // Selects the section on mount, matching what a real click/focus into
  // its editor would do (`onFocusSection` below) - the harness needs the
  // section selected before any editor exists for `TextBarRow` to mount.
  useEffect(() => {
    dispatch({ type: 'select', sectionId: initial.sections[0]!.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, selecting the harness's one fixed section.
  }, [])

  const section = state.layout.sections[0]!
  return (
    <div>
      <ContentSectionEditor
        sectionId={section.id}
        content={section.content!}
        externalVersion={state.externalVersion}
        branding={branding}
        onChange={(id, content) => dispatch({ type: 'setContent', id, content })}
        onFocusSection={(id) => dispatch({ type: 'select', sectionId: id })}
        onNodeSelect={() => {}}
      />
      {sectionEditor ? <TextBarRow editor={sectionEditor} ref={textBarRef} /> : null}
    </div>
  )
}

describe('keyboard shortcuts inside a section editor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('Ctrl+Z undoes a committed content edit while the editor has focus, and Shift+Ctrl+Z redoes it', async () => {
    const section = helloSection()
    const initial: ProposalLayout = { version: 2, sections: [section] }
    let latest: HarnessState = { canUndo: false, canRedo: false, selection: { sectionId: null, node: null }, dispatch: () => {} }

    render(<Harness initial={initial} onState={(s) => { latest = s }} />)
    const editor = await waitForEditor(section.id)
    expect(screen.getByText('Hello')).toBeInTheDocument()

    // "Types" past the end of the doc - the same `insertContentAt` pattern
    // `content-section-editor.test.tsx` uses to simulate an edit.
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' world')
    })
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(latest.canUndo).toBe(false) // not committed yet

    // Past `useHistory`'s 500ms commit debounce: the edit becomes an undo step.
    act(() => { vi.advanceTimersByTime(550) })
    expect(latest.canUndo).toBe(true)

    fireEvent.keyDown(editor.view.dom, { key: 'z', ctrlKey: true })
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.queryByText('Hello world')).not.toBeInTheDocument()
    expect(latest.canUndo).toBe(false)
    expect(latest.canRedo).toBe(true)

    fireEvent.keyDown(editor.view.dom, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(latest.canRedo).toBe(false)
    expect(latest.canUndo).toBe(true)
  })

  it('Ctrl+K opens the Text bar\'s link popover from inside the editor', async () => {
    const section = helloSection()
    const initial: ProposalLayout = { version: 2, sections: [section] }

    render(<Harness initial={initial} onState={() => {}} />)
    const editor = await waitForEditor(section.id)
    expect(screen.queryByRole('textbox', { name: 'Link' })).not.toBeInTheDocument()

    fireEvent.keyDown(editor.view.dom, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('textbox', { name: 'Link' })).toBeInTheDocument()
  })

  // Fix round 1: `use-canvas-keys.ts`'s window listener now skips the
  // in-editor case entirely, leaving `Escape` to the TipTap keymap alone
  // (`extensions/history-keymap.ts` -> `use-editor-shortcuts.ts`'s
  // `escape` callback, always `stepSelectionOut`'s `inEditor: true`
  // branch). That branch selects the owning section outright - it does
  // not fall through to `hasNodeSelected`'s "clear the node first" tier -
  // so a node selected inside a focused editor should land at section
  // level on the very first `Escape`, not require a second press to
  // avoid landing at "nothing selected".
  it('Escape with a node selected inside a focused editor ends at section level, not at nothing', async () => {
    const section = helloSection()
    const initial: ProposalLayout = { version: 2, sections: [section] }
    let latest: HarnessState = { canUndo: false, canRedo: false, selection: { sectionId: null, node: null }, dispatch: () => {} }

    render(<Harness initial={initial} onState={(s) => { latest = s }} />)
    const editor = await waitForEditor(section.id)
    expect(latest.selection.sectionId).toBe(section.id)

    act(() => {
      latest.dispatch({ type: 'selectNode', node: { sectionId: section.id, nodeType: 'horizontalRule', pos: 0 } })
    })
    expect(latest.selection.node).not.toBeNull()

    fireEvent.keyDown(editor.view.dom, { key: 'Escape' })

    expect(latest.selection.node).toBeNull()
    expect(latest.selection.sectionId).toBe(section.id)
  })
})

/** Mirrors `section-canvas.test.tsx`'s own local harness: a real `layoutReducer` behind plain `useState`, wired to `SectionCanvas` directly. */
function CanvasHarness({ sections }: { sections: Section[] }) {
  const [state, setState] = useState<LayoutEditorState>({ layout: { version: 2, sections }, selection: { sectionId: null, node: null }, externalVersion: 0 })
  const dispatch = (action: LayoutAction) => setState((prev) => layoutReducer(prev, action))
  return <SectionCanvas state={state} dispatch={dispatch} branding={branding} device="desktop" role="mc" />
}

describe('the 40-section cap', () => {
  it('disables the trailing "Add section" button with a tooltip once the layout is full', () => {
    const sections = Array.from({ length: LAYOUT_LIMITS.maxSections }, () => newSectionFor('content'))
    render(<CanvasHarness sections={sections} />)

    const addButton = screen.getByRole('button', { name: 'Add section' })
    expect(addButton).toBeDisabled()

    // React derives onMouseEnter/onMouseLeave from the real `mouseover`/
    // `mouseout` DOM events, not `mouseenter`/`mouseleave`
    // (`registerDirectEvent("onMouseEnter", ["mouseout", "mouseover"])` in
    // react-dom) - `fireEvent.mouseOver` is what actually reaches
    // `Tooltip`'s handler here.
    fireEvent.mouseOver(addButton)
    expect(screen.getByText(SECTION_CAP_MESSAGE)).toBeInTheDocument()
  })

  it('leaves the trailing "Add section" button enabled below the cap', () => {
    const sections = [helloSection()]
    render(<CanvasHarness sections={sections} />)

    expect(screen.getByRole('button', { name: 'Add section' })).not.toBeDisabled()
  })
})
