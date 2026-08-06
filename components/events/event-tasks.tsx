'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { ColumnHeader } from '@/app/(dashboard)/tasks/group-section'
import { TaskRow, TaskRowTask } from '@/app/(dashboard)/tasks/task-row'
import { TaskSidePanel, TaskFieldUpdate } from '@/app/(dashboard)/tasks/task-side-panel'
import {
  useCreateTaskPriority,
  useCreateTaskStatus,
  useCreateTaskType,
  useDeleteTaskPriority,
  useDeleteTaskStatus,
  useDeleteTaskType,
  useTaskPriorities,
  useTaskStatuses,
  useTaskTypes,
  useUpdateTaskPriority,
  useUpdateTaskStatus,
  useUpdateTaskType,
} from '@/app/(dashboard)/tasks/use-task-options'
import {
  createEventTaskAction,
  deleteEventTaskAction,
  updateEventTaskAction,
} from '@/lib/events/actions'
import { createClient } from '@/lib/supabase/client'
import { TaskPriority } from '@/types/task'

/** Throw on `ok: false` so React Query treats it as an error. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data
  throw new Error(result.error)
}

interface EventTasksProps {
  eventId: string
}

interface Task extends TaskRowTask {
  position: number
}

export function EventTasks({ eventId }: EventTasksProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  // See couple-tasks for the rationale on why these option lists live
  // in their own tables rather than being derived from currently-loaded
  // task rows.
  const { data: statusOptions = [] } = useTaskStatuses()
  const { data: priorityOptions = [] } = useTaskPriorities()
  const { data: typeOptions = [] } = useTaskTypes()
  const createStatusOption = useCreateTaskStatus()
  const updateStatusOption = useUpdateTaskStatus()
  const deleteStatusOption = useDeleteTaskStatus()
  const createPriorityOption = useCreateTaskPriority()
  const updatePriorityOption = useUpdateTaskPriority()
  const deletePriorityOption = useDeleteTaskPriority()
  const createTypeOption = useCreateTaskType()
  const updateTypeOption = useUpdateTaskType()
  const deleteTypeOption = useDeleteTaskType()

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['event-tasks', eventId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, due_date, description, status, related_couple_id, group_id, position, priority, task_type'
        )
        .eq('related_event_id', eventId)
        .eq('user_id', user.user.id)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data as Task[]) || []
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event-tasks', eventId] })
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
  }

  /**
   * Optimistic patch. The cache is updated **before** the server call
   * so cell edits feel instant (Notion-style). On error we restore
   * the snapshotted list so a rejected update visibly reverts.
   * `invalidate()` on success re-syncs against the server.
   */
  const patchTask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskFieldUpdate }) => {
      unwrap(await updateEventTaskAction({ id, patch }))
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['event-tasks', eventId] })
      const previous = queryClient.getQueryData<Task[]>([
        'event-tasks',
        eventId,
      ])
      queryClient.setQueryData<Task[]>(['event-tasks', eventId], (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData<Task[]>(
          ['event-tasks', eventId],
          ctx.previous,
        )
      }
    },
    onSuccess: invalidate,
  })

  /**
   * Insert with an optimistic row using a **client-generated UUID**
   * (passed through to the server insert) so the new row is editable
   * the instant it renders — cell edits fire `patchTask` against a
   * real UUID that satisfies Zod, rather than failing on a `temp-`
   * placeholder. See `couple-tasks.tsx` for the matching pattern.
   */
  const insertTask = useMutation({
    mutationFn: async (input: { id: string; title: string }) => {
      unwrap(
        await createEventTaskAction({
          id: input.id,
          eventId,
          title: input.title,
        }),
      )
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['event-tasks', eventId] })
      const optimistic: Task = {
        id: input.id,
        title: input.title,
        due_date: null,
        description: null,
        status: 'todo',
        related_couple_id: null,
        group_id: null,
        position: Number.MAX_SAFE_INTEGER,
        priority: null,
        task_type: null,
      }
      queryClient.setQueryData<Task[]>(['event-tasks', eventId], (old) =>
        old ? [...old, optimistic] : [optimistic],
      )
      return { id: input.id }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.id) {
        queryClient.setQueryData<Task[]>(['event-tasks', eventId], (old) =>
          old?.filter((t) => t.id !== ctx.id),
        )
      }
    },
    onSuccess: invalidate,
  })

  /**
   * Delete with an optimistic remove so the row vanishes instantly.
   * We snapshot the prior list so we can restore the row at its
   * original index if the server rejects the delete.
   */
  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteEventTaskAction(id))
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['event-tasks', eventId] })
      const previous = queryClient.getQueryData<Task[]>([
        'event-tasks',
        eventId,
      ])
      queryClient.setQueryData<Task[]>(['event-tasks', eventId], (old) =>
        old?.filter((t) => t.id !== id),
      )
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData<Task[]>(
          ['event-tasks', eventId],
          ctx.previous,
        )
      }
    },
    onSuccess: invalidate,
  })

  const editingTask = (tasks || []).find((t) => t.id === editingTaskId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-surface-emphasis rounded-control animate-pulse" />
        ))}
      </div>
    )
  }

  const all = tasks || []

  return (
    <>
      {all.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-body text-text-subtle mb-3">No tasks yet.</p>
          <button
            onClick={() => insertTask.mutate({ id: crypto.randomUUID(), title: 'Untitled task' })}
            className="text-caption text-text-muted border border-border rounded-control px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
          >
            + Add task
          </button>
        </div>
      ) : (
        <div>
          <ColumnHeader
            columns={['status', 'due_date', 'priority', 'task_type']}
            hideGutter
          />
          {all.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              hideGutter
              statusOptions={statusOptions}
              priorityOptions={priorityOptions}
              typeOptions={typeOptions}
              showCouple={false}
              onCommitTitle={(title) => patchTask.mutate({ id: t.id, patch: { title } })}
              onChangeStatus={(status) =>
                patchTask.mutate({ id: t.id, patch: { status } })
              }
              onChangeDueDate={(due_date) =>
                patchTask.mutate({ id: t.id, patch: { due_date } })
              }
              onChangePriority={(priority: TaskPriority | null) =>
                patchTask.mutate({ id: t.id, patch: { priority } })
              }
              onChangeTaskType={(task_type) =>
                patchTask.mutate({ id: t.id, patch: { task_type } })
              }
              onCreateStatusOption={(input) =>
                createStatusOption.mutate(input)
              }
              onRecolorStatusOption={(id, color) =>
                updateStatusOption.mutate({ id, color })
              }
              onDeleteStatusOption={(id) => deleteStatusOption.mutate(id)}
              onCreatePriorityOption={(input) =>
                createPriorityOption.mutate(input)
              }
              onRecolorPriorityOption={(id, color) =>
                updatePriorityOption.mutate({ id, color })
              }
              onDeletePriorityOption={(id) =>
                deletePriorityOption.mutate(id)
              }
              onCreateTypeOption={(input) => createTypeOption.mutate(input)}
              onRecolorTypeOption={(id, color) =>
                updateTypeOption.mutate({ id, color })
              }
              onDeleteTypeOption={(id) => deleteTypeOption.mutate(id)}
              onOpen={() => setEditingTaskId(t.id)}
            />
          ))}
          <button
            onClick={() => insertTask.mutate({ id: crypto.randomUUID(), title: 'Untitled task' })}
            className="w-full flex items-center gap-2 pl-3.5 pr-2 py-2 text-body text-text-subtle hover:text-gray-600 transition cursor-pointer"
          >
            <Plus size={13} strokeWidth={1.5} />
            New task
          </button>
        </div>
      )}

      <TaskSidePanel
        isOpen={!!editingTask}
        onClose={() => setEditingTaskId(null)}
        task={editingTask}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        typeOptions={typeOptions}
        onCreateStatusOption={(input) => createStatusOption.mutate(input)}
        onRecolorStatusOption={(id, color) =>
          updateStatusOption.mutate({ id, color })
        }
        onDeleteStatusOption={(id) => deleteStatusOption.mutate(id)}
        onCreatePriorityOption={(input) =>
          createPriorityOption.mutate(input)
        }
        onRecolorPriorityOption={(id, color) =>
          updatePriorityOption.mutate({ id, color })
        }
        onDeletePriorityOption={(id) => deletePriorityOption.mutate(id)}
        onCreateTypeOption={(input) => createTypeOption.mutate(input)}
        onRecolorTypeOption={(id, color) =>
          updateTypeOption.mutate({ id, color })
        }
        onDeleteTypeOption={(id) => deleteTypeOption.mutate(id)}
        onPatch={(id, patch) => patchTask.mutate({ id, patch })}
        onDelete={(id) => {
          deleteTask.mutate(id)
          setEditingTaskId(null)
        }}
      />
    </>
  )
}
