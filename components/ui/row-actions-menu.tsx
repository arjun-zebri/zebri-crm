'use client'

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { MoreHorizontal, ChevronRight } from 'lucide-react'

export interface RowAction {
  label: string
  onSelect: () => void
  destructive?: boolean
  icon?: React.ReactNode
}

interface RowActionsMenuProps {
  actions: RowAction[]
  /** Optional submenu sections for nested actions like "Snooze" */
  submenus?: { label: string; icon?: React.ReactNode; items: RowAction[] }[]
  /** Always visible (mobile / touch) - otherwise hover-only */
  alwaysVisible?: boolean
}

export function RowActionsMenu({ actions, submenus, alwaysVisible }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [submenuKey, setSubmenuKey] = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setSubmenuKey(null)
  }

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
          className={`shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer ${
            alwaysVisible ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
          aria-label="Row actions"
        >
          <MoreHorizontal size={15} strokeWidth={1.5} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[80] min-w-44"
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
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition ${
                  submenuKey === sub.label ? 'bg-gray-50' : 'hover:bg-gray-50'
                } text-gray-700`}
              >
                <span className="flex items-center gap-2">
                  {sub.icon}
                  {sub.label}
                </span>
                <ChevronRight size={13} strokeWidth={1.5} className="text-gray-400" />
              </button>
              {submenuKey === sub.label && (
                <div
                  className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-36"
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
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
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
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                a.destructive
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
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
