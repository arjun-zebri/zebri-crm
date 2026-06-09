'use client'

import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ArrowDown, ArrowUp, Filter as FilterIcon, X } from 'lucide-react'
import {
  PriorityPill,
  StatusPill,
  TaskTypePill,
} from './task-cells'
import {
  STATUS_ORDER,
  TaskOption,
  getPriorityLabel,
  getStatusLabel,
} from '@/types/task'

export type FilterProperty = 'status' | 'priority' | 'task_type' | 'couple'
export type SortProperty = 'due_date' | 'status' | 'priority' | 'title'

export interface TaskFilter {
  property: FilterProperty
  // Value is property-dependent: status -> TaskStatus, priority -> TaskPriority,
  // task_type -> string, couple -> couple id
  value: string
}

export interface TaskSort {
  property: SortProperty
  direction: 'asc' | 'desc'
}

interface FilterBarProps {
  filters: TaskFilter[]
  setFilters: (f: TaskFilter[]) => void
  sorts: TaskSort[]
  setSorts: (s: TaskSort[]) => void
  knownTypes: string[]
  knownStatuses?: string[]
  knownPriorities?: string[]
  /** Colour-carrying option lists — passed through to the pills so
   *  filter chips render with the same colours as the table cells. */
  statusOptions?: TaskOption[]
  priorityOptions?: TaskOption[]
  typeOptions?: TaskOption[]
  couples: { id: string; name: string }[]
}

const PROPERTY_LABEL: Record<FilterProperty, string> = {
  status: 'Status',
  priority: 'Priority',
  task_type: 'Task type',
  couple: 'Couple',
}

const SORT_LABEL: Record<SortProperty, string> = {
  due_date: 'Due date',
  status: 'Status',
  priority: 'Priority',
  title: 'Task name',
}

export function FilterBar({
  filters,
  setFilters,
  sorts,
  setSorts,
  knownTypes,
  knownStatuses,
  knownPriorities,
  statusOptions,
  priorityOptions,
  typeOptions,
  couples,
}: FilterBarProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [addSortOpen, setAddSortOpen] = useState(false)

  const removeFilter = (i: number) => setFilters(filters.filter((_, idx) => idx !== i))
  const updateFilter = (i: number, value: string) =>
    setFilters(filters.map((f, idx) => (idx === i ? { ...f, value } : f)))

  const removeSort = (i: number) => setSorts(sorts.filter((_, idx) => idx !== i))
  const toggleSortDir = (i: number) =>
    setSorts(
      sorts.map((s, idx) =>
        idx === i ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' } : s
      )
    )

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filters.map((f, i) => (
        <FilterChip
          key={`${f.property}-${i}`}
          filter={f}
          knownTypes={knownTypes}
          knownStatuses={knownStatuses}
          knownPriorities={knownPriorities}
          statusOptions={statusOptions}
          priorityOptions={priorityOptions}
          typeOptions={typeOptions}
          couples={couples}
          onChange={(value) => updateFilter(i, value)}
          onRemove={() => removeFilter(i)}
        />
      ))}
      {sorts.map((s, i) => (
        <button
          key={`sort-${i}`}
          type="button"
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 transition cursor-pointer text-gray-700"
          title="Toggle direction"
          onClick={() => toggleSortDir(i)}
        >
          {s.direction === 'asc' ? (
            <ArrowUp size={11} strokeWidth={1.5} />
          ) : (
            <ArrowDown size={11} strokeWidth={1.5} />
          )}
          <span>{SORT_LABEL[s.property]}</span>
          <span
            onClick={(e) => {
              e.stopPropagation()
              removeSort(i)
            }}
            className="ml-1 text-gray-400 hover:text-gray-700"
          >
            <X size={10} strokeWidth={1.5} />
          </span>
        </button>
      ))}

      <Popover.Root open={addOpen} onOpenChange={setAddOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 border border-gray-200 rounded-md px-2 py-2 text-xs text-gray-500 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
          >
            <FilterIcon size={11} strokeWidth={1.5} />
            <span>Filter</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={4}
            align="start"
            className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[80] min-w-32"
          >
            {(['status', 'priority', 'task_type', 'couple'] as FilterProperty[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setFilters([...filters, { property: p, value: '' }])
                  setAddOpen(false)
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition"
              >
                {PROPERTY_LABEL[p]}
              </button>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Popover.Root open={addSortOpen} onOpenChange={setAddSortOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 border border-gray-200 rounded-md px-2 py-2 text-xs text-gray-500 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer"
          >
            <ArrowUp size={11} strokeWidth={1.5} />
            <span>Sort</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={4}
            align="start"
            className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[80] min-w-32"
          >
            {(['due_date', 'status', 'priority', 'title'] as SortProperty[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setSorts([...sorts, { property: p, direction: 'asc' }])
                  setAddSortOpen(false)
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition"
              >
                {SORT_LABEL[p]}
              </button>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

// ─── Filter chip ───────────────────────────────────────────────────────────
function FilterChip({
  filter,
  knownTypes,
  knownStatuses,
  knownPriorities,
  statusOptions,
  priorityOptions,
  typeOptions,
  couples,
  onChange,
  onRemove,
}: {
  filter: TaskFilter
  knownTypes: string[]
  knownStatuses?: string[]
  knownPriorities?: string[]
  statusOptions?: TaskOption[]
  priorityOptions?: TaskOption[]
  typeOptions?: TaskOption[]
  couples: { id: string; name: string }[]
  onChange: (value: string) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)

  const statusList = knownStatuses ?? (STATUS_ORDER as string[])
  const priorityList = knownPriorities ?? []

  const valueLabel = (() => {
    if (!filter.value) return 'is empty'
    if (filter.property === 'status') return getStatusLabel(filter.value)
    if (filter.property === 'priority') return getPriorityLabel(filter.value)
    if (filter.property === 'task_type') return filter.value
    if (filter.property === 'couple') {
      return couples.find((c) => c.id === filter.value)?.name ?? 'Unknown'
    }
    return filter.value
  })()

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs px-1.5 py-1 rounded-md bg-gray-100 hover:bg-gray-200 transition cursor-pointer text-gray-700"
        >
          <span className="text-gray-500">{PROPERTY_LABEL[filter.property]}</span>
          <span className="text-gray-300">:</span>
          <span>{valueLabel}</span>
          <span
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="ml-0.5 text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            <X size={10} strokeWidth={1.5} />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[80] min-w-32 max-h-72 overflow-y-auto"
        >
          {filter.property === 'status' &&
            statusList.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
                className="w-full text-left px-2 py-1 hover:bg-gray-50 transition flex items-center"
              >
                <StatusPill value={s} options={statusOptions} />
              </button>
            ))}
          {filter.property === 'priority' &&
            priorityList.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  onChange(p)
                  setOpen(false)
                }}
                className="w-full text-left px-2 py-1 hover:bg-gray-50 transition flex items-center"
              >
                <PriorityPill value={p} options={priorityOptions} />
              </button>
            ))}
          {filter.property === 'task_type' && (
            <>
              {knownTypes.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-gray-400">No types yet</p>
              )}
              {knownTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onChange(t)
                    setOpen(false)
                  }}
                  className="w-full text-left px-2 py-1 hover:bg-gray-50 transition flex items-center"
                >
                  <TaskTypePill value={t} options={typeOptions} />
                </button>
              ))}
            </>
          )}
          {filter.property === 'couple' && (
            <>
              {couples.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-gray-400">No couples</p>
              )}
              {couples.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id)
                    setOpen(false)
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition truncate"
                >
                  {c.name}
                </button>
              ))}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
