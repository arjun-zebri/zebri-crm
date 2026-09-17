'use client'

/**
 * React state for one proposal layout under edit: an undo/redo history over
 * the layout, plus the current selection.
 *
 * @module features/proposals/editor/use-layout-editor
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useHistory } from '@/lib/branding/use-history'

import type { ProposalLayout } from '../model/layout'

import { layoutReducer, type LayoutAction, type LayoutEditorState, type Selection } from './state'
import { useExternalLayoutChange } from './use-external-layout-change'

/** What `useLayoutEditor` returns: the combined state, a dispatcher, and the undo/redo controls. */
export interface UseLayoutEditorReturn {
  state: LayoutEditorState
  /**
   * Apply one action to the layout and/or the selection.
   *
   * `opts.commit` flushes the resulting layout edit onto the undo stack
   * right away instead of waiting for the 500ms debounce - but `select` and
   * `selectNode` never touch the layout's history at all (see the
   * `SELECTION_ONLY` note below), so `{ commit: true }` on either of those
   * two has nothing to flush; it does not reach back and flush an earlier,
   * still-pending edit either. Call `commit()` to force that flush
   * regardless of what is being dispatched.
   */
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  commit: () => void
}

const NO_SELECTION: Selection = { sectionId: null, node: null }

/** Action types whose reducer branch can only ever touch the selection, never the layout (see `layoutReducer`). */
const SELECTION_ONLY: ReadonlySet<LayoutAction['type']> = new Set(['select', 'selectNode'])
/** Action types whose reducer branch can only ever touch the layout, never the selection (see `layoutReducer`). */
const LAYOUT_ONLY: ReadonlySet<LayoutAction['type']> = new Set([
  'moveSection', 'updateStyle', 'resetStyle', 'setContent', 'setName', 'toggleHideOnMobile',
])

/**
 * Drive a layout through `layoutReducer`, keeping the layout undoable and
 * the selection not.
 *
 * Why the split: `useHistory` (`lib/branding/use-history.ts`) decides
 * whether to record an undo step by JSON-comparing the whole value it
 * holds. If selection lived inside that value, clicking a different
 * section - which never touches the layout - would still look like a
 * change and push a step onto the undo stack. So the layout lives in
 * `useHistory<ProposalLayout>` and the selection lives beside it in a
 * plain `useState`; `layoutReducer` stays a pure function over the
 * combined `{ layout, selection }` shape, and this hook is the only place
 * that runs it and writes each half to its own store.
 *
 * Why `dispatch` uses `history.set`'s *updater* form: two dispatches
 * inside one event handler both run before React re-renders, so reading
 * `history.state` from the render-time closure and calling
 * `history.set(value)` would let the second dispatch silently overwrite
 * the first (it would compute its result from the same pre-handler
 * layout). `history.set((prev) => ...)` fixes that - React composes
 * queued updater functions in order, each seeing what the previous one
 * just produced. No branch of `layoutReducer` reads `state.selection` to
 * build its `layout`, so the updater can pass `selectionRef.current` in
 * and safely ignore the reducer's selection output.
 *
 * `layoutRef`/`selectionRef` are synced in effects, not written during
 * render (writing `ref.current` in the render body itself is disallowed
 * by the `react-hooks/refs` rule); this also lets `dispatch` depend only
 * on the stable `history.set` rather than the fresh `history` object
 * `useHistory` returns every render, so `dispatch`'s own identity stays
 * stable across renders too. The selection branch below only needs a
 * layout to feed `layoutReducer`'s not-found/at-cap guards, so reading it
 * from a ref that can lag one render behind is fine.
 *
 * `select` / `selectNode` skip `history.set` entirely rather than sending
 * it a same-value update: a real `set()` call resets the 500ms commit
 * timer even when the value does not change, which would otherwise let a
 * click delay an unrelated pending edit's commit.
 *
 * Two residual orderings the "did `dispatch` cause this?" flag below
 * cannot tell apart on its own: (1) a `dispatch` and an `undo`/`redo` in
 * the same batch - `undo`/`redo` also clear the node selection themselves
 * for exactly this reason, belt and braces alongside the effect; (2) a
 * same-batch round trip back to the identical layout reference (only
 * `replaceLayout` can hand back a caller-supplied reference) - handled by
 * comparing each updater's result against the *committed* layout
 * (`layoutRef.current`) rather than accumulating across the batch, so the
 * flag cannot get stuck `true`. Relatedly: `useHistory`'s own keydown
 * handler blurs the focused element before calling `undo`/`redo`
 * (`lib/branding/use-history.ts`), so a future contentEditable that
 * commits its own value on blur must stay out of this editor - a blur
 * dispatch racing the keyboard shortcut is exactly case (1) again, one
 * layer further removed from this hook's control.
 */
export function useLayoutEditor(initial: ProposalLayout): UseLayoutEditorReturn {
  // Destructured (not used as `history.set` / `history.state`) so `dispatch`
  // below can depend on the plain, stable `set` identifier: `useHistory`
  // returns a fresh wrapper *object* every render (only the functions on it
  // are individually memoised), and depending on a `history.foo` property
  // path instead of the destructured local confuses the React Compiler's
  // dependency inference (it infers the whole `history` object, which is
  // not stable, defeating the point).
  const { state: layoutState, set, undo, redo, commit, canUndo, canRedo } = useHistory<ProposalLayout>(initial)
  const [selection, setSelection] = useState<Selection>(NO_SELECTION)

  const layoutRef = useRef(layoutState)
  useEffect(() => {
    layoutRef.current = layoutState
  }, [layoutState])

  const selectionRef = useRef(selection)
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  // Set (never accumulated) inside the layout updater below, comparing
  // each updater's result directly against the last *committed* layout
  // (`layoutRef.current`, which cannot change mid-batch: its own sync
  // effect has not run yet). Comparing against the committed layout
  // rather than `||`-accumulating across same-tick updaters means a
  // same-batch round trip back to that exact reference (only
  // `replaceLayout` can produce one) reads `false` again by the end of
  // the batch, instead of getting stuck `true` from its own first, real
  // half. Read and reset by the "external change" effect further down.
  const dispatchedLayoutChange = useRef(false)

  // The two ad-hoc `{ layout, selection }` literals below feed `layoutReducer`
  // for its `.layout`/`.selection` output only - `externalVersion` is
  // `useLayoutEditor`'s own concern (see `use-external-layout-change.ts`),
  // never read or written by the pure reducer, so `0` here is a throwaway
  // filler, not a real value.
  const dispatch = useCallback((action: LayoutAction, opts?: { commit?: boolean }) => {
    if (!SELECTION_ONLY.has(action.type)) {
      set((prevLayout) => {
        const nextLayout = layoutReducer({ layout: prevLayout, selection: selectionRef.current, externalVersion: 0 }, action).layout
        // `replaceLayout` swaps in a whole caller-supplied layout (loading
        // a template, a future "duplicate template" flow) rather than
        // growing incrementally from what is already on screen, so every
        // open content editor must re-hydrate from it exactly like
        // undo/redo - flagged here as if it came from outside `dispatch`,
        // overriding the plain reference-equality check every other
        // action uses.
        dispatchedLayoutChange.current = action.type === 'replaceLayout' ? false : nextLayout !== layoutRef.current
        return nextLayout
      }, opts)
    }
    if (!LAYOUT_ONLY.has(action.type)) {
      setSelection((prevSelection) => layoutReducer({ layout: layoutRef.current, selection: prevSelection, externalVersion: 0 }, action).selection)
    }
  }, [set])

  // A layout change that did not come from `dispatch` above - Cmd+Z /
  // Ctrl+Z, which `useHistory` wires up on `window` itself and which calls
  // its own internal `undo`, bypassing this hook entirely, plus a
  // `replaceLayout` dispatch (flagged external just above) - still needs
  // the node selection cleared and `state.externalVersion` bumped, so an
  // open content editor knows to re-hydrate. See `use-external-layout-change.ts`.
  const externalVersion = useExternalLayoutChange(layoutState, dispatchedLayoutChange, setSelection)

  // Belt and braces alongside the effect above: a `dispatch` and an
  // `undo`/`redo` inside the *same* event handler both run before this
  // hook's own effects do, so the flag the effect reads can be left
  // `true` (set by `dispatch`'s own updater) even though the layout that
  // actually lands came from `undo`/`redo`, not `dispatch`. Clearing the
  // node here too closes that gap for the programmatic path; the effect
  // remains the only thing that can catch the keyboard shortcut, which
  // this hook never sees directly.
  const wrappedUndo = useCallback(() => {
    undo()
    setSelection((prev) => (prev.node ? { ...prev, node: null } : prev))
  }, [undo])
  const wrappedRedo = useCallback(() => {
    redo()
    setSelection((prev) => (prev.node ? { ...prev, node: null } : prev))
  }, [redo])

  // A `sectionId` (and any `node` under it) that no longer names a section
  // in `layout` is never exposed: batching a structural action (`addSection`
  // at the cap, `deleteSection` of an unknown id, ...) alongside another one
  // in the same handler can leave the raw `selection` state pointing at a
  // section the layout half actually refused (the selection half's guards
  // read `layoutRef.current`, which lags mid-batch - see the module doc
  // comment), and undoing an `addSection` removes the very section its own
  // dispatch selected. Filtering here, rather than trying to make every
  // producer perfectly consistent, makes a dangling selection structurally
  // impossible regardless of how it was reached.
  const state = useMemo<LayoutEditorState>(() => {
    const sectionStillExists = selection.sectionId === null || layoutState.sections.some((s) => s.id === selection.sectionId)
    return { layout: layoutState, selection: sectionStillExists ? selection : NO_SELECTION, externalVersion }
  }, [layoutState, selection, externalVersion])

  return { state, dispatch, undo: wrappedUndo, redo: wrappedRedo, canUndo, canRedo, commit }
}
