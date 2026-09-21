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

import { MenuItem, MenuLabel, MenuPanel } from '@/components/ui/menu'

import type { InsertItem } from '../insert-items'

/** Props for {@link SlashMenuList}. */
export interface SlashMenuListProps {
  /** Rows in display order; a row's `group` (when set) becomes a heading above the first row of each run. */
  items: readonly InsertItem[]
  command: (item: InsertItem) => void
  /** Shown when `items` is empty; the `/` menu says "No matching blocks", the `@` trigger "No matching variables". */
  emptyLabel?: string
}

/** Imperative handle: route a keydown into the list's navigation, mirroring `components/ui/variable-suggestion.tsx`'s `ListHandle`. */
export interface SlashMenuListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

/** The floating list: arrow keys move, Enter or a click selects. */
export const SlashMenuList = forwardRef<SlashMenuListHandle, SlashMenuListProps>(function SlashMenuList(
  { items, command, emptyLabel = 'No matching blocks' },
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
      <MenuPanel className="p-3">
        <p className="text-body text-text-muted">{emptyLabel}</p>
      </MenuPanel>
    )
  }

  // Built on the shared menu primitives (`MenuPanel`/`MenuItem`/`MenuLabel`)
  // rather than hand-rolled rows, so the `/` menu reads as the same
  // control as every other dropdown in the app - the group headings in
  // particular are `MenuLabel`, not a home-grown heading style.
  return (
    <MenuPanel className="max-h-72 overflow-y-auto">
      {items.map((item, i) => {
        const Icon = item.icon
        // A group heading above the first row of each group. Only the
        // `@` / `{{` variable trigger passes ungrouped items (every row
        // is a variable there), and those get no headings at all.
        const heading = item.group && item.group !== items[i - 1]?.group ? item.group : null
        return (
          <div key={item.id} onMouseEnter={() => setSelected(i)}>
            {heading ? <MenuLabel>{heading}</MenuLabel> : null}
            <MenuItem size="sm" selected={i === active} onClick={() => command(item)}>
              <span className="flex items-center gap-2">
                <Icon size={14} strokeWidth={1.5} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
            </MenuItem>
          </div>
        )
      })}
    </MenuPanel>
  )
})
