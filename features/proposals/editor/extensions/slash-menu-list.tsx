'use client'

/**
 * The `/` slash menu's floating list: the React side of
 * `slash-menu.ts`'s suggestion plugin, mounted through a `ReactRenderer`
 * (not `EditorContent`, so it lives outside the ProseMirror DOM). Split
 * out from `slash-menu.ts` because it needs JSX and that file does not
 * otherwise.
 *
 * @module features/proposals/editor/extensions/slash-menu-list
 */
import type { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { forwardRef, useImperativeHandle, useState } from 'react'

import type { InsertItem } from '../insert-items'

/** Props for {@link SlashMenuList}. */
export interface SlashMenuListProps {
  items: readonly InsertItem[]
  command: (item: InsertItem) => void
}

/** Imperative handle: route a keydown into the list's navigation, mirroring `components/ui/variable-suggestion.tsx`'s `ListHandle`. */
export interface SlashMenuListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

/** The floating list: arrow keys move, Enter or a click selects. */
export const SlashMenuList = forwardRef<SlashMenuListHandle, SlashMenuListProps>(function SlashMenuList(
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
      if (event.key === 'Enter') {
        const item = items[active]
        if (item) command(item)
        return true
      }
      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div className="w-56 rounded-control border border-border bg-surface p-3 shadow-lg">
        <p className="text-body text-text-muted">No matching blocks</p>
      </div>
    )
  }

  return (
    <div role="menu" className="max-h-72 w-56 overflow-y-auto rounded-control border border-border bg-surface p-1 shadow-lg">
      {items.map((item, i) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            onClick={() => command(item)}
            onMouseEnter={() => setSelected(i)}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-control px-2 py-1 text-left ${i === active ? 'bg-surface-emphasis' : ''}`}
          >
            <Icon size={14} strokeWidth={1.5} />
            <span className="truncate text-body text-text">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
})
