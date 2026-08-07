'use client'

import * as Popover from '@radix-ui/react-popover'
import { CheckSquare, Calendar as CalendarIcon, FolderInput, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { MenuItem, MenuPanel } from '@/components/ui/menu'

import { TASK_GROUP_DOT_CLASS, TaskGroup } from './use-task-groups'

interface BulkActionsBarProps {
  count: number
  onClear: () => void
  onMarkDone: () => void
  onChangeDate: (date: string | null) => void
  onMoveToGroup?: (groupId: string | null) => void
  onDelete: () => void
  groups?: TaskGroup[]
}

export function BulkActionsBar({
  count,
  onClear,
  onMarkDone,
  onChangeDate,
  onMoveToGroup,
  onDelete,
  groups,
}: BulkActionsBarProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [groupPickerOpen, setGroupPickerOpen] = useState(false)

  if (count === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-surface border border-border rounded-control shadow-xl px-3 py-2 flex items-center gap-1 animate-fade-in">
      <span className="text-body text-text-muted px-2 tabular-nums">{count} selected</span>
      <span className="mx-1 h-4 w-px bg-border" />
      <Button variant="ghost" onClick={onMarkDone} title="Mark done">
        <CheckSquare size={14} strokeWidth={1.5} />
        <span className="hidden sm:inline">Done</span>
      </Button>

      <Popover.Root open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <Popover.Trigger asChild>
          <Button variant="ghost" title="Change date">
            <CalendarIcon size={14} strokeWidth={1.5} />
            <span className="hidden sm:inline">Date</span>
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={8} align="center" className="z-[60]">
            <div className="bg-surface border border-border rounded-control shadow-lg p-2 w-72">
              <DatePicker
                value=""
                onChange={(v) => {
                  setDatePickerOpen(false)
                  onChangeDate(v || null)
                }}
                placeholder="Pick a date"
                inline
              />
              <div className="border-t border-gray-100 mt-2 pt-2 text-center">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDatePickerOpen(false)
                    onChangeDate(null)
                  }}
                >
                  Clear due date
                </Button>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {onMoveToGroup && groups && (
        <Popover.Root open={groupPickerOpen} onOpenChange={setGroupPickerOpen}>
          <Popover.Trigger asChild>
            <Button variant="ghost" title="Move to group">
              <FolderInput size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">Group</span>
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={8} align="center" className="z-[60]">
              <MenuPanel className="max-h-56 overflow-y-auto">
                <MenuItem
                  onClick={() => {
                    setGroupPickerOpen(false)
                    onMoveToGroup(null)
                  }}
                >
                  Ungrouped
                </MenuItem>
                {groups.map((g) => (
                  <MenuItem
                    key={g.id}
                    onClick={() => {
                      setGroupPickerOpen(false)
                      onMoveToGroup(g.id)
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-pill ${TASK_GROUP_DOT_CLASS[g.color]}`} />
                      <span className="truncate">{g.name}</span>
                    </span>
                  </MenuItem>
                ))}
              </MenuPanel>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}

      <Button
        variant="ghost"
        onClick={onDelete}
        title="Delete"
        className="text-danger hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 size={14} strokeWidth={1.5} />
        <span className="hidden sm:inline">Delete</span>
      </Button>

      <span className="mx-1 h-4 w-px bg-border" />
      <Button
        variant="ghost"
        iconOnly
        onClick={onClear}
        title="Clear selection (Esc)"
        aria-label="Clear selection"
      >
        <X size={14} strokeWidth={1.5} />
      </Button>
    </div>
  )
}
