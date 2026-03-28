'use client'

import { Loader2 } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'

interface DashboardTask {
  id: string
  title: string
  due_date: string | null
  status: 'todo' | 'in_progress' | 'done'
  related_couple_id: string | null
  couple?: { id: string; name: string } | null
}

interface DashboardTasksProps {
  tasks: DashboardTask[]
  isLoading: boolean
  onCoupleClick: (couple: { id: string; name: string }) => void
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + 'T00:00:00') < today
}

export function DashboardTasks({ tasks, isLoading, onCoupleClick }: DashboardTasksProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Outstanding Tasks</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" strokeWidth={1.5} />
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Outstanding Tasks</h2>
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">All caught up.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 shrink-0">Outstanding Tasks</h2>
      <div className="space-y-1 flex-1 max-h-60 overflow-y-auto pr-1">
        {tasks.map((task) => {
          const overdue = isOverdue(task.due_date)
          const clickable = !!task.couple
          return (
            <div
              key={task.id}
              onClick={() => { if (task.couple) onCoupleClick(task.couple) }}
              className={`flex items-center gap-3 py-2 transition text-sm ${
                clickable ? 'cursor-pointer group' : 'cursor-default'
              }`}
            >
              <span className={`truncate flex-1 transition ${clickable ? 'text-gray-900 group-hover:text-black group-hover:underline underline-offset-2 decoration-gray-300' : 'text-gray-900'}`}>{task.title}</span>
              {task.couple && (
                <span className="text-gray-400 text-xs shrink-0 truncate max-w-[120px]">
                  {task.couple.name}
                </span>
              )}
              {task.due_date && (
                <span className={`text-xs shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                  {formatRelativeDate(task.due_date)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
