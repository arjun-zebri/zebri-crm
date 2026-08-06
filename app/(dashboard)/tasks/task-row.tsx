'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Maximize2 } from 'lucide-react'
import { memo } from 'react'


import { formatRelativeDate } from '@/lib/utils'
import { TaskOption, TaskOptionColor, TaskPriority } from '@/types/task'

import {
  DueDateCell,
  PriorityCell,
  StatusCell,
  TaskTypeCell,
  TitleCell,
} from './task-cells'

export interface TaskRowTask {
  id: string
  title: string
  due_date: string | null
  description?: string | null
  status: string
  related_couple_id?: string | null
  group_id?: string | null
  priority?: TaskPriority | null
  task_type?: string | null
  couple?: { id: string; name: string } | null
}

export interface TaskRowProps {
  task: TaskRowTask
  selected?: boolean
  selectionActive?: boolean
  draggable?: boolean
  showCouple?: boolean
  /** Skeleton/muted state for tasks still being persisted to the server */
  pending?: boolean
  /**
   * Drop the 28px leading gutter (drag handle + selection checkbox).
   * Use in contexts without drag-to-reorder and without bulk selection
   * (e.g. the per-couple / per-event Tasks tabs inside modals) so the
   * row aligns with the "+ New task" affordance below.
   */
  hideGutter?: boolean
  /** Visible columns to render. Defaults to all. */
  columns?: ColumnKey[]
  /** User-defined status options (`task_statuses` rows). */
  statusOptions?: TaskOption[]
  /** User-defined priority options (`task_priorities` rows). */
  priorityOptions?: TaskOption[]
  /** User-defined task type options (`task_types` rows). */
  typeOptions?: TaskOption[]
  /** Persist a new status option to the DB. */
  onCreateStatusOption?: (input: {
    name: string
    color: TaskOptionColor
  }) => void
  onRecolorStatusOption?: (id: string, color: TaskOptionColor) => void
  onDeleteStatusOption?: (id: string) => void
  /** Persist a new priority option to the DB. */
  onCreatePriorityOption?: (input: {
    name: string
    color: TaskOptionColor
  }) => void
  onRecolorPriorityOption?: (id: string, color: TaskOptionColor) => void
  onDeletePriorityOption?: (id: string) => void
  /** Persist a new task_type option to the DB. */
  onCreateTypeOption?: (input: {
    name: string
    color: TaskOptionColor
  }) => void
  onRecolorTypeOption?: (id: string, color: TaskOptionColor) => void
  onDeleteTypeOption?: (id: string) => void
  onCommitTitle: (title: string) => void
  onChangeStatus: (status: string) => void
  onChangeDueDate: (date: string | null) => void
  onChangePriority: (priority: TaskPriority | null) => void
  onChangeTaskType: (type: string | null) => void
  onOpen: () => void
  onCoupleClick?: (id: string) => void
  onToggleSelect?: (e: React.MouseEvent) => void
}

export type ColumnKey = 'status' | 'due_date' | 'priority' | 'task_type'

const DEFAULT_COLUMNS: ColumnKey[] = ['status', 'due_date', 'priority', 'task_type']

export function TaskRow(props: TaskRowProps) {
  const { task, draggable = false, pending = false } = props

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable || pending,
  })

  const style = draggable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: pending ? 0.5 : isDragging ? 0.4 : 1,
      }
    : pending
    ? { opacity: 0.5 }
    : undefined

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRowContent
        {...props}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  )
}

interface TaskRowContentProps extends TaskRowProps {
  dragAttributes?: ReturnType<typeof useSortable>['attributes']
  dragListeners?: ReturnType<typeof useSortable>['listeners']
}

const TaskRowContent = memo(function TaskRowContent({
  task,
  selected,
  selectionActive,
  draggable = false,
  showCouple = true,
  pending = false,
  hideGutter = false,
  columns = DEFAULT_COLUMNS,
  statusOptions,
  priorityOptions,
  typeOptions,
  onCreateStatusOption,
  onRecolorStatusOption,
  onDeleteStatusOption,
  onCreatePriorityOption,
  onRecolorPriorityOption,
  onDeletePriorityOption,
  onCreateTypeOption,
  onRecolorTypeOption,
  onDeleteTypeOption,
  onCommitTitle,
  onChangeStatus,
  onChangeDueDate,
  onChangePriority,
  onChangeTaskType,
  onOpen,
  onCoupleClick,
  onToggleSelect,
  dragAttributes,
  dragListeners,
}: TaskRowContentProps) {
  const done = task.status === 'done'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue = (() => {
    if (!task.due_date) return false
    const d = new Date(task.due_date + 'T00:00:00')
    d.setHours(0, 0, 0, 0)
    return d.getTime() < today.getTime()
  })()

  return (
    <div
      onClick={pending ? undefined : onOpen}
      className={`group px-2 border-b border-gray-100 transition select-none ${
        pending
          ? 'cursor-default animate-pulse'
          : selected
          ? 'bg-emerald-50/40 cursor-pointer'
          : 'hover:bg-gray-50/60 cursor-pointer'
      }`}
    >
      <RowGrid
        columns={columns}
        hideGutter={hideGutter}
        mobileSub={
          task.due_date ? (
            <span className={`block text-caption mt-0.5 px-1.5 ${overdue ? 'text-red-400' : 'text-text-subtle'}`}>
              {formatRelativeDate(task.due_date)}
            </span>
          ) : undefined
        }
        gutter={
          <div className="flex items-center gap-1 py-1.5">
            {draggable && !pending && (
              <button
                type="button"
                {...dragAttributes}
                {...dragListeners}
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:flex shrink-0 text-gray-300 hover:text-text-muted cursor-grab active:cursor-grabbing touch-none transition opacity-0 group-hover:opacity-100"
                tabIndex={-1}
                aria-label="Drag to reorder"
              >
                <GripVertical size={13} strokeWidth={1.5} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelect?.(e)
              }}
              disabled={pending}
              className={`shrink-0 w-4 h-4 rounded-control border transition cursor-pointer ${
                selected
                  ? 'bg-emerald-500 border-emerald-500 opacity-100'
                  : `border-border-strong hover:border-gray-500 ${
                      selectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`
              } flex items-center justify-center`}
              aria-label={selected ? 'Deselect task' : 'Select task'}
            >
              {selected && <CheckMark />}
            </button>
          </div>
        }
        title={
          <div className="flex items-center gap-1.5 py-1.5 min-w-0">
            <div className="flex-1 min-w-0">
              <TitleCell value={task.title} onCommit={onCommitTitle} done={done} />
            </div>
            {showCouple && task.couple && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCoupleClick?.(task.couple!.id)
                }}
                className="text-caption bg-surface-emphasis text-text-muted rounded-pill px-2 py-0.5 hover:bg-gray-200 hover:text-gray-700 transition cursor-pointer whitespace-nowrap shrink-0"
              >
                {task.couple.name}
              </button>
            )}
            {!pending && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen()
                }}
                className="shrink-0 text-caption text-text-muted hover:text-text px-1.5 py-0.5 rounded-control border border-border hover:border-border-strong bg-surface shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition flex items-center gap-1 cursor-pointer"
                title="Open"
                aria-label="Open task"
              >
                <Maximize2 size={11} strokeWidth={1.5} />
                <span className="hidden sm:inline">Open</span>
              </button>
            )}
          </div>
        }
        cells={{
          status: (
            <StatusCell
              value={task.status}
              onChange={onChangeStatus}
              statusOptions={statusOptions}
              onCreateStatus={onCreateStatusOption}
              onRecolorStatus={onRecolorStatusOption}
              onDeleteStatusOption={onDeleteStatusOption}
            />
          ),
          due_date: (
            <DueDateCell value={task.due_date} onChange={onChangeDueDate} />
          ),
          priority: (
            <PriorityCell
              value={task.priority ?? null}
              onChange={onChangePriority}
              priorityOptions={priorityOptions}
              onCreatePriority={onCreatePriorityOption}
              onRecolorPriority={onRecolorPriorityOption}
              onDeletePriorityOption={onDeletePriorityOption}
            />
          ),
          task_type: (
            <TaskTypeCell
              value={task.task_type ?? null}
              onChange={onChangeTaskType}
              typeOptions={typeOptions}
              onCreateType={onCreateTypeOption}
              onRecolorType={onRecolorTypeOption}
              onDeleteTypeOption={onDeleteTypeOption}
            />
          ),
        }}
      />
    </div>
  )
})

// ─── Grid helper ───────────────────────────────────────────────────────────
// Tailwind utilities can't dynamically generate grid templates, so we use
// inline style here. The widths roughly mirror Notion's defaults.

const COLUMN_WIDTHS: Record<ColumnKey, string> = {
  status: '140px',
  due_date: '120px',
  priority: '100px',
  task_type: '160px',
}

function RowGrid({
  gutter,
  title,
  cells,
  columns,
  mobileSub,
  hideGutter = false,
}: {
  gutter: React.ReactNode
  title: React.ReactNode
  cells: Record<ColumnKey, React.ReactNode>
  columns: ColumnKey[]
  mobileSub?: React.ReactNode
  hideGutter?: boolean
}) {
  const template = [
    ...(hideGutter ? [] : ['28px']),
    'minmax(200px, 1fr)',
    ...columns.map((c) => COLUMN_WIDTHS[c]),
  ].join(' ')
  return (
    <div className="contents">
      {/* Mobile: title full-width + due date, no checkbox */}
      <div className="sm:hidden py-2 min-w-0">
        {title}
        {mobileSub}
      </div>
      {/* Desktop: full grid with gutter + all columns */}
      <div
        className="hidden sm:grid items-center gap-2"
        style={{ gridTemplateColumns: template }}
      >
        {!hideGutter && gutter}
        {title}
        {columns.map((c) => (
          <div key={c} className="min-w-0 truncate">
            {cells[c]}
          </div>
        ))}
      </div>
    </div>
  )
}

function CheckMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 5.2L4 7.2L8 3"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
