'use client'

/**
 * Wires Meta+Z / Shift+Meta+Z / Meta+Y (undo/redo), Meta+K (open the Text
 * bar's Link popover) and Escape (step the selection out one level)
 * through every mounted section editor's storage
 * (`extensions/proposal-editor-storage.ts`), so the in-editor keymap
 * extension (`extensions/history-keymap.ts`) has something to forward
 * to. `template-editor-body.tsx` calls this once, for the lifetime of
 * the whole editor - not per section - which is also why it targets
 * every registered editor (`editor-registry.ts`) rather than just the
 * selected section's: any one of them can be the DOM-focused editor when
 * a shortcut fires, and the callback itself does not depend on which
 * section it runs from (undo/redo act on the whole layout; `openLink`
 * always reaches the one Text bar mounted for the selected section).
 *
 * Takes `textBarRef` directly (rather than a caller-built `openLink`
 * callback) so `template-editor-body.tsx` only has to create the ref and
 * pass it two places (here, and to the mounted `TextBar`) - the
 * `.current?.openLink()` indirection lives in one place instead of at
 * every call site.
 *
 * @module features/proposals/editor/use-editor-shortcuts
 */
import { useEffect, type RefObject } from 'react'

import type { TextBarHandle } from './bars/text-bar'
import { useRegisteredEditors } from './editor-registry'
import type { LayoutAction, LayoutEditorState } from './state'
import { stepSelectionOut } from './step-selection-out'

/** Options for {@link useEditorShortcuts}. */
export interface UseEditorShortcutsOptions {
  /** The layout editor's current state, read only for `selection.sectionId` (the `Escape` callback's step-out target). */
  state: LayoutEditorState
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  /** `useLayoutEditor`'s `undo`. */
  undo: () => void
  /** `useLayoutEditor`'s `redo`. */
  redo: () => void
  /** The ref `template-editor-body.tsx` passes to the mounted `TextBar`; `Mod-k` calls `.current?.openLink()` on it, a no-op while no Text bar is mounted (nothing selected, or a node rather than text). */
  textBarRef: RefObject<TextBarHandle | null>
}

/**
 * Sets the undo/redo/openLink/escape callbacks TipTap's history keymap
 * forwards to, on every mounted section editor. Re-runs whenever the set
 * of mounted editors changes or the selected section changes - not on
 * every keystroke, since `state` itself is a fresh object on every one
 * (`setContent` dispatches a new layout each time) but only
 * `state.selection.sectionId` (a stable string, or `null`) is what the
 * `escape` callback actually needs.
 */
export function useEditorShortcuts({ state, dispatch, undo, redo, textBarRef }: UseEditorShortcutsOptions): void {
  const editors = useRegisteredEditors()
  const sectionId = state.selection.sectionId

  useEffect(() => {
    const openLink = () => textBarRef.current?.openLink()
    // The in-editor keymap only ever fires this while a section's editor
    // has focus, so `inEditor` is always true here - the "node selected,
    // not in the editor" and "nothing selected" tiers of `stepSelectionOut`
    // belong to `use-canvas-keys.ts`'s window listener instead (see its
    // own module doc), not this callback. That listener now skips the
    // in-editor case entirely (Task 15 fix round 1), so this is the only
    // place that ever runs it; `history-keymap.ts`'s `Escape` handler
    // blurs the editor itself once this callback returns.
    const escape = () => stepSelectionOut(dispatch, { inEditor: true, sectionId, hasNodeSelected: false })
    for (const editor of editors) {
      if (editor.isDestroyed) continue
      editor.commands.setProposalEditorCallbacks({ undo, redo, openLink, escape })
    }
  }, [editors, dispatch, undo, redo, textBarRef, sectionId])
}
