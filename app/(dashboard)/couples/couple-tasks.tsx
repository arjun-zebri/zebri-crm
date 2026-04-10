'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { CheckSquare, Circle } from 'lucide-react'
import { TaskModal, TaskFormData } from '@/app/(dashboard)/tasks/task-modal'

interface CoupleTasksProps {
  coupleId: string
}

interface Task {
  id: string
  title: string
  due_date: string | null
  description?: string | null
  status: 'todo' | 'in_progress' | 'done'
}

function groupTasks(tasks: Task[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue: Task[] = []
  const todayTasks: Task[] = []
  const upcoming: Task[] = []
  const done: Task[] = []

  for (const task of tasks) {
    if (task.status === 'done') { done.push(task); continue }
    if (!task.due_date) { upcoming.push(task); continue }
    const due = new Date(task.due_date + 'T00:00:00')
    due.setHours(0, 0, 0, 0)
    const diff = due.getTime() - today.getTime()
    if (diff < 0) overdue.push(task)
    else if (diff === 0) todayTasks.push(task)
    else upcoming.push(task)
  }
  return { overdue, today: todayTasks, upcoming, done }
}

function TaskRow({
  task,
  onToggle,
  onClick,
  overdue = false,
}: {
  task: Task
  onToggle: () => void
  onClick: () => void
  overdue?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-1 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer rounded-sm ${
        ''
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className="shrink-0 text-gray-300 hover:text-gray-600 transition cursor-pointer"
        title={task.status === 'done' ? 'Mark as outstanding' : 'Mark as done'}
      >
        {task.status === 'done' ? (
          <CheckSquare size={15} strokeWidth={1.5} className="text-emerald-400" />
        ) : (
          <Circle size={15} strokeWidth={1.5} />
        )}
      </button>
      <p className={`flex-1 text-sm min-w-0 truncate ${task.status === 'done' ? 'text-gray-300 line-through' : 'text-gray-800'}`}>
        {task.title}
      </p>
      {task.due_date && (
        <span className={`text-xs shrink-0 text-gray-400`}>
          {formatRelativeDate(task.due_date)}
        </span>
      )}
    </div>
  )
}

function SectionGroup({
  label,
  tasks,
  onToggle,
  onTaskClick,
  overdue = false,
}: {
  label: string
  tasks: Task[]
  onToggle: (id: string, status: string) => void
  onTaskClick: (task: Task) => void
  overdue?: boolean
}) {
  if (tasks.length === 0) return null
  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 px-1">{label}</p>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggle={() => onToggle(task.id, task.status)}
          onClick={() => onTaskClick(task)}
          overdue={overdue}
        />
      ))}
    </div>
  )
}

export function CoupleTasks({ coupleId }: CoupleTasksProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['couple-tasks', coupleId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, description, status')
        .eq('related_couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      return (data as Task[]) || []
    },
  })

  const toggleTask = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'done' ? 'todo' : 'done'
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-tasks', coupleId] })
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
    },
  })

  const saveTask = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      if (data.id) {
        const { error } = await supabase
          .from('tasks')
          .update({ title: data.title, due_date: data.due_date, description: data.description })
          .eq('id', data.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tasks').insert({
          title: data.title,
          due_date: data.due_date,
          description: data.description,
          status: 'todo',
          user_id: user.user.id,
          related_couple_id: coupleId,
        })
        if (error) throw error
      }
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['couple-tasks', coupleId] })
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
      toast(data.id ? 'Task updated' : 'Task added')
      setTaskModalOpen(false)
      setEditingTask(undefined)
    },
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-tasks', coupleId] })
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] })
      toast('Task deleted')
      setTaskModalOpen(false)
      setEditingTask(undefined)
    },
  })

  const openModal = (task?: Task) => {
    setEditingTask(task)
    setTaskModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  const allTasks = tasks || []
  const groups = groupTasks(allTasks)

  return (
    <>
      {allTasks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400 mb-3">No tasks yet.</p>
          <button
            onClick={() => openModal()}
            className="text-xs text-gray-500 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer"
          >
            + Add task
          </button>
        </div>
      ) : (
        <div>
          <SectionGroup
            label="Overdue"
            tasks={groups.overdue}
            onToggle={(id, status) => toggleTask.mutate({ id, currentStatus: status })}
            onTaskClick={openModal}
            overdue
          />
          <SectionGroup
            label="Today"
            tasks={groups.today}
            onToggle={(id, status) => toggleTask.mutate({ id, currentStatus: status })}
            onTaskClick={openModal}
          />
          <SectionGroup
            label="Upcoming"
            tasks={groups.upcoming}
            onToggle={(id, status) => toggleTask.mutate({ id, currentStatus: status })}
            onTaskClick={openModal}
          />
          <SectionGroup
            label="Done"
            tasks={groups.done}
            onToggle={(id, status) => toggleTask.mutate({ id, currentStatus: status })}
            onTaskClick={openModal}
          />
          <button
            onClick={() => openModal()}
            className="mt-2 text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            + Add task
          </button>
        </div>
      )}

      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setEditingTask(undefined) }}
        onSave={(data) => saveTask.mutate(data)}
        onDelete={(id) => deleteTask.mutate(id)}
        task={editingTask}
        loading={saveTask.isPending || deleteTask.isPending}
      />
    </>
  )
}
