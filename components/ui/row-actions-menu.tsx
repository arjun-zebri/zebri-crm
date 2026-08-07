'use client'

import * as Popover from '@radix-ui/react-popover'
import { MoreHorizontal, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export interface RowAction {
  label: string
  onSelect: () => void
  destructive?: boolean
  icon?: React.ReactNode
  /** Extra classes on the menu item — e.g. `sm:hidden` to drop an entry
   *  once a visible button covers the same action on larger screens. */
  className?: string
}

interface RowActionsMenuProps {
  actions: RowAction[]
  /** Optional submenu sections for nested actions like "Snooze" */
  submenus?: { label: string; icon?: React.ReactNode; items: RowAction[] }[]
  /** Always visible (mobile / touch) - otherwise hover-only */
  alwaysVisible?: boolean
  /**
   * Row density, not type size. There is one text size app-wide, so both
   * values render `text-body`; `'sm'` only tightens the padding and the
   * minimum width, for compact surfaces where an `'md'` menu would tower
   * over the rows it belongs to.
   */
  size?: 'sm' | 'md'
}

export function RowActionsMenu({
  actions,
  submenus,
  alwaysVisible,
  size = 'md',
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [submenuKey, setSubmenuKey] = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setSubmenuKey(null)
  }

  // One source of truth for item metrics so the actions and the submenu
  // items can never drift apart.
  const itemClass =
    size === 'sm'
      ? 'w-full text-left px-2.5 py-1.5 text-body flex items-center gap-2 transition'
      : 'w-full text-left px-3 py-2 text-body flex items-center gap-2 transition'
  const contentWidth = size === 'sm' ? 'min-w-36' : 'min-w-44'

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSubmenuKey(null)
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`shrink-0 p-1.5 rounded-control text-text-subtle hover:text-gray-700 hover:bg-surface-emphasis transition cursor-pointer ${
            alwaysVisible ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
          aria-label="Row actions"
        >
          <MoreHorizontal size={15} strokeWidth={1.5} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={`bg-surface border border-border rounded-control shadow-lg py-1 text-body z-[80] ${contentWidth}`}
          sideOffset={4}
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          {submenus?.map((sub) => (
            <div key={sub.label} className="relative">
              <button
                type="button"
                onMouseEnter={() => setSubmenuKey(sub.label)}
                onClick={() =>
                  setSubmenuKey((k) => (k === sub.label ? null : sub.label))
                }
                className={`${itemClass} justify-between ${
                  submenuKey === sub.label ? 'bg-gray-50' : 'hover:bg-gray-50'
                } text-gray-700`}
              >
                <span className="flex items-center gap-2">
                  {sub.icon}
                  {sub.label}
                </span>
                <ChevronRight size={13} strokeWidth={1.5} className="text-text-subtle" />
              </button>
              {submenuKey === sub.label && (
                <div
                  className="absolute left-full top-0 ml-1 bg-surface border border-border rounded-control shadow-lg py-1 min-w-36"
                  onMouseLeave={() => setSubmenuKey(null)}
                >
                  {sub.items.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        item.onSelect()
                        close()
                      }}
                      className={`${itemClass} text-gray-700 hover:bg-gray-50`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                a.onSelect()
                close()
              }}
              className={`${itemClass} ${
                a.destructive
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-50'
              } ${a.className ?? ''}`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
