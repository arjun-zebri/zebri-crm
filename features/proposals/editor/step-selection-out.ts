'use client'

/**
 * The one "step the canvas selection out one level" rule, shared by two
 * entry points (Proposal Layout v2 Phase 2 Task 15, spec 3.5), which are
 * mutually exclusive for a single `Escape` press (fix round 1):
 * `use-canvas-keys.ts`'s window listener now skips entirely while the
 * event target is inside `.ProseMirror` (mirroring
 * `lib/branding/use-history.ts`'s own exclusion for undo/redo), leaving
 * the in-editor case to `use-editor-shortcuts.ts`'s `escape` callback
 * (reached through `extensions/history-keymap.ts`'s keymap, which blurs
 * the editor itself once the callback returns). Pulled into its own
 * module rather than exported from `use-canvas-keys.ts` so that
 * already-near-the-line-guideline file does not have to grow to pick up
 * a second caller.
 *
 * @module features/proposals/editor/step-selection-out
 */
import type { LayoutAction } from './state'

/** Options for {@link stepSelectionOut}. */
export interface StepSelectionOutOptions {
  /**
   * True for the in-editor case: exits text editing straight to the
   * owning section, skipping over any node selection the editor's own
   * ProseMirror state may still hold (a NodeSelection there does not
   * change which entry point calls this - only the keymap ever does, and
   * always with `inEditor: true`), so one `Escape` never needs a second
   * press just to leave editing.
   */
  inEditor: boolean
  /** The section `inEditor` steps out to; a no-op if `null` (nothing to select). */
  sectionId: string | null
  /** Whether a node (an atom, or the `columns` row) is currently selected - only read when `inEditor` is false. */
  hasNodeSelected: boolean
}

/**
 * `inEditor` -> select just the owning section (clearing any node
 * selection). Otherwise a selected node clears first, and only then does
 * the section itself deselect - the three-tier "node -> section ->
 * nothing" stepping the spec describes.
 */
export function stepSelectionOut(dispatch: (action: LayoutAction) => void, opts: StepSelectionOutOptions): void {
  if (opts.inEditor) {
    if (opts.sectionId) dispatch({ type: 'select', sectionId: opts.sectionId })
    return
  }
  if (opts.hasNodeSelected) {
    dispatch({ type: 'selectNode', node: null })
    return
  }
  dispatch({ type: 'select', sectionId: null })
}
