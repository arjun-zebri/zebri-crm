/**
 * `useLayoutEditor`: the layout lives in `useHistory` (undoable), the
 * selection lives beside it in plain state (not undoable). These tests
 * exercise the split directly: a style edit becomes an undo step once the
 * 500ms commit debounce elapses, while selecting never does.
 *
 * @module tests/unit/features/proposals/editor/use-layout-editor
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultTemplateLayout, LAYOUT_LIMITS, newSectionFor, useLayoutEditor } from '@/features/proposals'

const COMMIT_DEBOUNCE_MS = 500

describe('useLayoutEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts from the initial layout with nothing selected and no history', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    expect(result.current.state.layout).toBe(initial)
    expect(result.current.state.selection).toEqual({ sectionId: null, node: null })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('two style edits, each committed past the debounce, become two undo steps that fully revert', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    // sections[0] is the Hero preset, which already starts `height: 'full'`;
    // sections[1] (Note) starts `fit` with inherited padding, so both patches below are real changes.
    const id = initial.sections[1]!.id

    act(() => { result.current.dispatch({ type: 'updateStyle', id, patch: { height: 'full' } }) })
    expect(result.current.state.layout.sections[1]?.style.height).toBe('full')
    act(() => { vi.advanceTimersByTime(COMMIT_DEBOUNCE_MS + 50) })
    expect(result.current.canUndo).toBe(true)

    act(() => { result.current.dispatch({ type: 'updateStyle', id, patch: { padding: 'roomy' } }) })
    act(() => { vi.advanceTimersByTime(COMMIT_DEBOUNCE_MS + 50) })
    expect(result.current.state.layout.sections[1]?.style).toMatchObject({ height: 'full', padding: 'roomy' })

    act(() => { result.current.undo() })
    expect(result.current.state.layout.sections[1]?.style.height).toBe('full')
    expect(result.current.state.layout.sections[1]?.style.padding).toBe(initial.sections[1]!.style.padding)

    act(() => { result.current.undo() })
    expect(result.current.state.layout).toEqual(initial)
    expect(result.current.canUndo).toBe(false)
  })

  it('selecting a section never creates an undo step, even past the debounce window', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const id = initial.sections[0]!.id

    act(() => { result.current.dispatch({ type: 'select', sectionId: id }) })
    expect(result.current.state.selection.sectionId).toBe(id)
    act(() => { vi.advanceTimersByTime(COMMIT_DEBOUNCE_MS + 50) })
    expect(result.current.canUndo).toBe(false)
    // The layout itself never changed, so it is still the exact same reference.
    expect(result.current.state.layout).toBe(initial)
  })

  it('undo clears a node selection but leaves the section selection alone', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const id = initial.sections[1]!.id

    act(() => { result.current.dispatch({ type: 'updateStyle', id, patch: { height: 'full' } }) })
    act(() => { vi.advanceTimersByTime(COMMIT_DEBOUNCE_MS + 50) })
    act(() => { result.current.dispatch({ type: 'selectNode', node: { sectionId: id, nodeType: 'heading', pos: 0 } }) })
    expect(result.current.state.selection.node).not.toBeNull()

    act(() => { result.current.undo() })
    expect(result.current.state.selection.node).toBeNull()
    expect(result.current.state.selection.sectionId).toBe(id)
  })

  it('commit() flushes an edit immediately, without waiting for the debounce', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const id = initial.sections[1]!.id

    act(() => { result.current.dispatch({ type: 'updateStyle', id, patch: { height: 'full' } }) })
    expect(result.current.canUndo).toBe(false)
    act(() => { result.current.commit() })
    expect(result.current.canUndo).toBe(true)
  })

  // Repro scenarios from task-3-review.md finding 1: two dispatches inside
  // one event handler both run before React re-renders, so reading
  // `history.state` from a render-time closure would let the second
  // dispatch's computed result silently overwrite the first.
  it('two updateStyle dispatches in the same handler both apply, not just the last one', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const id = initial.sections[1]!.id

    act(() => {
      result.current.dispatch({ type: 'updateStyle', id, patch: { height: 'full' } })
      result.current.dispatch({ type: 'updateStyle', id, patch: { padding: 'roomy' } }, { commit: true })
    })
    expect(result.current.state.layout.sections[1]?.style).toMatchObject({ height: 'full', padding: 'roomy' })
  })

  it('addSection then moveSection in the same handler both apply', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const section = newSectionFor('content')

    act(() => {
      result.current.dispatch({ type: 'addSection', at: 0, section })
      result.current.dispatch({ type: 'moveSection', from: 0, to: 2 }, { commit: true })
    })
    expect(result.current.state.layout.sections).toHaveLength(initial.sections.length + 1)
    expect(result.current.state.layout.sections[2]?.id).toBe(section.id)
  })

  it('select then deleteSection of a different section in the same handler keeps the selection', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const a = initial.sections[0]!.id
    const b = initial.sections[1]!.id

    act(() => {
      result.current.dispatch({ type: 'select', sectionId: a })
      result.current.dispatch({ type: 'deleteSection', id: b }, { commit: true })
    })
    expect(result.current.state.selection.sectionId).toBe(a)
    expect(result.current.state.layout.sections.some((s) => s.id === b)).toBe(false)
  })

  // Finding 3: `useHistory` installs its own window Cmd+Z/Ctrl+Z listener
  // and calls its internal `undo` directly, bypassing this hook's own
  // `undo`/`redo` wrappers entirely.
  it('the window Cmd+Z shortcut useHistory installs also clears the node selection', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const id = initial.sections[1]!.id

    act(() => { result.current.dispatch({ type: 'updateStyle', id, patch: { height: 'full' } }) })
    act(() => { vi.advanceTimersByTime(COMMIT_DEBOUNCE_MS + 50) })
    act(() => { result.current.dispatch({ type: 'selectNode', node: { sectionId: id, nodeType: 'heading', pos: 0 } }) })
    expect(result.current.state.selection.node).not.toBeNull()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }))
    })
    expect(result.current.state.layout.sections[1]?.style.height).toBe(initial.sections[1]!.style.height)
    expect(result.current.state.selection.node).toBeNull()
    expect(result.current.state.selection.sectionId).toBe(id)
  })

  // Fix round 2, finding 1: the "did dispatch cause this?" flag must not
  // get stuck `true` from a same-batch round trip back to the exact same
  // committed layout reference (only `replaceLayout` can produce one), or
  // a later, unrelated external change (the keyboard shortcut) would be
  // wrongly treated as dispatch's own and skip clearing the node.
  it('a same-batch replaceLayout round trip does not leave a later Meta+Z unable to clear the node', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const id = initial.sections[1]!.id
    const other = defaultTemplateLayout('celebrant')

    // One committed edit, so the later Meta+Z has something to undo.
    act(() => { result.current.dispatch({ type: 'updateStyle', id, patch: { height: 'full' } }) })
    act(() => { vi.advanceTimersByTime(COMMIT_DEBOUNCE_MS + 50) })
    const styled = result.current.state.layout

    // Round trip in one batch, away and back to the exact same reference.
    // `replaceLayout` clears the selection itself, so this step alone
    // proves nothing about the flag; the point is what it leaves behind
    // for the *next* external change.
    act(() => {
      result.current.dispatch({ type: 'replaceLayout', layout: other })
      result.current.dispatch({ type: 'replaceLayout', layout: styled })
    })
    expect(result.current.state.layout).toBe(styled)

    // `selectNode` is SELECTION_ONLY - it never touches `set` or the flag,
    // so this alone cannot mask a flag stuck from the round trip above.
    act(() => { result.current.dispatch({ type: 'selectNode', node: { sectionId: id, nodeType: 'heading', pos: 0 } }) })
    expect(result.current.state.selection.node).not.toBeNull()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }))
    })
    // Sanity check the shortcut actually undid something, so the next
    // assertion is not vacuously true.
    expect(result.current.state.layout).not.toBe(styled)
    expect(result.current.state.selection.node).toBeNull()
  })

  // Fix round 2, finding 1 (belt and braces): a `dispatch` and the
  // returned `undo` in the same handler - the flag the effect reads stays
  // `true` from `dispatch`'s own updater even though the layout that lands
  // came from `undo`, not `dispatch`. `undo`/`redo` must clear the node
  // selection themselves rather than relying on the effect for this case.
  it('undo() clears the node selection even when dispatch and undo() run in the same handler', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const id = initial.sections[1]!.id

    act(() => { result.current.dispatch({ type: 'updateStyle', id, patch: { height: 'full' } }) })
    act(() => { vi.advanceTimersByTime(COMMIT_DEBOUNCE_MS + 50) })
    act(() => { result.current.dispatch({ type: 'selectNode', node: { sectionId: id, nodeType: 'heading', pos: 0 } }) })
    expect(result.current.state.selection.node).not.toBeNull()

    act(() => {
      result.current.dispatch({ type: 'updateStyle', id, patch: { padding: 'roomy' } })
      result.current.undo()
    })
    expect(result.current.state.selection.node).toBeNull()
  })

  // Fix round 2, finding 2: the exposed selection must never dangle -
  // point at a section id the layout no longer has, whether from a
  // same-batch guard reading a stale layout snapshot or from an undo that
  // removed the very section its own dispatch had selected.
  it('at the section cap, two addSection dispatches in one handler never leave the refused section selected', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))

    while (result.current.state.layout.sections.length < LAYOUT_LIMITS.maxSections - 1) {
      act(() => { result.current.dispatch({ type: 'addSection', at: 0, section: newSectionFor('content') }) })
    }
    expect(result.current.state.layout.sections).toHaveLength(LAYOUT_LIMITS.maxSections - 1)

    const accepted = newSectionFor('content')
    const refused = newSectionFor('content')
    act(() => {
      result.current.dispatch({ type: 'addSection', at: 0, section: accepted })
      result.current.dispatch({ type: 'addSection', at: 0, section: refused })
    })
    expect(result.current.state.layout.sections).toHaveLength(LAYOUT_LIMITS.maxSections)
    expect(result.current.state.layout.sections.some((s) => s.id === refused.id)).toBe(false)
    expect(result.current.state.selection.sectionId).not.toBe(refused.id)
  })

  it('undoing an addSection whose section was selected clears the selection', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const section = newSectionFor('content')

    act(() => { result.current.dispatch({ type: 'addSection', at: 0, section }) })
    expect(result.current.state.selection.sectionId).toBe(section.id)
    act(() => { result.current.commit() })

    act(() => { result.current.undo() })
    expect(result.current.state.layout.sections.some((s) => s.id === section.id)).toBe(false)
    expect(result.current.state.selection.sectionId).toBeNull()
  })

  // `state.externalVersion` is what `ContentSectionEditor` watches to
  // decide whether to re-hydrate its live TipTap doc from `content`
  // (Phase 2 fix report): it must bump on exactly the layout changes that
  // do not grow incrementally from what an open editor already holds -
  // undo, redo, `replaceLayout` - and never on an ordinary dispatch, or
  // every keystroke would force a needless (and, mid-transaction, actively
  // destructive) re-hydration.
  it('externalVersion only bumps on undo, redo, and replaceLayout - never on an ordinary dispatch', () => {
    const initial = defaultTemplateLayout('mc')
    const { result } = renderHook(() => useLayoutEditor(initial))
    const id = initial.sections[1]!.id
    expect(result.current.state.externalVersion).toBe(0)

    act(() => { result.current.dispatch({ type: 'setContent', id, content: { type: 'doc', content: [] } }) })
    expect(result.current.state.externalVersion).toBe(0)

    act(() => { result.current.dispatch({ type: 'updateStyle', id, patch: { height: 'full' } }) })
    act(() => { vi.advanceTimersByTime(COMMIT_DEBOUNCE_MS + 50) })
    expect(result.current.state.externalVersion).toBe(0)

    act(() => { result.current.undo() })
    expect(result.current.state.externalVersion).toBe(1)

    act(() => { result.current.redo() })
    expect(result.current.state.externalVersion).toBe(2)

    const replacement = defaultTemplateLayout('celebrant')
    act(() => { result.current.dispatch({ type: 'replaceLayout', layout: replacement }) })
    expect(result.current.state.externalVersion).toBe(3)
  })
})
