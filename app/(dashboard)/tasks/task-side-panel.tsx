'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { SidePanel } from '@/components/ui/side-panel'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TASK_GROUP_DOT_CLASS, TaskGroup } from './use-task-groups'
import {
  DueDateCell,
  PriorityCell,
  StatusCell,
  TaskTypeCell,
} from './task-cells'
import { TaskOption, TaskOptionColor, TaskPriority } from '@/types/task'

export interface TaskPanelTask {
  id: string
  title: string
  due_date: string | null
  description?: string | null
  related_couple_id?: string | null
  group_id?: string | null
  priority?: TaskPriority | null
  task_type?: string | null
  status: string
}

export interface TaskFieldUpdate {
  title?: string
  due_date?: string | null
  description?: string | null
  related_couple_id?: string | null
  group_id?: string | null
  status?: string
  priority?: TaskPriority | null
  task_type?: string | null
}

interface TaskSidePanelProps {
  isOpen: boolean
  onClose: () => void
  task?: TaskPanelTask
  couples?: { id: string; name: string }[]
  groups?: TaskGroup[]
  statusOptions?: TaskOption[]
  priorityOptions?: TaskOption[]
  typeOptions?: TaskOption[]
  onCreateStatusOption?: (input: {
    name: string
    color: TaskOptionColor
  }) => void
  onRecolorStatusOption?: (id: string, color: TaskOptionColor) => void
  onDeleteStatusOption?: (id: string) => void
  onCreatePriorityOption?: (input: {
    name: string
    color: TaskOptionColor
  }) => void
  onRecolorPriorityOption?: (id: string, color: TaskOptionColor) => void
  onDeletePriorityOption?: (id: string) => void
  onCreateTypeOption?: (input: {
    name: string
    color: TaskOptionColor
  }) => void
  onRecolorTypeOption?: (id: string, color: TaskOptionColor) => void
  onDeleteTypeOption?: (id: string) => void
  onPatch: (id: string, patch: TaskFieldUpdate) => void
  onDelete?: (id: string) => void
  onPrev?: () => void
  onNext?: () => void
}

export function TaskSidePanel({
  isOpen,
  onClose,
  task,
  couples,
  groups,
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
  onPatch,
  onDelete,
  onPrev,
  onNext,
}: TaskSidePanelProps) {
  if (!task) return null
  return (
    <TaskSidePanelInner
      key={task.id}
      isOpen={isOpen}
      onClose={onClose}
      task={task}
      couples={couples}
      groups={groups}
      statusOptions={statusOptions}
      priorityOptions={priorityOptions}
      typeOptions={typeOptions}
      onCreateStatusOption={onCreateStatusOption}
      onRecolorStatusOption={onRecolorStatusOption}
      onDeleteStatusOption={onDeleteStatusOption}
      onCreatePriorityOption={onCreatePriorityOption}
      onRecolorPriorityOption={onRecolorPriorityOption}
      onDeletePriorityOption={onDeletePriorityOption}
      onCreateTypeOption={onCreateTypeOption}
      onRecolorTypeOption={onRecolorTypeOption}
      onDeleteTypeOption={onDeleteTypeOption}
      onPatch={onPatch}
      onDelete={onDelete}
      onPrev={onPrev}
      onNext={onNext}
    />
  )
}

interface InnerProps {
  isOpen: boolean
  onClose: () => void
  task: TaskPanelTask
  couples?: { id: string; name: string }[]
  groups?: TaskGroup[]
  statusOptions?: TaskOption[]
  priorityOptions?: TaskOption[]
  typeOptions?: TaskOption[]
  onCreateStatusOption?: (input: {
    name: string
    color: TaskOptionColor
  }) => void
  onRecolorStatusOption?: (id: string, color: TaskOptionColor) => void
  onDeleteStatusOption?: (id: string) => void
  onCreatePriorityOption?: (input: {
    name: string
    color: TaskOptionColor
  }) => void
  onRecolorPriorityOption?: (id: string, color: TaskOptionColor) => void
  onDeletePriorityOption?: (id: string) => void
  onCreateTypeOption?: (input: {
    name: string
    color: TaskOptionColor
  }) => void
  onRecolorTypeOption?: (id: string, color: TaskOptionColor) => void
  onDeleteTypeOption?: (id: string) => void
  onPatch: (id: string, patch: TaskFieldUpdate) => void
  onDelete?: (id: string) => void
  onPrev?: () => void
  onNext?: () => void
}

function TaskSidePanelInner({
  isOpen,
  onClose,
  task,
  couples,
  groups,
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
  onPatch,
  onDelete,
  onPrev,
  onNext,
}: InnerProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [coupleId, setCoupleId] = useState<string>(task.related_couple_id ?? '')
  const [groupId, setGroupId] = useState<string>(task.group_id ?? '')
  const [coupleOpen, setCoupleOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  const patch = (p: TaskFieldUpdate) => onPatch(task.id, p)

  const selectedCouple = couples?.find((c) => c.id === coupleId)
  const selectedGroup = groups?.find((g) => g.id === groupId)

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={onClose}
        onPrev={onPrev}
        onNext={onNext}
        footer={
          onDelete ? (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                <Trash2 size={14} strokeWidth={1.5} />
                Delete task
              </button>
            </div>
          ) : null
        }
      >
        <div className="max-w-[640px] mx-auto py-4">
          {/* Title - large, no border, wraps on mobile */}
          <textarea
            ref={titleRef}
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const trimmed = title.trim()
              if (trimmed && trimmed !== task.title) patch({ title: trimmed })
              else if (!trimmed) setTitle(task.title)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLTextAreaElement).blur()
              }
            }}
            className="w-full text-xl sm:text-3xl font-semibold text-gray-900 placeholder:text-gray-300 outline-none bg-transparent mb-6 px-1 resize-none overflow-hidden leading-tight"
            placeholder="Untitled"
            autoFocus={!task.title}
          />

          {/* Property table - Notion-style label/value rows */}
          <div className="space-y-1 mb-6">
            <PropertyRow label="Status">
              <StatusCell
                value={task.status}
                onChange={(v) => patch({ status: v })}
                statusOptions={statusOptions}
                onCreateStatus={onCreateStatusOption}
                onRecolorStatus={onRecolorStatusOption}
                onDeleteStatusOption={onDeleteStatusOption}
              />
            </PropertyRow>

            <PropertyRow label="Due date">
              <DueDateCell value={task.due_date} onChange={(v) => patch({ due_date: v })} />
            </PropertyRow>

            <PropertyRow label="Priority">
              <PriorityCell
                value={task.priority ?? null}
                onChange={(v) => patch({ priority: v })}
                priorityOptions={priorityOptions}
                onCreatePriority={onCreatePriorityOption}
                onRecolorPriority={onRecolorPriorityOption}
                onDeletePriorityOption={onDeletePriorityOption}
              />
            </PropertyRow>

            <PropertyRow label="Task type">
              <TaskTypeCell
                value={task.task_type ?? null}
                onChange={(v) => patch({ task_type: v })}
                typeOptions={typeOptions}
                onCreateType={onCreateTypeOption}
                onRecolorType={onRecolorTypeOption}
                onDeleteTypeOption={onDeleteTypeOption}
              />
            </PropertyRow>

            {groups && groups.length > 0 && (
              <PropertyRow label="Group">
                <Popover.Root open={groupOpen} onOpenChange={setGroupOpen}>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1 -mx-2 rounded hover:bg-gray-50 transition cursor-pointer"
                    >
                      {selectedGroup ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-900">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${TASK_GROUP_DOT_CLASS[selectedGroup.color]}`}
                          />
                          {selectedGroup.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">Empty</span>
                      )}
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      sideOffset={4}
                      align="start"
                      className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[80] w-56 max-h-56 overflow-y-auto"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setGroupId('')
                          setGroupOpen(false)
                          patch({ group_id: null })
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition ${
                          !groupId ? 'bg-gray-50 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        Ungrouped
                      </button>
                      {groups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setGroupId(g.id)
                            setGroupOpen(false)
                            patch({ group_id: g.id })
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs transition flex items-center gap-2 ${
                            groupId === g.id
                              ? 'bg-gray-50 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${TASK_GROUP_DOT_CLASS[g.color]}`} />
                          <span className="truncate">{g.name}</span>
                        </button>
                      ))}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </PropertyRow>
            )}

            {couples && couples.length > 0 && (
              <PropertyRow label="Couple">
                <Popover.Root open={coupleOpen} onOpenChange={setCoupleOpen}>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1 -mx-2 rounded hover:bg-gray-50 transition cursor-pointer"
                    >
                      {selectedCouple ? (
                        <span className="inline-flex items-center text-sm text-gray-900">
                          {selectedCouple.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">Empty</span>
                      )}
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      sideOffset={4}
                      align="start"
                      className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[80] w-56 max-h-56 overflow-y-auto"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCoupleId('')
                          setCoupleOpen(false)
                          patch({ related_couple_id: null })
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition ${
                          !coupleId ? 'bg-gray-50 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        No couple
                      </button>
                      {couples.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCoupleId(c.id)
                            setCoupleOpen(false)
                            patch({ related_couple_id: c.id })
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs truncate transition ${
                            coupleId === c.id
                              ? 'bg-gray-50 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </PropertyRow>
            )}
          </div>

          {/* Notes */}
          <div className="border-t border-gray-100 pt-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                const next = description.trim() || null
                const prev = task.description ?? null
                if (next !== prev) patch({ description: next })
              }}
              className="w-full text-sm text-gray-800 placeholder:text-gray-400 outline-none bg-transparent resize-none px-1"
              placeholder="Add a note, link, or details..."
              rows={8}
            />
          </div>
        </div>
      </SidePanel>

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Task"
        description="Are you sure you want to delete this task? This cannot be undone."
        onConfirm={() => {
          if (task && onDelete) onDelete(task.id)
        }}
        onCancel={() => setDeleteConfirm(false)}
        loading={false}
      />
    </>
  )
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="w-32 shrink-0 text-sm text-gray-400 pt-1">{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
