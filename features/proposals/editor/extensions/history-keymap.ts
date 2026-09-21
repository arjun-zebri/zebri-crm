'use client'

/**
 * Forwards the layout editor's own shortcuts through an open section
 * editor's focus (Proposal Layout v2 Phase 2 Task 15, spec 3.5). TipTap's
 * own history is off (`undoRedo: false` in `extensions/index.ts`) and
 * `lib/branding/use-history.ts`'s window Cmd+Z/Ctrl+Z listener explicitly
 * skips any `.ProseMirror` target (a Branding-era rule, where TipTap kept
 * its own history there) - so without this extension, Meta+Z inside a
 * proposal section editor would reach no handler at all. Every key below
 * forwards to whatever `use-editor-shortcuts.ts` last wrote onto
 * `editor.storage.proposalEditor.callbacks` (`proposal-editor-storage.ts`);
 * this extension itself never touches the layout or the DOM, only routes
 * the key to that callback.
 *
 * Each shortcut only reports itself "handled" (returning `true`, which
 * stops ProseMirror from trying any other plugin's `handleKeyDown`,
 * `slash-menu.ts`'s Escape-closes-the-menu included) once a callback is
 * actually registered - before `use-editor-shortcuts.ts` has run, or for
 * an editor it never reaches, every key here is a no-op that falls
 * through to whatever else wants it.
 *
 * `Escape` additionally yields to the `/` slash menu whenever it is open
 * (`SLASH_MENU_PLUGIN_KEY`'s own `active` state): that menu owns closing
 * itself on Escape, and reading its state directly here removes any
 * dependency on which of the two plugins ProseMirror happens to run
 * first for the same key. Once handled, it also blurs the editor's DOM
 * directly (not TipTap's own `editor.commands.blur()`, which defers to a
 * `requestAnimationFrame`): `use-canvas-keys.ts`'s window listener used
 * to do this, but now skips the in-editor case entirely (fix round 1,
 * mirroring `lib/branding/use-history.ts`'s own `.ProseMirror` exclusion
 * for undo/redo) so a single in-editor `Escape` fires exactly once.
 *
 * `Mod-b`/`Mod-i`/`Mod-u` stay TipTap's own defaults (StarterKit's marks
 * keymaps); nothing here touches them.
 *
 * @module features/proposals/editor/extensions/history-keymap
 */
import { Extension } from '@tiptap/core'

import type { ProposalEditorCallbacks } from './proposal-editor-storage'
import { SLASH_MENU_PLUGIN_KEY } from './slash-menu'

/**
 * Registered unconditionally in `buildRichDocExtensions` (like
 * `ProposalEditorStorageExtension`): harmless when no callback is set yet.
 */
export const HistoryKeymapExtension = Extension.create({
  name: 'historyKeymap',

  addKeyboardShortcuts() {
    // `this.editor` is TipTap's own convention inside a keyboard shortcut
    // handler (see `@tiptap/core`'s `KeyboardShortcutCommand` type); read
    // fresh on every keypress rather than captured once, since the same
    // extension instance's `this.editor` never changes but its storage's
    // callbacks are rewritten on every selection/editor-list change.
    // Optional-chained: an editor built without `ProposalEditorStorageExtension`
    // (a bare test harness) must fall through, not throw on its first key.
    const callbacks = (): ProposalEditorCallbacks => this.editor.storage.proposalEditor?.callbacks ?? {}
    /** Calls `fn` and reports the key handled only when it existed - see the module doc for why an unregistered callback must not swallow the key. */
    const forward = (fn: (() => void) | undefined): boolean => {
      if (!fn) return false
      fn()
      return true
    }

    return {
      'Mod-z': () => forward(callbacks().undo),
      'Shift-Mod-z': () => forward(callbacks().redo),
      'Mod-y': () => forward(callbacks().redo),
      'Mod-k': () => forward(callbacks().openLink),
      Escape: () => {
        if (SLASH_MENU_PLUGIN_KEY.getState(this.editor.state)?.active) return false
        const handled = forward(callbacks().escape)
        if (handled) this.editor.view.dom.blur()
        return handled
      },
    }
  },
})
