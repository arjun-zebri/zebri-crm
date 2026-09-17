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
 * The floating list itself is `slash-menu-list.tsx` (JSX; this file has
 * none, so it stays a plain `.ts` module).
 *
 * @module features/proposals/editor/extensions/slash-menu
 */
import { Extension, type Editor } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import { Suggestion, type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'

import { filterInsertItems, type InsertItem } from '../insert-items'

import { SlashMenuList, type SlashMenuListHandle } from './slash-menu-list'

/** The suggestion plugin's key, exported so a caller (or a test) can read its live `{ active, query, range }` state via `SLASH_MENU_PLUGIN_KEY.getState(editor.state)`. */
export const SLASH_MENU_PLUGIN_KEY = new PluginKey('proposal-slash-menu')

/** Positions the floating list under (or, near the viewport bottom, above) the caret rect. */
function place(container: HTMLDivElement | null, clientRect: (() => DOMRect | null) | null | undefined): void {
  const rect = clientRect?.()
  if (!rect || !container) return
  const listHeight = Math.min(container.offsetHeight || 288, 288)
  const below = rect.bottom + 6
  const top = below + listHeight > window.innerHeight ? rect.top - listHeight - 6 : below
  container.style.top = `${Math.max(8, top)}px`
  container.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`
}

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
        render: () => {
          let component: ReactRenderer<SlashMenuListHandle, { items: readonly InsertItem[]; command: (item: InsertItem) => void }> | null = null
          let container: HTMLDivElement | null = null

          const destroy = () => {
            component?.destroy()
            container?.remove()
            component = null
            container = null
          }

          return {
            onStart(props: SuggestionProps<InsertItem, InsertItem>) {
              component = new ReactRenderer(SlashMenuList, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              })
              container = document.createElement('div')
              container.className = 'fixed z-[95]'
              container.appendChild(component.element)
              document.body.appendChild(container)
              place(container, props.clientRect)
            },
            onUpdate(props: SuggestionProps<InsertItem, InsertItem>) {
              component?.updateProps({ items: props.items, command: props.command })
              place(container, props.clientRect)
            },
            onKeyDown(props: SuggestionKeyDownProps) {
              if (props.event.key === 'Escape') {
                destroy()
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit: destroy,
          }
        },
      }),
    ]
  },
})
