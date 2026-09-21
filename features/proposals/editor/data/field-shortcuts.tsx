'use client'

/**
 * The layout editor's undo/redo, handed to every data-section `InlineField`
 * through context so Cmd+Z inside a card title or an FAQ answer undoes the
 * layout the same way it does inside a content section. Content sections
 * get theirs through the editor registry (`use-editor-shortcuts.ts`),
 * which is keyed one editor per section and so cannot hold the many
 * fields a packages card mounts; a context reaches all of them at once.
 * Before this, `history-keymap.ts` read `editor.storage.proposalEditor`
 * off a field that never registered it and threw on the first Escape
 * (live check, packages cards).
 *
 * @module features/proposals/editor/data/field-shortcuts
 */
import { createContext, useContext } from 'react'

/** What a field can forward. */
export interface FieldShortcuts {
  undo: () => void
  redo: () => void
}

const FieldShortcutsContext = createContext<FieldShortcuts | null>(null)

/** Provides {@link FieldShortcuts} to every `InlineField` beneath it; `template-editor-body.tsx` mounts one around the canvas. */
export const FieldShortcutsProvider = FieldShortcutsContext.Provider

/** The nearest provider's shortcuts, or `null` outside the template editor (a bare harness), where a field's Cmd+Z is simply inert. */
export function useFieldShortcuts(): FieldShortcuts | null {
  return useContext(FieldShortcutsContext)
}
