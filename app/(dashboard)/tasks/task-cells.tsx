'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, Plus, Trash2 } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { formatRelativeDate } from '@/lib/utils'
import {
  PRIORITY_ORDER,
  STATUS_ORDER,
  TaskPriority,
  taskTypeColor,
  getStatusPillClass,
  getStatusDotClass,
  getStatusLabel,
  getPriorityPillClass,
  getPriorityLabel,
} from './task-types'

// ─── Cell wrapper ──────────────────────────────────────────────────────────
// Notion cells are flush, no border, hover bg-gray-50, cursor pointer.
const cellTriggerClass =
  'w-full h-full px-2 py-1 -my-1 -mx-2 text-left text-sm rounded transition cursor-pointer hover:bg-gray-50 focus:outline-none focus:bg-gray-50'

// ─── Status cell ───────────────────────────────────────────────────────────
export function StatusCell({
  value,
  onChange,
  knownStatuses,
  onDeleteStatus,
}: {
  value: string
  onChange: (v: string) => void
  knownStatuses?: string[]
  onDeleteStatus?: (status: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const allStatuses = useMemo(() => {
    const base = STATUS_ORDER as string[]
    const custom = (knownStatuses ?? []).filter((s) => !base.includes(s))
    return [...base, ...custom]
  }, [knownStatuses])

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return q ? allStatuses.filter((s) => getStatusLabel(s).toLowerCase().includes(q)) : allStatuses
  }, [draft, allStatuses])

  const exact = matches.find((s) => getStatusLabel(s).toLowerCase() === draft.trim().toLowerCase())
  const canCreate = draft.trim().length > 0 && !exact && !allStatuses.includes(draft.trim())

  const commit = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const isBuiltIn = (s: string) => (STATUS_ORDER as string[]).includes(s)

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft('') }}>
      <Popover.Trigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()} className={cellTriggerClass}>
          <StatusPill value={value} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[80] w-52"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 border-b border-gray-100">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (canCreate) commit(draft.trim())
                  else if (exact) commit(exact)
                  else if (matches[0]) commit(matches[0])
                }
              }}
              placeholder="Search or create..."
              className="w-full text-xs placeholder:text-gray-400 outline-none"
            />
          </div>
          {matches.map((s) => (
            <div
              key={s}
              className="group/status flex items-center justify-between hover:bg-gray-50 transition"
            >
              <button
                type="button"
                onClick={() => commit(s)}
                className="flex-1 text-left px-2 py-1.5 flex items-center justify-between gap-2"
              >
                <StatusPill value={s} />
                {value === s && <Check size={13} strokeWidth={2} className="text-gray-400" />}
              </button>
              {onDeleteStatus && !isBuiltIn(s) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteStatus(s)
                    if (value === s) commit('todo')
                    else setOpen(false)
                  }}
                  className="mr-1.5 p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover/status:opacity-100 transition cursor-pointer"
                  aria-label={`Delete status ${s}`}
                >
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => commit(draft.trim())}
              className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition flex items-center gap-2 text-xs text-gray-500"
            >
              <Plus size={12} strokeWidth={1.5} />
              Create <StatusPill value={draft.trim()} />
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs ring-1 ring-inset ${getStatusPillClass(value)}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotClass(value)}`} />
      {getStatusLabel(value)}
    </span>
  )
}

// ─── Priority cell ─────────────────────────────────────────────────────────
export function PriorityCell({
  value,
  onChange,
  knownPriorities,
  onDeletePriority,
}: {
  value: TaskPriority | null
  onChange: (v: TaskPriority | null) => void
  knownPriorities?: string[]
  onDeletePriority?: (priority: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const allPriorities = useMemo(() => {
    const base = PRIORITY_ORDER
    const custom = (knownPriorities ?? []).filter((p) => !base.includes(p))
    return [...base, ...custom]
  }, [knownPriorities])

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return q
      ? allPriorities.filter((p) => getPriorityLabel(p).toLowerCase().includes(q))
      : allPriorities
  }, [draft, allPriorities])

  const exact = matches.find((p) => getPriorityLabel(p).toLowerCase() === draft.trim().toLowerCase())
  const canCreate = draft.trim().length > 0 && !exact && !allPriorities.includes(draft.trim())

  const commit = (v: TaskPriority | null) => {
    onChange(v)
    setOpen(false)
  }

  const isBuiltIn = (p: string) => PRIORITY_ORDER.includes(p)

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDraft('')
      }}
    >
      <Popover.Trigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()} className={cellTriggerClass}>
          {value ? <PriorityPill value={value} /> : <EmptyCellHint />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[80] w-52"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 border-b border-gray-100">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (canCreate) commit(draft.trim())
                  else if (exact) commit(exact)
                  else if (matches[0]) commit(matches[0])
                }
              }}
              placeholder="Search or create..."
              className="w-full text-xs placeholder:text-gray-400 outline-none"
            />
          </div>
          {matches.map((p) => (
            <div
              key={p}
              className="group/priority flex items-center justify-between hover:bg-gray-50 transition"
            >
              <button
                type="button"
                onClick={() => commit(p)}
                className="flex-1 text-left px-2 py-1.5 flex items-center justify-between gap-2"
              >
                <PriorityPill value={p} />
                {value === p && <Check size={13} strokeWidth={2} className="text-gray-400" />}
              </button>
              {onDeletePriority && !isBuiltIn(p) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeletePriority(p)
                    if (value === p) commit(null)
                    else setOpen(false)
                  }}
                  className="mr-1.5 p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover/priority:opacity-100 transition cursor-pointer"
                  aria-label={`Delete priority ${p}`}
                >
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => commit(draft.trim())}
              className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition flex items-center gap-2 text-xs text-gray-500"
            >
              <Plus size={12} strokeWidth={1.5} />
              Create <PriorityPill value={draft.trim()} />
            </button>
          )}
          {value && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={() => commit(null)}
                className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition text-xs text-gray-500"
              >
                Clear
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function PriorityPill({ value }: { value: TaskPriority }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ring-1 ring-inset ${getPriorityPillClass(value)}`}
    >
      {getPriorityLabel(value)}
    </span>
  )
}

// ─── Due date cell ─────────────────────────────────────────────────────────
export function DueDateCell({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue = (() => {
    if (!value) return false
    const d = new Date(value + 'T00:00:00')
    d.setHours(0, 0, 0, 0)
    return d.getTime() < today.getTime()
  })()

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()} className={cellTriggerClass}>
          {value ? (
            <span className={`text-xs tabular-nums ${overdue ? 'text-red-500' : 'text-gray-700'}`}>
              {formatRelativeDate(value)}
            </span>
          ) : (
            <EmptyCellHint />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-[80] w-72"
          onClick={(e) => e.stopPropagation()}
        >
          <DatePicker
            value={value ?? ''}
            onChange={(v) => {
              onChange(v || null)
              setOpen(false)
            }}
            calendarOnly
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ─── Task type cell ────────────────────────────────────────────────────────
export function TaskTypeCell({
  value,
  onChange,
  knownTypes,
  onDeleteType,
}: {
  value: string | null
  onChange: (v: string | null) => void
  knownTypes: string[]
  onDeleteType?: (type: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return knownTypes
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .filter((t) => !q || t.toLowerCase().includes(q))
      .sort()
  }, [draft, knownTypes])

  const exact = matches.find((t) => t.toLowerCase() === draft.trim().toLowerCase())
  const canCreate = draft.trim() && !exact

  const commit = (v: string | null) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDraft('')
      }}
    >
      <Popover.Trigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()} className={cellTriggerClass}>
          {value ? <TaskTypePill value={value} /> : <EmptyCellHint />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[80] w-56 max-h-72 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) commit(draft.trim())
                else if (e.key === 'Enter' && exact) commit(exact)
              }}
              placeholder="Search or create..."
              className="w-full text-xs placeholder:text-gray-400 outline-none"
            />
          </div>
          <div className="border-t border-gray-100" />
          {matches.length === 0 && !canCreate && (
            <p className="px-2 py-2 text-xs text-gray-400">No types yet</p>
          )}
          {matches.map((t) => (
            <div
              key={t}
              className="group/type flex items-center justify-between hover:bg-gray-50 transition"
            >
              <button
                type="button"
                onClick={() => commit(t)}
                className="flex-1 text-left px-2 py-1.5 flex items-center gap-2"
              >
                <TaskTypePill value={t} />
                {value === t && <Check size={13} strokeWidth={2} className="text-gray-400" />}
              </button>
              {onDeleteType && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteType(t)
                    if (value === t) commit(null)
                    setOpen(false)
                  }}
                  className="mr-1.5 p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover/type:opacity-100 transition cursor-pointer"
                  aria-label={`Delete type ${t}`}
                >
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => commit(draft.trim())}
              className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition flex items-center gap-2 text-xs text-gray-500"
            >
              <Plus size={12} strokeWidth={1.5} />
              Create <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs ring-1 ring-inset bg-gray-50 text-gray-700 ring-gray-200">
                {draft.trim()}
              </span>
            </button>
          )}
          {value && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={() => commit(null)}
                className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition text-xs text-gray-500"
              >
                Clear
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function TaskTypePill({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ring-1 ring-inset ${taskTypeColor(value)}`}
    >
      {value}
    </span>
  )
}

// ─── Title cell (inline edit) ──────────────────────────────────────────────
export function TitleCell({
  value,
  onCommit,
  done,
}: {
  value: string
  onCommit: (v: string) => void
  done: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [displayValue, setDisplayValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplayValue(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      const len = inputRef.current.value.length
      inputRef.current.setSelectionRange(len, len)
    }
  }, [editing])

  const startEdit = () => {
    setDraft(displayValue)
    setEditing(true)
  }

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== displayValue) {
      setDisplayValue(trimmed)
      onCommit(trimmed)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        defaultValue={displayValue}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            setEditing(false)
            setDraft(displayValue)
          }
        }}
        className="w-full bg-white rounded-md px-1.5 py-0.5 text-sm text-gray-900 outline-none shadow-[0_1px_6px_rgba(0,0,0,0.1)] select-text"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        startEdit()
      }}
      className={`w-full text-left text-sm truncate px-1.5 py-0.5 rounded sm:hover:bg-gray-50 transition pointer-events-none sm:pointer-events-auto sm:cursor-text ${
        done ? 'text-gray-400 line-through' : 'text-gray-900'
      }`}
    >
      {displayValue || <span className="text-gray-300">Untitled</span>}
    </button>
  )
}

// ─── Empty hint (matches Notion's empty-cell affordance) ───────────────────
function EmptyCellHint() {
  return <span className="text-xs text-gray-300">Empty</span>
}
