/**
 * Inline variable suggestion for {@link RichTextEditor}.
 *
 * Typing a trigger (`@` or `{{`) in the body opens a floating,
 * keyboard-navigable list of the editor's variables (the same catalogue
 * as the toolbar popover); picking one inserts the mention node and
 * swallows the typed trigger. Notion-style: authors who know their
 * variables never leave the keyboard, while the toolbar popover stays
 * as the discoverable path. Mid-word `@` (email addresses) doesn't
 * trigger — the suggestion plugin requires a leading space/line start.
 *
 * The float positions itself with imperative DOM styles (not JSX
 * `style`) because the coordinates come from the live caret rect.
 *
 * @module components/ui/variable-suggestion
 */
'use client'

import type { MentionNodeAttrs } from '@tiptap/extension-mention'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer, type Editor } from '@tiptap/react'
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { forwardRef, useImperativeHandle, useState } from 'react'

/** Shape shared with the toolbar's "Insert variable" popover. */
export interface EditorVariable {
  id: string
  label: string
  description: string
}

interface ListProps {
  items: EditorVariable[]
  command: (item: { id: string }) => void
}

/** Imperative handle: route a keydown into the list's navigation. */
export interface ListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

/** The floating list itself — arrow keys move, Enter/Tab select.
 *  Exported so plain-input surfaces (the subject field) can reuse the
 *  exact same list outside a TipTap editor. */
export const VariableSuggestionList = forwardRef<ListHandle, ListProps>(function VariableSuggestionList(
  { items, command },
  ref,
) {
  const [selected, setSelected] = useState(0)
  // The filtered list shrinks as the query grows; clamp the highlight
  // into range at render time instead of resetting in an effect.
  const active = Math.min(selected, Math.max(items.length - 1, 0))

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === 'ArrowDown') {
        setSelected((active + 1) % Math.max(items.length, 1))
        return true
      }
      if (event.key === 'ArrowUp') {
        setSelected((active - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1))
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[active]
        if (item) command({ id: item.id })
        return true
      }
      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div className="w-56 rounded-control border border-border bg-surface p-3 shadow-lg">
        <p className="text-caption text-text-muted">No matching variables</p>
      </div>
    )
  }

  return (
    <div className="max-h-72 w-56 overflow-y-auto rounded-control border border-border bg-surface p-1 shadow-lg">
      {items.map((v, i) => (
        <button
          key={v.id}
          type="button"
          onClick={() => command({ id: v.id })}
          onMouseEnter={() => setSelected(i)}
          className={`w-full cursor-pointer rounded-control px-2 py-1 text-left ${i === active ? 'bg-gray-50' : ''}`}
        >
          <p className="truncate text-caption text-text">{v.label}</p>
        </button>
      ))}
    </div>
  )
})

/**
 * Build one Mention suggestion config for a variable catalogue and a
 * trigger. The editor registers several (one per trigger char) via
 * `Mention.configure({ suggestions })`; each needs its own plugin key
 * or the ProseMirror plugins collide.
 */
export function buildVariableSuggestion(
  variables: readonly EditorVariable[],
  char: string,
): Omit<SuggestionOptions<EditorVariable, MentionNodeAttrs>, 'editor'> {
  return {
    char,
    pluginKey: new PluginKey(`variable-suggestion-${char}`),
    allowSpaces: false,

    // The full catalogue, filtered as the user types — the list itself
    // scrolls, so no arbitrary cap (a cap reads as "missing variables").
    items: ({ query }) => {
      const q = query.toLowerCase()
      return variables.filter(
        (v) => !q || v.label.toLowerCase().includes(q) || v.id.toLowerCase().includes(q),
      )
    },

    command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: MentionNodeAttrs }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([{ type: 'mention', attrs: { id: props.id } }, { type: 'text', text: ' ' }])
        .run()
    },

    render: () => {
      let component: ReactRenderer<ListHandle, ListProps> | null = null
      let container: HTMLDivElement | null = null

      const place = (clientRect: (() => DOMRect | null) | null | undefined) => {
        const rect = clientRect?.()
        if (!rect || !container) return
        // Imperative positioning from the caret rect; flips above when
        // the list would poke past the bottom of the viewport.
        const listHeight = Math.min(container.offsetHeight || 288, 288)
        const below = rect.bottom + 6
        const top = below + listHeight > window.innerHeight ? rect.top - listHeight - 6 : below
        container.style.top = `${Math.max(8, top)}px`
        container.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`
      }

      const destroy = () => {
        component?.destroy()
        container?.remove()
        component = null
        container = null
      }

      return {
        onStart(props: SuggestionProps<EditorVariable, MentionNodeAttrs>) {
          component = new ReactRenderer(VariableSuggestionList, {
            props: { items: props.items, command: props.command },
            editor: props.editor,
          })
          container = document.createElement('div')
          container.className = 'fixed z-[95]'
          container.appendChild(component.element)
          document.body.appendChild(container)
          place(props.clientRect)
        },
        onUpdate(props: SuggestionProps<EditorVariable, MentionNodeAttrs>) {
          component?.updateProps({ items: props.items, command: props.command })
          place(props.clientRect)
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
  }
}
