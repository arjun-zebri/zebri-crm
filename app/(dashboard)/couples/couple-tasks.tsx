'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ColumnHeader } from '@/app/(dashboard)/tasks/group-section'
import { TaskRow, TaskRowTask } from '@/app/(dashboard)/tasks/task-row'
import { TaskSidePanel, TaskFieldUpdate } from '@/app/(dashboard)/tasks/task-side-panel'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { TaskPriority, STATUS_ORDER } from '@/types/task'

interface CoupleTasksProps {
  coupleId: string
}

interface Task extends TaskRowTask {
  position: number
}

export function CoupleTasks({ coupleId }: CoupleTasksProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['couple-tasks', coupleId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, due_date, description, status, related_couple_id, group_id, position, priority, task_type'
        )
        .eq('related_couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data as Task[]) || []
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['couple-tasks', coupleId] })
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
  }

  const patchTask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskFieldUpdate }) => {
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const insertTask = useMutation({
    mutationFn: async (input: { title: string }) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('tasks').insert({
        title: input.title,
        status: 'todo',
        user_id: user.user.id,
        related_couple_id: coupleId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast('Task added')
    },
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast('Task deleted')
    },
  })

  const knownTypes = useMemo(() => {
    const set = new Set<string>()
    for (const t of tasks || []) if (t.task_type) set.add(t.task_type)
    return [...set].sort()
  }, [tasks])

  const knownStatuses = useMemo(() => {
    const custom = new Set<string>()
    const base = new Set(STATUS_ORDER as string[])
    for (const t of tasks ?? []) {
      if (t.status && !base.has(t.status)) custom.add(t.status)
    }
    return [...(STATUS_ORDER as string[]), ...custom]
  }, [tasks])

  const editingTask = (tasks || []).find((t) => t.id === editingTaskId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  const all = tasks || []

  return (
    <>
      {all.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400 mb-3">No tasks yet.</p>
          <button
            onClick={() => insertTask.mutate({ title: 'Untitled task' })}
            className="text-xs text-gray-500 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
          >
            + Add task
          </button>
        </div>
      ) : (
        <div>
          <ColumnHeader columns={['status', 'due_date', 'priority', 'task_type']} />
          {all.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              knownTypes={knownTypes}
              knownStatuses={knownStatuses}
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
              onOpen={() => setEditingTaskId(t.id)}
            />
          ))}
          <button
            onClick={() => insertTask.mutate({ title: 'Untitled task' })}
            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer"
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
        knownTypes={knownTypes}
        knownStatuses={knownStatuses}
        onPatch={(id, patch) => patchTask.mutate({ id, patch })}
        onDelete={(id) => {
          deleteTask.mutate(id)
          setEditingTaskId(null)
        }}
      />
    </>
  )
}
