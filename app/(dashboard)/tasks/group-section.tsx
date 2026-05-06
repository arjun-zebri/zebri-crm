'use client'

import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as Popover from '@radix-ui/react-popover'
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  Palette,
} from 'lucide-react'
import {
  TaskGroup,
  TaskGroupColor,
  TASK_GROUP_COLORS,
  TASK_GROUP_DOT_CLASS,
} from './use-task-groups'
import { ColumnKey } from './task-row'

interface GroupSectionProps {
  /** A coloured header pill node (e.g. status pill, priority pill, custom group) */
  header: React.ReactNode
  count: number
  taskIds: string[]
  children: React.ReactNode
  /** Drop-target id (used when dragging tasks to change their grouping value) */
  droppableId: string
  /** Optional inline rename / colour / delete actions for custom groups */
  group?: TaskGroup
  onRename?: (id: string, name: string) => void
  onRecolor?: (id: string, color: TaskGroupColor) => void
  onDelete?: (id: string) => void
  /** New-task affordance ("+ New task") */
  onAddTask?: () => void
  /** When draggable, the section header itself can be reordered (custom groups only) */
  draggable?: boolean
  defaultCollapsed?: boolean
}

const UNGROUPED_DROPPABLE_ID = '__ungrouped__'
export const UNGROUPED_ID = UNGROUPED_DROPPABLE_ID

export function GroupSection({
  header,
  count,
  taskIds,
  children,
  droppableId,
  group,
  onRename,
  onRecolor,
  onDelete,
  onAddTask,
  draggable = false,
  defaultCollapsed = false,
}: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `group:${droppableId}`,
    data: { type: 'group', droppableId },
  })

  const sortable = useSortable({
    id: `group-header:${droppableId}`,
    data: { type: 'group-header', droppableId },
    disabled: !draggable || !group,
  })

  const headerStyle = draggable && group
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.5 : 1,
      }
    : undefined

  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const startEditing = () => {
    setDraftName(group?.name ?? '')
    setEditing(true)
  }

  const commitRename = () => {
    const trimmed = draftName.trim()
    setEditing(false)
    if (group && trimmed && trimmed !== group.name && onRename) onRename(group.id, trimmed)
  }

  return (
    <section ref={setDroppableRef} className={`mb-6 ${isOver ? 'bg-emerald-50/30 rounded-lg' : ''}`}>
      <div
        ref={group ? sortable.setNodeRef : undefined}
        style={headerStyle}
        className="group/header flex items-center gap-2 pl-3.5 sm:pl-11 pr-2 pt-5 pb-1.5"
      >
        {editing && group ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="text-sm font-medium text-gray-900 bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none ring-2 ring-blue-100"
          />
        ) : (
          header
        )}

        <span className="text-xs text-gray-400 tabular-nums">{count}</span>

        <div className="ml-1 flex items-center gap-0.5">
          {group && onRecolor && (
            <Popover.Root open={colorOpen} onOpenChange={setColorOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer opacity-0 group-hover/header:opacity-100 focus:opacity-100"
                  aria-label="Change colour"
                >
                  <Palette size={12} strokeWidth={1.5} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  sideOffset={4}
                  align="end"
                  className="z-[70] bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex gap-1.5"
                >
                  {TASK_GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        onRecolor(group.id, c)
                        setColorOpen(false)
                      }}
                      className={`w-5 h-5 rounded-full border-2 transition cursor-pointer ${
                        group.color === c ? 'border-gray-900' : 'border-transparent'
                      } ${TASK_GROUP_DOT_CLASS[c]}`}
                      aria-label={c}
                    />
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
          {(group && (onRename || onDelete)) && (
            <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer opacity-0 group-hover/header:opacity-100 focus:opacity-100"
                  aria-label="Group menu"
                >
                  <MoreHorizontal size={13} strokeWidth={1.5} />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  sideOffset={4}
                  align="end"
                  className="z-[70] bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-40"
                >
                  {onRename && (
                    <button
                      type="button"
                      onClick={() => {
                        startEditing()
                        setMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
                    >
                      <Pencil size={13} strokeWidth={1.5} />
                      Rename
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(group.id)
                        setMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                      Delete group
                    </button>
                  )}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
          {onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer opacity-0 group-hover/header:opacity-100 focus:opacity-100"
              aria-label="Add task"
            >
              <Plus size={13} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Chevron on the right */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition cursor-pointer"
          aria-label={collapsed ? 'Expand group' : 'Collapse group'}
        >
          {collapsed ? (
            <ChevronRight size={14} strokeWidth={1.5} />
          ) : (
            <ChevronDown size={14} strokeWidth={1.5} />
          )}
        </button>

        {draggable && group && (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="hidden sm:flex shrink-0 text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none transition opacity-0 group-hover/header:opacity-100"
            tabIndex={-1}
            aria-label="Drag group"
          >
            <GripVertical size={13} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          <div className="mt-3">
            <ColumnHeader columns={['status', 'due_date', 'priority', 'task_type']} />
          </div>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <div>{children}</div>
          </SortableContext>
          {count === 0 && (
            <div className="px-3 py-2 text-xs text-gray-300 italic border-b border-gray-100">
              No tasks
            </div>
          )}
          {onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="w-full flex items-center gap-2 pl-3.5 sm:pl-11 pr-2 py-2 text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer border-b border-transparent"
            >
              <Plus size={13} strokeWidth={1.5} className="shrink-0" />
              New task
            </button>
          )}
        </>
      )}
    </section>
  )
}

// ─── Column header row ─────────────────────────────────────────────────────
import { Calendar, ListChecks, Tag, Target } from 'lucide-react'

const COLUMN_LABEL: Record<ColumnKey, { label: string; icon: React.ReactNode }> = {
  status: { label: 'Status', icon: <ListChecks size={12} strokeWidth={1.5} /> },
  due_date: { label: 'Due date', icon: <Calendar size={12} strokeWidth={1.5} /> },
  priority: { label: 'Priority', icon: <Target size={12} strokeWidth={1.5} /> },
  task_type: { label: 'Task type', icon: <Tag size={12} strokeWidth={1.5} /> },
}

const COLUMN_WIDTHS: Record<ColumnKey, string> = {
  status: '140px',
  due_date: '120px',
  priority: '100px',
  task_type: '160px',
}

export function ColumnHeader({ columns }: { columns: ColumnKey[] }) {
  const template = ['28px', 'minmax(200px, 1fr)', ...columns.map((c) => COLUMN_WIDTHS[c])].join(' ')
  return (
    <div
      className="hidden sm:grid items-center gap-2 px-2 py-1.5 border-b border-gray-200 text-xs text-gray-400"
      style={{ gridTemplateColumns: template }}
    >
      <span />
      <span className="px-1.5 flex items-center gap-1.5">
        <span className="text-[11px]">Aa</span>
        Task name
      </span>
      {columns.map((c) => (
        <span key={c} className="flex items-center gap-1.5 truncate px-1">
          {COLUMN_LABEL[c].icon}
          {COLUMN_LABEL[c].label}
        </span>
      ))}
    </div>
  )
}
