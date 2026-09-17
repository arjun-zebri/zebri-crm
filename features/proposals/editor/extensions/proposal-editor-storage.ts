/**
 * Tiny storage-only extension: carries the resolved branding a node view
 * needs for its WYSIWYG render (the shared renderer components take a
 * `RichDocContext`-shaped `branding`, but a node view has no
 * `RichDocContext` of its own), plus the picker/upload callbacks
 * `INSERT_ITEMS` (`../insert-items.ts`) invokes for the four items that
 * cannot insert a node on their own (image, audio, embed, variable), plus
 * the `undo`/`redo`/`openLink`/`escape` callbacks
 * `extensions/history-keymap.ts` (Task 15) forwards
 * Meta+Z/Shift+Meta+Z/Meta+Y/Meta+K/Escape to, since TipTap's own history
 * is off and those keys otherwise reach no handler at all while an editor
 * has focus. `requestImage`/`requestAudio`/`requestEmbed` are registered
 * once, for the life of the editor, by `use-insert-media.ts`
 * (`insert-media-host.tsx` is the UI it drives); `requestVariable` by
 * `bars/text-bar-insert.tsx`; `use-editor-shortcuts.ts` (Task 15)
 * registers the keyboard slice. Until registered, every callback is
 * called through an optional chain and does nothing.
 *
 * `ContentSectionEditor` calls `setProposalBranding` on create and
 * whenever its `branding` prop changes. Only `button-view.tsx` reads
 * branding today (the other node views don't need it); it reads
 * `branding-context.tsx`'s reactive context first, falling back to
 * `readEditorBranding` (`node-views/editor-storage.ts`) reading this
 * storage, so a view rendered without the context provider (a bare test
 * harness) still gets a value.
 *
 * Both are commands, not a direct `editor.storage.proposalEditor = …`
 * write: `useEditor()`'s returned `editor` is a hook value, and this
 * codebase's ratcheted `react-hooks/immutability` lint disallows
 * mutating a hook's return value from outside the hook that produced
 * it. Routing the write through a command keeps the mutation inside
 * this extension's own lifecycle instead of the component's.
 *
 * @module features/proposals/editor/extensions/proposal-editor-storage
 */
import { Extension } from '@tiptap/core'

import { buildPublicBranding } from '@/lib/branding/public-branding'
import type { PublicBranding } from '@/lib/branding/public-branding'

/**
 * Picker/upload callbacks a node view or insert item can trigger without
 * owning the picker UI itself. `setProposalEditorCallbacks` merges a
 * partial patch in, so the bar that owns the image picker and the one
 * that owns the variable list (different components) can each register
 * their own slice independently.
 */
export interface ProposalEditorCallbacks {
  /** Opens the image upload/picker flow. */
  requestImage?: () => void
  /** Opens the audio upload/picker flow. */
  requestAudio?: () => void
  /** Opens the "Embed a video" URL modal (`insert-media-host.tsx`'s `EmbedInsertModal`). */
  requestEmbed?: () => void
  /** Opens the variable list. */
  requestVariable?: () => void
  /** Undoes the layout editor's last committed edit (`useLayoutEditor`'s `undo`). Bound to `Mod-z` by `history-keymap.ts`. */
  undo?: () => void
  /** Redoes the last undone edit (`useLayoutEditor`'s `redo`). Bound to `Shift-Mod-z` and `Mod-y`. */
  redo?: () => void
  /** Opens the Text bar's Link popover (`TextBarHandle.openLink`) for whichever section is currently focused. Bound to `Mod-k`. */
  openLink?: () => void
  /** Steps the canvas selection out one level (`stepSelectionOut`, always the `inEditor` branch from here). Bound to `Escape`. */
  escape?: () => void
}

/** The shape stored at `editor.storage.proposalEditor`. */
export interface ProposalEditorStorage {
  branding: PublicBranding
  callbacks: ProposalEditorCallbacks
}

declare module '@tiptap/core' {
  interface Storage {
    proposalEditor: ProposalEditorStorage
  }
  interface Commands<ReturnType> {
    proposalEditor: {
      /** Sets the branding every node view reads for its WYSIWYG render. */
      setProposalBranding: (branding: PublicBranding) => ReturnType
      /** Merges `callbacks` into the stored callback set (existing entries not named in `callbacks` are kept). */
      setProposalEditorCallbacks: (callbacks: ProposalEditorCallbacks) => ReturnType
    }
  }
}

/**
 * Storage-only extension backing `readEditorBranding`
 * (`node-views/editor-storage.ts`) and `INSERT_ITEMS`' picker callbacks.
 * Registered unconditionally, not gated by `nodeViews`: harmless overhead
 * (one small object) when no node view or insert item ever reads it.
 */
export const ProposalEditorStorageExtension = Extension.create({
  name: 'proposalEditor',

  addStorage(): ProposalEditorStorage {
    return { branding: buildPublicBranding({ business_name: '' }), callbacks: {} }
  },

  addCommands() {
    return {
      setProposalBranding:
        (branding: PublicBranding) =>
        () => {
          this.storage.branding = branding
          return true
        },
      setProposalEditorCallbacks:
        (callbacks: ProposalEditorCallbacks) =>
        () => {
          this.storage.callbacks = { ...this.storage.callbacks, ...callbacks }
          return true
        },
    }
  },
})
