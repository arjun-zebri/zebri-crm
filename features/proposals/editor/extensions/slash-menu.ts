'use client'

/**
 * The `/` slash menu: typing `/` at the start of an empty paragraph, or
 * after a space, opens `INSERT_ITEMS` (`../insert-items.ts`) filtered by
 * whatever's typed after it; Enter or a click runs the chosen item and
 * deletes the `/query` text. Registered into `buildRichDocExtensions`
 * (`extensions/index.ts`) unconditionally, since it is a ProseMirror plugin
 * with no node/mark of its own, so it never affects the parity test.
 *
 * The float-positioning and keyboard-nav pattern mirrors
 * `components/ui/variable-suggestion.tsx`; unlike that trigger, this one
 * runs an arbitrary `InsertItem.run` rather than inserting a mention
 * node, so it is its own small extension instead of a `Mention` config.
 * The floating list itself is `slash-menu-list.tsx`, mounted by
 * `suggestion-float.ts` (shared with the `@` variable trigger).
 *
 * @module features/proposals/editor/extensions/slash-menu
 */
import { Extension, type Editor } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { Suggestion } from '@tiptap/suggestion'

import { filterInsertItems, type InsertItem } from '../insert-items'

import { floatingListRenderer } from './suggestion-float'

/** The suggestion plugin's key, exported so a caller (or a test) can read its live `{ active, query, range }` state via `SLASH_MENU_PLUGIN_KEY.getState(editor.state)`. */
export const SLASH_MENU_PLUGIN_KEY = new PluginKey('proposal-slash-menu')

/**
 * The TipTap extension registering the `/` suggestion plugin. A plain
 * `Extension` (not a node/mark), so it adds nothing to the schema the
 * parity test pins against `rich-doc-spec.ts`.
 */
export const SlashMenuExtension = Extension.create({
  name: 'slashMenu',

  addProseMirrorPlugins() {
    return [
      Suggestion<InsertItem, InsertItem>({
        editor: this.editor,
        char: '/',
        pluginKey: SLASH_MENU_PLUGIN_KEY,
        items: ({ query }) => filterInsertItems(query),
        command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: InsertItem }) => {
          // Deletes the `/query` text first: most items focus and build
          // their own chain, which would otherwise insert alongside the
          // still-present trigger text instead of in its place.
          editor.chain().focus().deleteRange(range).run()
          props.run(editor)
        },
        render: floatingListRenderer('No matching blocks'),
      }),
    ]
  },
})
