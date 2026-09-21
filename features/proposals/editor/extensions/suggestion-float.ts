'use client'

/**
 * The floating-list half of a TipTap `Suggestion` plugin, shared by the
 * `/` slash menu (`slash-menu.ts`) and the `@` / `{{` variable trigger
 * (`variable-suggestion.ts`): mounts `SlashMenuList` through a
 * `ReactRenderer` in a fixed `<div>` on `body`, keeps it under (or, near
 * the viewport bottom, above) the caret, routes arrow/Enter keys into the
 * list and tears it down on exit. Only the item list differs between the
 * two triggers, so the render plumbing lives once here.
 *
 * @module features/proposals/editor/extensions/suggestion-float
 */
import { ReactRenderer } from '@tiptap/react'
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'

import type { InsertItem } from '../insert-items'

import { SlashMenuList, type SlashMenuListHandle, type SlashMenuListProps } from './slash-menu-list'

/** Positions the floating list under (or, near the viewport bottom, above) the caret rect. */
function place(container: HTMLDivElement | null, clientRect: (() => DOMRect | null) | null | undefined): void {
  if (!container) return
  let rect: DOMRect | null = null
  try {
    rect = clientRect?.() ?? null
  } catch {
    // `clientRect` reads `editor.view.coordsAtPos`, which throws on a
    // headless editor (a unit test driving the plugin without a mounted
    // view); leave the list where it is rather than crash the update.
    return
  }
  if (!rect) return
  const listHeight = Math.min(container.offsetHeight || 288, 288)
  const below = rect.bottom + 6
  const top = below + listHeight > window.innerHeight ? rect.top - listHeight - 6 : below
  container.style.top = `${Math.max(8, top)}px`
  container.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`
}

/** A `Suggestion` `render` option: the shared floating `SlashMenuList`, with `emptyLabel` shown when nothing matches the query. */
export function floatingListRenderer(emptyLabel: string): NonNullable<SuggestionOptions<InsertItem, InsertItem>['render']> {
  return () => {
    let component: ReactRenderer<SlashMenuListHandle, SlashMenuListProps> | null = null
    let container: HTMLDivElement | null = null

    const destroy = () => {
      component?.destroy()
      container?.remove()
      component = null
      container = null
    }

    return {
      onStart(props: SuggestionProps<InsertItem, InsertItem>) {
        const renderer = new ReactRenderer(SlashMenuList, {
          props: { items: props.items, command: props.command, emptyLabel },
          editor: props.editor,
        })
        component = renderer
        container = document.createElement('div')
        container.className = 'fixed z-[95]'
        container.appendChild(renderer.element)
        document.body.appendChild(container)
        place(container, props.clientRect)
      },
      onUpdate(props: SuggestionProps<InsertItem, InsertItem>) {
        component?.updateProps({ items: props.items, command: props.command, emptyLabel })
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
  }
}
