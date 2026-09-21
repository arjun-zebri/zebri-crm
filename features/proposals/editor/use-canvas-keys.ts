'use client'

/**
 * Section-level keyboard shortcuts for the template canvas (Proposal
 * Layout v2 Phase 2, spec 5.3): `Escape` steps the selection out one level,
 * `Alt+ArrowUp/Down` reorders, `Meta`/`Ctrl+D` duplicates, and
 * `Backspace`/`Delete` deletes (an empty content section goes straight
 * away; anything else asks first). Also exports the shared "is this
 * section empty" rule and the delete-confirmation flow, both reused by the
 * section bar (Task 9) so every delete path in the editor agrees.
 *
 * @module features/proposals/editor/use-canvas-keys
 */
import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'

import type { Section } from '../model/layout'

import type { LayoutAction, LayoutEditorState } from './state'
import { stepSelectionOut } from './step-selection-out'

/**
 * Node types that make a content doc non-empty on their own, even with no
 * text: every `rich-doc-spec.ts` node type except the purely structural
 * containers (paragraph, heading, list*, table*, columns/column, blockquote).
 */
const ATOM_NODE_TYPES: ReadonlySet<string> = new Set([
  'image', 'button', 'embed', 'audio', 'spacer', 'horizontalRule', 'variable', 'hardBreak', 'table',
])

/** A rich-doc JSON node, typed just enough to walk it (the real shape is TipTap's `JSONContent`). */
interface DocNode {
  type?: string
  text?: string
  content?: DocNode[]
}

function hasContent(node: DocNode): boolean {
  if (node.type === 'text') return Boolean(node.text?.trim())
  if (node.type && ATOM_NODE_TYPES.has(node.type)) return true
  return (node.content ?? []).some(hasContent)
}

/**
 * A content section is "empty" when its doc has no text and no atom nodes:
 * an untouched fresh section, or one the MC cleared out entirely. Data
 * sections are never empty - they always carry their kind's data.
 */
export function isSectionEmpty(section: Section): boolean {
  // A page break holds nothing, so deleting one never needs confirming.
  if (section.kind === 'pageBreak') return true
  if (section.kind !== 'content') return false
  return !section.content || !hasContent(section.content)
}

/** What {@link useDeleteSection} returns. */
export interface UseDeleteSectionReturn {
  /** Deletes `section` outright when it is empty; otherwise opens the confirm dialog. */
  requestDelete: (section: Section) => void
  /** The confirm dialog for the pending delete; render it once, anywhere in the tree. */
  dialog: ReactNode
}

/**
 * The one delete flow every entry point in the editor shares (canvas
 * keyboard, and the section bar in Task 9): skip the confirmation for an
 * empty content section, otherwise ask first, so accidentally hitting
 * Delete never silently removes real content.
 */
export function useDeleteSection(dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void): UseDeleteSectionReturn {
  const [pending, setPending] = useState<Section | null>(null)

  const requestDelete = useCallback((section: Section) => {
    if (isSectionEmpty(section)) {
      dispatch({ type: 'deleteSection', id: section.id }, { commit: true })
      return
    }
    setPending(section)
  }, [dispatch])

  const dialog = createElement(ConfirmDialog, {
    open: pending !== null,
    title: 'Delete this section?',
    description: 'This removes the section and everything in it. You can still undo it afterwards.',
    onConfirm: () => {
      if (pending) dispatch({ type: 'deleteSection', id: pending.id }, { commit: true })
      setPending(null)
    },
    onCancel: () => setPending(null),
  })

  return { requestDelete, dialog }
}

/**
 * Options for {@link useCanvasKeys}.
 *
 * No `undo`/`redo` here: `useHistory` (inside `useLayoutEditor`) already
 * runs its own window Cmd+Z/Shift+Cmd+Z listener, which only skips a
 * `.ProseMirror` target, so a second binding at this layer would undo/redo
 * twice. Task 15 wires the editor-focus case through a TipTap keymap
 * extension that calls the real `undo`/`redo` directly, not through a
 * window listener here.
 */
export interface UseCanvasKeysOptions {
  state: LayoutEditorState
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  requestDelete: (section: Section) => void
}

/** True for a native text input, whose own editing keys (Backspace included) must never be hijacked. */
function isEditableInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

/** The nearest `.ProseMirror` ancestor's presence, guarding for a `keydown` fired on `window`/`document` itself, whose target is not an `Element`. */
function isInsideEditor(target: EventTarget | null): boolean {
  return target instanceof Element ? Boolean(target.closest('.ProseMirror')) : false
}

/**
 * Binds the section canvas's keyboard shortcuts on `window` for as long as
 * this hook is mounted, active only while a section is selected.
 *
 * `state`/`dispatch`/`requestDelete` are read through refs, synced in an
 * effect below rather than listed as the listener effect's own
 * dependencies: `state` is a fresh object on every keystroke inside a
 * section editor (`setContent` dispatches a new layout each time), and
 * listing it would unbind/rebind the window listener on every character
 * typed. The refs keep the handler reading current values without that
 * churn, and the listener itself subscribes exactly once.
 */
export function useCanvasKeys({ state, dispatch, requestDelete }: UseCanvasKeysOptions): void {
  const stateRef = useRef(state)
  const dispatchRef = useRef(dispatch)
  const requestDeleteRef = useRef(requestDelete)
  useEffect(() => {
    stateRef.current = state
    dispatchRef.current = dispatch
    requestDeleteRef.current = requestDelete
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current
      const dispatch = dispatchRef.current
      const requestDelete = requestDeleteRef.current

      const sectionId = state.selection.sectionId
      if (!sectionId || isEditableInput(e.target)) return

      const inEditor = isInsideEditor(e.target)
      // Every shortcut here, `Escape` included (fix round 1), is
      // canvas-only: TipTap owns its own keys (bold/italic, its own
      // Backspace, ...) while the editor has focus, and the in-editor
      // `Escape` case is handled exclusively by the TipTap keymap instead
      // (`extensions/history-keymap.ts` -> `use-editor-shortcuts.ts`'s
      // `escape` callback, which blurs the editor itself once done) -
      // mirroring `lib/branding/use-history.ts`'s own `.ProseMirror`
      // exclusion for undo/redo, so a single in-editor `Escape` press
      // fires exactly once instead of twice.
      if (inEditor) return

      if (e.key === 'Escape') {
        e.preventDefault()
        stepSelectionOut(dispatch, { inEditor: false, sectionId, hasNodeSelected: Boolean(state.selection.node) })
        return
      }

      const idx = state.layout.sections.findIndex((s) => s.id === sectionId)
      if (idx === -1) return

      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        dispatch({ type: 'moveSection', from: idx, to: e.key === 'ArrowUp' ? idx - 1 : idx + 1 }, { commit: true })
        return
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        dispatch({ type: 'duplicateSection', id: sectionId }, { commit: true })
        return
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        const section = state.layout.sections[idx]
        if (section) requestDelete(section)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
