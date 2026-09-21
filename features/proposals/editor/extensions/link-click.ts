'use client'

/**
 * Gates the Link mark's click-to-open behaviour behind Cmd/Ctrl. TipTap's
 * own `openOnClick` (disabled on the `link` config in `index.ts`) opens a
 * link on any plain click, which fights editing: a click meant to place
 * the caret inside link text instead navigated away from the document
 * being edited. Google Docs/Notion require a modifier for exactly this
 * reason - a plain click still selects/places the caret as normal
 * ProseMirror click handling; only a Cmd (Mac) or Ctrl (Windows/Linux)
 * click opens the link, mirroring TipTap's own `clickHandler` helper
 * (`@tiptap/extension-link/src/helpers/clickHandler.ts`) with that one
 * added gate.
 *
 * @module features/proposals/editor/extensions/link-click
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const LinkClickExtension = Extension.create({
  name: 'linkClick',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('linkClickModifier'),
        props: {
          handleClick: (view, _pos, event) => {
            if (event.button !== 0 || !view.editable) return false
            if (!(event.metaKey || event.ctrlKey)) return false
            const target = event.target as HTMLElement | null
            const link = target?.closest('a') ?? null
            if (!link || !view.dom.contains(link)) return false
            window.open(link.href, link.target || '_blank')
            return true
          },
        },
      }),
    ]
  },
})
