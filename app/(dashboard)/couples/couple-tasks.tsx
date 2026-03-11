'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface CoupleTasksProps {
  coupleId: string
}

interface Task {
  id: string
  title: string
  due_date: string | null
  status: 'todo' | 'in_progress' | 'done'
}

export function CoupleTasks({ coupleId }: CoupleTasksProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['couple-tasks', coupleId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, status')
        .eq('related_couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      return (data as Task[]) || []
    },
  })

  const updateTask = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status: task.status })
        .eq('id', task.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-tasks', coupleId] })
    },
  })

  const handleToggleTask = (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    updateTask.mutate({ ...task, status: newStatus })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case 'done':
        return 'complete'
      case 'in_progress':
        return 'confirmed'
      default:
        return 'new'
    }
  }

  return (
    <div className="space-y-3">
      {!tasks || tasks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-3">No tasks yet.</p>
          <button className="text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
            + Add Task
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={task.status === 'done'}
                  onChange={() => handleToggleTask(task)}
                  className="w-4 h-4 rounded border-gray-300 text-black focus:ring-green-200"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${
                      task.status === 'done'
                        ? 'text-gray-400 line-through'
                        : 'text-gray-900'
                    }`}
                  >
                    {task.title}
                  </p>
                </div>
                {task.due_date && (
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(task.due_date)}
                  </span>
                )}
                <Badge variant={statusBadgeVariant(task.status) as any}>
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
          <button className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
            + Add Task
          </button>
        </>
      )}
    </div>
  )
}
