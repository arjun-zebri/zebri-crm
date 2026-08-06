'use client'

import * as Popover from '@radix-ui/react-popover'
import { Check, Palette, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { DatePicker } from '@/components/ui/date-picker'
import { formatRelativeDate } from '@/lib/utils'
import {
  PRIORITY_ORDER,
  STATUS_ORDER,
  TaskOption,
  TaskOptionColor,
  TASK_OPTION_COLORS,
  TASK_OPTION_DOT_CLASS,
  TASK_OPTION_PILL_CLASS,
  TaskPriority,
  taskTypeColor,
  getStatusPillClass,
  getStatusDotClass,
  getStatusLabel,
  getPriorityPillClass,
  getPriorityLabel,
  resolvePriorityPillClass,
  resolveStatusDotClass,
  resolveStatusPillClass,
  resolveTypePillClass,
} from '@/types/task'

// ─── Shared option-picker bits ─────────────────────────────────────
// Used by both PriorityCell and TaskTypeCell so the visual language
// (colour swatches, recolour popover, "Create with colour" affordance)
// stays consistent.

/** Six little circles for picking a colour. */
function ColorPickerRow({
  value,
  onChange,
  onClickStop = true,
}: {
  value: TaskOptionColor
  onChange: (c: TaskOptionColor) => void
  /** Stop event propagation so swatch clicks don't bubble out of the
   *  enclosing popover row and trigger a commit. */
  onClickStop?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      {TASK_OPTION_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={(e) => {
            if (onClickStop) e.stopPropagation()
            onChange(c)
          }}
          className={`w-4 h-4 rounded-pill border transition cursor-pointer ${
            value === c ? 'border-gray-900' : 'border-transparent'
          } ${TASK_OPTION_DOT_CLASS[c]}`}
          aria-label={c}
        />
      ))}
    </div>
  )
}

// ─── Cell wrapper ──────────────────────────────────────────────────────────
// Notion cells are flush, no border, hover bg-gray-50, cursor pointer.
// Uses `focus-visible:` (keyboard-only) rather than `focus:` for the
// background, otherwise Radix restoring focus to the trigger after
// closing the popover leaves a sticky grey shadow behind the pill.
const cellTriggerClass =
  'w-full h-full px-2 py-1 -my-1 -mx-2 text-left text-body rounded-control transition cursor-pointer hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50'

// ─── Status cell ───────────────────────────────────────────────────────────
/**
 * Notion-style picker for the `status` field.
 *
 * Built-in statuses (`todo` / `in_progress` / `done`) live in
 * `STATUS_ORDER` with hardcoded pill + dot colours and can't be
 * edited or deleted. Custom statuses come from `statusOptions` (the
 * `task_statuses` lookup table) and own their colour — they can be
 * recoloured or deleted from the dropdown. "Create" persists the new
 * option to the DB and assigns it to the current task in one motion.
 */
export function StatusCell({
  value,
  onChange,
  statusOptions = [],
  onCreateStatus,
  onRecolorStatus,
  onDeleteStatusOption,
}: {
  value: string
  onChange: (v: string) => void
  statusOptions?: TaskOption[]
  onCreateStatus?: (input: { name: string; color: TaskOptionColor }) => void
  onRecolorStatus?: (id: string, color: TaskOptionColor) => void
  onDeleteStatusOption?: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [createColor, setCreateColor] = useState<TaskOptionColor>('gray')
  const [colorPickerForId, setColorPickerForId] = useState<string | null>(null)

  type Item =
    | { kind: 'builtin'; name: string }
    | { kind: 'custom'; option: TaskOption }

  const items: Item[] = useMemo(() => {
    const builtins: Item[] = (STATUS_ORDER as string[]).map((name) => ({
      kind: 'builtin',
      name,
    }))
    const builtinNames = new Set(
      (STATUS_ORDER as string[]).map((n) => n.toLowerCase()),
    )
    const customs: Item[] = statusOptions
      .filter((o) => !builtinNames.has(o.name.toLowerCase()))
      .map((option) => ({ kind: 'custom', option }))
    return [...builtins, ...customs]
  }, [statusOptions])

  const itemName = (i: Item) =>
    i.kind === 'builtin' ? i.name : i.option.name

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) =>
      (i.kind === 'builtin' ? getStatusLabel(i.name) : i.option.name)
        .toLowerCase()
        .includes(q),
    )
  }, [draft, items])

  const exact = matches.find((i) => {
    const label =
      i.kind === 'builtin' ? getStatusLabel(i.name) : i.option.name
    return label.toLowerCase() === draft.trim().toLowerCase()
  })

  const canCreate =
    !!onCreateStatus && draft.trim().length > 0 && !exact

  const commit = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const handleCreate = () => {
    const name = draft.trim()
    if (!name || !onCreateStatus) return
    onCreateStatus({ name, color: createColor })
    commit(name)
    setCreateColor('gray')
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setDraft('')
          setColorPickerForId(null)
          setCreateColor('gray')
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cellTriggerClass}
        >
          <StatusPill value={value} options={statusOptions} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="bg-surface border border-border rounded-control shadow-lg py-1 z-[80] w-60"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 border-b border-gray-100">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (canCreate) handleCreate()
                  else if (exact) commit(itemName(exact))
                  else if (matches[0]) commit(itemName(matches[0]))
                }
              }}
              placeholder="Search or create..."
              className="w-full text-caption placeholder:text-text-subtle outline-none"
            />
          </div>

          {matches.map((item) => {
            const name = itemName(item)
            const id = item.kind === 'custom' ? item.option.id : null
            const pickerOpen = id !== null && colorPickerForId === id
            return (
              <div key={item.kind === 'builtin' ? `b-${name}` : `c-${id}`}>
                <div className="group/option flex items-center justify-between hover:bg-gray-50 transition">
                  <button
                    type="button"
                    onClick={() => commit(name)}
                    className="flex-1 min-w-0 text-left px-2 py-1.5 flex items-center justify-between gap-2"
                  >
                    <StatusPill value={name} options={statusOptions} />
                    {value === name && (
                      <Check
                        size={13}
                        strokeWidth={2}
                        className="text-text-subtle shrink-0"
                      />
                    )}
                  </button>
                  {item.kind === 'custom' && (
                    <div className="flex items-center pr-1.5 opacity-0 group-hover/option:opacity-100 transition">
                      {onRecolorStatus && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setColorPickerForId(pickerOpen ? null : id)
                          }}
                          className="p-1 text-gray-300 hover:text-gray-600 transition cursor-pointer"
                          aria-label={`Recolour ${name}`}
                        >
                          <Palette size={11} strokeWidth={1.5} />
                        </button>
                      )}
                      {onDeleteStatusOption && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteStatusOption(item.option.id)
                            if (value === name) commit('todo')
                            else setOpen(false)
                          }}
                          className="p-1 text-gray-300 hover:text-red-500 transition cursor-pointer"
                          aria-label={`Delete ${name}`}
                        >
                          <Trash2 size={11} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {pickerOpen && item.kind === 'custom' && onRecolorStatus && (
                  <div className="px-3 pb-2 pt-1">
                    <ColorPickerRow
                      value={item.option.color}
                      onChange={(c) => {
                        onRecolorStatus(item.option.id, c)
                        setColorPickerForId(null)
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {canCreate && (
            <>
              <div className="border-t border-gray-100 mt-1" />
              <div className="px-2 pt-2 pb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-text-subtle">
                  Colour
                </span>
                <ColorPickerRow
                  value={createColor}
                  onChange={setCreateColor}
                  onClickStop={false}
                />
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition flex items-center gap-2 text-caption text-text-muted"
              >
                <Plus size={12} strokeWidth={1.5} />
                Create{' '}
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-control text-caption ring-1 ring-inset ${TASK_OPTION_PILL_CLASS[createColor]}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-pill ${TASK_OPTION_DOT_CLASS[createColor]}`}
                  />
                  {draft.trim()}
                </span>
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * Pill for a status value. When `options` is provided it consults the
 * user-defined `task_statuses` list for the colour; otherwise it
 * falls back to the built-in todo/in_progress/done palette.
 */
export function StatusPill({
  value,
  options,
}: {
  value: string
  options?: TaskOption[]
}) {
  const pillClass = options
    ? resolveStatusPillClass(value, options)
    : getStatusPillClass(value)
  const dotClass = options
    ? resolveStatusDotClass(value, options)
    : getStatusDotClass(value)
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-control text-caption ring-1 ring-inset ${pillClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-pill ${dotClass}`} />
      {getStatusLabel(value)}
    </span>
  )
}

// ─── Priority cell ─────────────────────────────────────────────────────────
/**
 * Notion-style picker for the `priority` field.
 *
 * Built-in priorities (`high` / `medium` / `low`) live in
 * `PRIORITY_ORDER` with hardcoded pill colours and can't be edited or
 * deleted. Custom priorities come from `priorityOptions` (the
 * `task_priorities` lookup table) and own their colour — they can be
 * recoloured or deleted from the dropdown. "Create" persists the new
 * option to the DB and assigns it to the current task in one motion.
 */
export function PriorityCell({
  value,
  onChange,
  priorityOptions = [],
  onCreatePriority,
  onRecolorPriority,
  onDeletePriorityOption,
}: {
  value: TaskPriority | null
  onChange: (v: TaskPriority | null) => void
  priorityOptions?: TaskOption[]
  onCreatePriority?: (input: { name: string; color: TaskOptionColor }) => void
  onRecolorPriority?: (id: string, color: TaskOptionColor) => void
  onDeletePriorityOption?: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [createColor, setCreateColor] = useState<TaskOptionColor>('gray')
  const [colorPickerForId, setColorPickerForId] = useState<string | null>(null)

  type Item =
    | { kind: 'builtin'; name: string }
    | { kind: 'custom'; option: TaskOption }

  const items: Item[] = useMemo(() => {
    const builtins: Item[] = PRIORITY_ORDER.map((name) => ({
      kind: 'builtin',
      name,
    }))
    const builtinNames = new Set(PRIORITY_ORDER.map((n) => n.toLowerCase()))
    const customs: Item[] = priorityOptions
      .filter((o) => !builtinNames.has(o.name.toLowerCase()))
      .map((option) => ({ kind: 'custom', option }))
    return [...builtins, ...customs]
  }, [priorityOptions])

  const itemName = (i: Item) =>
    i.kind === 'builtin' ? i.name : i.option.name

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) =>
      (i.kind === 'builtin' ? getPriorityLabel(i.name) : i.option.name)
        .toLowerCase()
        .includes(q),
    )
  }, [draft, items])

  const exact = matches.find((i) => {
    const label =
      i.kind === 'builtin' ? getPriorityLabel(i.name) : i.option.name
    return label.toLowerCase() === draft.trim().toLowerCase()
  })

  const canCreate =
    !!onCreatePriority && draft.trim().length > 0 && !exact

  const commit = (v: TaskPriority | null) => {
    onChange(v)
    setOpen(false)
  }

  const handleCreate = () => {
    const name = draft.trim()
    if (!name || !onCreatePriority) return
    onCreatePriority({ name, color: createColor })
    commit(name)
    setCreateColor('gray')
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setDraft('')
          setColorPickerForId(null)
          setCreateColor('gray')
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cellTriggerClass}
        >
          {value ? (
            <PriorityPill value={value} options={priorityOptions} />
          ) : (
            <EmptyCellHint />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="bg-surface border border-border rounded-control shadow-lg py-1 z-[80] w-60"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 border-b border-gray-100">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (canCreate) handleCreate()
                  else if (exact) commit(itemName(exact))
                  else if (matches[0]) commit(itemName(matches[0]))
                }
              }}
              placeholder="Search or create..."
              className="w-full text-caption placeholder:text-text-subtle outline-none"
            />
          </div>

          {matches.map((item) => {
            const name = itemName(item)
            const label =
              item.kind === 'builtin' ? getPriorityLabel(name) : name
            const pillClass =
              item.kind === 'builtin'
                ? getPriorityPillClass(name)
                : TASK_OPTION_PILL_CLASS[item.option.color]
            const id = item.kind === 'custom' ? item.option.id : null
            const pickerOpen = id !== null && colorPickerForId === id
            return (
              <div key={item.kind === 'builtin' ? `b-${name}` : `c-${id}`}>
                <div className="group/option flex items-center justify-between hover:bg-gray-50 transition">
                  <button
                    type="button"
                    onClick={() => commit(name)}
                    className="flex-1 min-w-0 text-left px-2 py-1.5 flex items-center justify-between gap-2"
                  >
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-control text-caption ring-1 ring-inset ${pillClass}`}
                    >
                      {label}
                    </span>
                    {value === name && (
                      <Check
                        size={13}
                        strokeWidth={2}
                        className="text-text-subtle shrink-0"
                      />
                    )}
                  </button>
                  {item.kind === 'custom' && (
                    <div className="flex items-center pr-1.5 opacity-0 group-hover/option:opacity-100 transition">
                      {onRecolorPriority && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setColorPickerForId(pickerOpen ? null : id)
                          }}
                          className="p-1 text-gray-300 hover:text-gray-600 transition cursor-pointer"
                          aria-label={`Recolour ${name}`}
                        >
                          <Palette size={11} strokeWidth={1.5} />
                        </button>
                      )}
                      {onDeletePriorityOption && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeletePriorityOption(item.option.id)
                            if (value === name) commit(null)
                            else setOpen(false)
                          }}
                          className="p-1 text-gray-300 hover:text-red-500 transition cursor-pointer"
                          aria-label={`Delete ${name}`}
                        >
                          <Trash2 size={11} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {pickerOpen &&
                  item.kind === 'custom' &&
                  onRecolorPriority && (
                    <div className="px-3 pb-2 pt-1">
                      <ColorPickerRow
                        value={item.option.color}
                        onChange={(c) => {
                          onRecolorPriority(item.option.id, c)
                          setColorPickerForId(null)
                        }}
                      />
                    </div>
                  )}
              </div>
            )
          })}

          {canCreate && (
            <>
              <div className="border-t border-gray-100 mt-1" />
              <div className="px-2 pt-2 pb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-text-subtle">
                  Colour
                </span>
                <ColorPickerRow
                  value={createColor}
                  onChange={setCreateColor}
                  onClickStop={false}
                />
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition flex items-center gap-2 text-caption text-text-muted"
              >
                <Plus size={12} strokeWidth={1.5} />
                Create{' '}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-control text-caption ring-1 ring-inset ${TASK_OPTION_PILL_CLASS[createColor]}`}
                >
                  {draft.trim()}
                </span>
              </button>
            </>
          )}
          {value && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={() => commit(null)}
                className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition text-caption text-text-muted"
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

/**
 * Pill for a priority value. When `options` is provided it consults
 * the user-defined `task_priorities` list for the colour; otherwise
 * it falls back to the built-in palette (low/medium/high) or a
 * deterministic hash colour for unknown values.
 */
export function PriorityPill({
  value,
  options,
}: {
  value: TaskPriority
  options?: TaskOption[]
}) {
  const pillClass = options
    ? resolvePriorityPillClass(value, options)
    : getPriorityPillClass(value)
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-control text-caption ring-1 ring-inset ${pillClass}`}
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
            <span className={`text-caption tabular-nums ${overdue ? 'text-red-500' : 'text-gray-700'}`}>
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
          className="bg-surface border border-border rounded-control shadow-lg p-2 z-[80] w-72"
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
/**
 * Notion-style picker for the `task_type` field.
 *
 * Unlike priority there are no built-ins — every option is a row in
 * `task_types`. "Create" persists the new option (with the chosen
 * colour) and assigns it to the current task in one motion; existing
 * options can be recoloured or deleted from the dropdown.
 */
export function TaskTypeCell({
  value,
  onChange,
  typeOptions = [],
  onCreateType,
  onRecolorType,
  onDeleteTypeOption,
}: {
  value: string | null
  onChange: (v: string | null) => void
  typeOptions?: TaskOption[]
  onCreateType?: (input: { name: string; color: TaskOptionColor }) => void
  onRecolorType?: (id: string, color: TaskOptionColor) => void
  onDeleteTypeOption?: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [createColor, setCreateColor] = useState<TaskOptionColor>('gray')
  const [colorPickerForId, setColorPickerForId] = useState<string | null>(null)

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return typeOptions
      .filter((o) => !q || o.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [draft, typeOptions])

  const exact = matches.find(
    (o) => o.name.toLowerCase() === draft.trim().toLowerCase(),
  )
  const canCreate =
    !!onCreateType && draft.trim().length > 0 && !exact

  const commit = (v: string | null) => {
    onChange(v)
    setOpen(false)
  }

  const handleCreate = () => {
    const name = draft.trim()
    if (!name || !onCreateType) return
    onCreateType({ name, color: createColor })
    commit(name)
    setCreateColor('gray')
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setDraft('')
          setColorPickerForId(null)
          setCreateColor('gray')
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cellTriggerClass}
        >
          {value ? (
            <TaskTypePill value={value} options={typeOptions} />
          ) : (
            <EmptyCellHint />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className="bg-surface border border-border rounded-control shadow-lg py-1 z-[80] w-60 max-h-80 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 border-b border-gray-100">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (canCreate) handleCreate()
                  else if (exact) commit(exact.name)
                  else if (matches[0]) commit(matches[0].name)
                }
              }}
              placeholder="Search or create..."
              className="w-full text-caption placeholder:text-text-subtle outline-none"
            />
          </div>
          {matches.length === 0 && !canCreate && (
            <p className="px-2 py-2 text-caption text-text-subtle">No types yet</p>
          )}
          {matches.map((option) => {
            const pickerOpen = colorPickerForId === option.id
            return (
              <div key={option.id}>
                <div className="group/option flex items-center justify-between hover:bg-gray-50 transition">
                  <button
                    type="button"
                    onClick={() => commit(option.name)}
                    className="flex-1 min-w-0 text-left px-2 py-1.5 flex items-center justify-between gap-2"
                  >
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-control text-caption ring-1 ring-inset ${TASK_OPTION_PILL_CLASS[option.color]}`}
                    >
                      {option.name}
                    </span>
                    {value === option.name && (
                      <Check
                        size={13}
                        strokeWidth={2}
                        className="text-text-subtle shrink-0"
                      />
                    )}
                  </button>
                  <div className="flex items-center pr-1.5 opacity-0 group-hover/option:opacity-100 transition">
                    {onRecolorType && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setColorPickerForId(pickerOpen ? null : option.id)
                        }}
                        className="p-1 text-gray-300 hover:text-gray-600 transition cursor-pointer"
                        aria-label={`Recolour ${option.name}`}
                      >
                        <Palette size={11} strokeWidth={1.5} />
                      </button>
                    )}
                    {onDeleteTypeOption && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteTypeOption(option.id)
                          if (value === option.name) commit(null)
                          else setOpen(false)
                        }}
                        className="p-1 text-gray-300 hover:text-red-500 transition cursor-pointer"
                        aria-label={`Delete ${option.name}`}
                      >
                        <Trash2 size={11} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
                {pickerOpen && onRecolorType && (
                  <div className="px-3 pb-2 pt-1">
                    <ColorPickerRow
                      value={option.color}
                      onChange={(c) => {
                        onRecolorType(option.id, c)
                        setColorPickerForId(null)
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
          {canCreate && (
            <>
              <div className="border-t border-gray-100 mt-1" />
              <div className="px-2 pt-2 pb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-text-subtle">
                  Colour
                </span>
                <ColorPickerRow
                  value={createColor}
                  onChange={setCreateColor}
                  onClickStop={false}
                />
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition flex items-center gap-2 text-caption text-text-muted"
              >
                <Plus size={12} strokeWidth={1.5} />
                Create{' '}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-control text-caption ring-1 ring-inset ${TASK_OPTION_PILL_CLASS[createColor]}`}
                >
                  {draft.trim()}
                </span>
              </button>
            </>
          )}
          {value && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={() => commit(null)}
                className="w-full text-left px-2 py-1.5 hover:bg-gray-50 transition text-caption text-text-muted"
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

/**
 * Pill for a task_type value. When `options` is provided it consults
 * the user-defined `task_types` list for the colour; otherwise it
 * falls back to the deterministic hash palette so legacy callers
 * still render something sensible.
 */
export function TaskTypePill({
  value,
  options,
}: {
  value: string
  options?: TaskOption[]
}) {
  const pillClass = options ? resolveTypePillClass(value, options) : taskTypeColor(value)
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-control text-caption ring-1 ring-inset ${pillClass}`}
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
        className="w-full bg-surface rounded-control px-1.5 py-0.5 text-body text-text outline-none shadow-[0_1px_6px_rgba(0,0,0,0.1)] select-text"
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
      className={`w-full text-left text-body truncate px-1.5 py-0.5 rounded-control sm:hover:bg-gray-50 transition pointer-events-none sm:pointer-events-auto sm:cursor-text ${
        done ? 'text-text-subtle line-through' : 'text-text'
      }`}
    >
      {displayValue || <span className="text-gray-300">Untitled</span>}
    </button>
  )
}

// ─── Empty hint (matches Notion's empty-cell affordance) ───────────────────
function EmptyCellHint() {
  return <span className="text-caption text-gray-300">Empty</span>
}
