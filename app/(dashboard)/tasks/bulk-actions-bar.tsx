'use client'

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CheckSquare, Calendar as CalendarIcon, FolderInput, Trash2, X } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
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

  const btn =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-sm text-gray-700 hover:bg-gray-100 transition cursor-pointer'

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border border-gray-200 rounded-control shadow-xl px-3 py-2 flex items-center gap-1 animate-fade-in">
      <span className="text-sm text-gray-500 px-2 tabular-nums">{count} selected</span>
      <span className="w-px h-4 bg-gray-200 mx-1" />
      <button type="button" onClick={onMarkDone} className={btn} title="Mark done">
        <CheckSquare size={14} strokeWidth={1.5} />
        <span className="hidden sm:inline">Done</span>
      </button>

      <Popover.Root open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <Popover.Trigger asChild>
          <button type="button" className={btn} title="Change date">
            <CalendarIcon size={14} strokeWidth={1.5} />
            <span className="hidden sm:inline">Date</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={8} align="center" className="z-[60]">
            <div className="bg-white border border-gray-200 rounded-control shadow-lg p-2 w-72">
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
                <button
                  type="button"
                  onClick={() => {
                    setDatePickerOpen(false)
                    onChangeDate(null)
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  Clear due date
                </button>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {onMoveToGroup && groups && (
        <Popover.Root open={groupPickerOpen} onOpenChange={setGroupPickerOpen}>
          <Popover.Trigger asChild>
            <button type="button" className={btn} title="Move to group">
              <FolderInput size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">Group</span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={8} align="center" className="z-[60]">
              <div className="bg-white border border-gray-200 rounded-control shadow-lg py-1 min-w-44 max-h-56 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setGroupPickerOpen(false)
                    onMoveToGroup(null)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition"
                >
                  Ungrouped
                </button>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setGroupPickerOpen(false)
                      onMoveToGroup(g.id)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
                  >
                    <span className={`w-2 h-2 rounded-pill ${TASK_GROUP_DOT_CLASS[g.color]}`} />
                    <span className="truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-sm text-red-600 hover:bg-red-50 transition cursor-pointer"
        title="Delete"
      >
        <Trash2 size={14} strokeWidth={1.5} />
        <span className="hidden sm:inline">Delete</span>
      </button>

      <span className="w-px h-4 bg-gray-200 mx-1" />
      <button
        type="button"
        onClick={onClear}
        className="p-1.5 rounded-control text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
        title="Clear selection (Esc)"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
