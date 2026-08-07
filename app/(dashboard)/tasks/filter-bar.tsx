'use client'

import * as Popover from '@radix-ui/react-popover'
import { ArrowDown, ArrowUp, Filter as FilterIcon, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { MenuItem, MenuPanel } from '@/components/ui/menu'
import {
  STATUS_ORDER,
  TaskOption,
  getPriorityLabel,
  getStatusLabel,
} from '@/types/task'

import {
  PriorityPill,
  StatusPill,
  TaskTypePill,
} from './task-cells'


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
        <Button
          key={`sort-${i}`}
          variant="secondary"
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
            className="ml-1 cursor-pointer text-text-subtle hover:text-text"
          >
            <X size={10} strokeWidth={1.5} />
          </span>
        </Button>
      ))}

      <Popover.Root open={addOpen} onOpenChange={setAddOpen}>
        <Popover.Trigger asChild>
          <Button variant="outline" className="whitespace-nowrap">
            <FilterIcon size={11} strokeWidth={1.5} />
            <span>Filter</span>
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={4} align="start" className="z-[80]">
            <MenuPanel>
              {(['status', 'priority', 'task_type', 'couple'] as FilterProperty[]).map((p) => (
                <MenuItem
                  key={p}
                  size="sm"
                  onClick={() => {
                    setFilters([...filters, { property: p, value: '' }])
                    setAddOpen(false)
                  }}
                >
                  {PROPERTY_LABEL[p]}
                </MenuItem>
              ))}
            </MenuPanel>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Popover.Root open={addSortOpen} onOpenChange={setAddSortOpen}>
        <Popover.Trigger asChild>
          <Button variant="outline" className="whitespace-nowrap">
            <ArrowUp size={11} strokeWidth={1.5} />
            <span>Sort</span>
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={4} align="start" className="z-[80]">
            <MenuPanel>
              {(['due_date', 'status', 'priority', 'title'] as SortProperty[]).map((p) => (
                <MenuItem
                  key={p}
                  size="sm"
                  onClick={() => {
                    setSorts([...sorts, { property: p, direction: 'asc' }])
                    setAddSortOpen(false)
                  }}
                >
                  {SORT_LABEL[p]}
                </MenuItem>
              ))}
            </MenuPanel>
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
        <Button variant="secondary">
          <span className="text-text-muted">{PROPERTY_LABEL[filter.property]}</span>
          <span className="text-gray-300">:</span>
          <span>{valueLabel}</span>
          <span
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="ml-0.5 cursor-pointer text-text-subtle hover:text-text"
          >
            <X size={10} strokeWidth={1.5} />
          </span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        {/* Width lives on MenuPanel, not here. Radix positions this box
            but leaves it auto-width, and the `w-full` rows inside used to
            blow it out to the full viewport. */}
        <Popover.Content sideOffset={4} align="start" className="z-[80]">
          <MenuPanel className="max-h-72 overflow-y-auto">
            {filter.property === 'status' &&
              statusList.map((s) => (
                <MenuItem
                  key={s}
                  size="sm"
                  onClick={() => {
                    onChange(s)
                    setOpen(false)
                  }}
                >
                  <StatusPill value={s} options={statusOptions} />
                </MenuItem>
              ))}
            {filter.property === 'priority' &&
              priorityList.map((p) => (
                <MenuItem
                  key={p}
                  size="sm"
                  onClick={() => {
                    onChange(p)
                    setOpen(false)
                  }}
                >
                  <PriorityPill value={p} options={priorityOptions} />
                </MenuItem>
              ))}
            {filter.property === 'task_type' && (
              <>
                {knownTypes.length === 0 && (
                  <p className="px-2 py-1.5 text-body text-text-subtle">No types yet</p>
                )}
                {knownTypes.map((t) => (
                  <MenuItem
                    key={t}
                    size="sm"
                    onClick={() => {
                      onChange(t)
                      setOpen(false)
                    }}
                  >
                    <TaskTypePill value={t} options={typeOptions} />
                  </MenuItem>
                ))}
              </>
            )}
            {filter.property === 'couple' && (
              <>
                {couples.length === 0 && (
                  <p className="px-2 py-1.5 text-body text-text-subtle">No couples</p>
                )}
                {couples.map((c) => (
                  <MenuItem
                    key={c.id}
                    size="sm"
                    onClick={() => {
                      onChange(c.id)
                      setOpen(false)
                    }}
                  >
                    {c.name}
                  </MenuItem>
                ))}
              </>
            )}
          </MenuPanel>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
