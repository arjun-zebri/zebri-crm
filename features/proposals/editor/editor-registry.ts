'use client'

/**
 * Live registry of mounted section editors, keyed by section id. A
 * toolbar or node inspector rendered beside the canvas (later tasks)
 * needs to reach a specific section's `Editor` instance from outside the
 * `ContentSectionEditor` that owns it (e.g. "bold the current selection"
 * dispatched from a bar that is not itself inside that section's DOM
 * subtree); a plain module-level map plus a tiny subscriber set is the
 * whole of what that needs, no React store library required.
 *
 * @module features/proposals/editor/editor-registry
 */
import type { Editor } from '@tiptap/react'
import { useCallback, useSyncExternalStore } from 'react'

/** Every currently mounted section editor, keyed by section id. */
const editors = new Map<string, Editor>()
/** Callbacks from `useRegisteredEditor`/`useRegisteredEditors` instances, notified on every register/unregister. */
const subscribers = new Set<() => void>()

/**
 * Cached array view of `editors`' values, rebuilt only here (on
 * register/unregister) so `useRegisteredEditors`'s `getSnapshot` can
 * return the same reference across calls when nothing changed -
 * `useSyncExternalStore` requires that, or it re-renders every time.
 */
let editorsSnapshot: readonly Editor[] = []

function notify(): void {
  editorsSnapshot = Array.from(editors.values())
  for (const fn of subscribers) fn()
}

/** Register `editor` as the live editor for `sectionId`, replacing whatever was registered there before. */
export function registerEditor(sectionId: string, editor: Editor): void {
  editors.set(sectionId, editor)
  notify()
}

/** Remove the editor registered for `sectionId` (a no-op if none is registered). */
export function unregisterEditor(sectionId: string): void {
  if (!editors.delete(sectionId)) return
  notify()
}

/** The editor currently registered for `sectionId`, or `null` if none is mounted. */
export function getEditor(sectionId: string): Editor | null {
  return editors.get(sectionId) ?? null
}

function subscribe(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange)
  return () => subscribers.delete(onStoreChange)
}

/**
 * React to the editor registered for `sectionId`, re-rendering the caller
 * whenever it is registered or unregistered elsewhere in the tree.
 * `sectionId === null` (nothing selected) always returns `null`.
 */
export function useRegisteredEditor(sectionId: string | null): Editor | null {
  const getSnapshot = useCallback(() => (sectionId ? getEditor(sectionId) : null), [sectionId])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Every currently mounted editor. `use-editor-shortcuts.ts` (Task 15) applies the keyboard callbacks to each one, since any of them can be the DOM-focused editor when a shortcut fires, not only the currently selected section's. */
export function getRegisteredEditors(): readonly Editor[] {
  return editorsSnapshot
}

/** React to the full set of mounted editors, re-rendering the caller whenever one is registered or unregistered anywhere in the tree. */
export function useRegisteredEditors(): readonly Editor[] {
  return useSyncExternalStore(subscribe, getRegisteredEditors, getRegisteredEditors)
}
