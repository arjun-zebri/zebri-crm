'use client';

import { Loader2 } from 'lucide-react';
import { formatRelativeDate, isPastDue } from '@/lib/utils';

interface DashboardTask {
  id: string;
  title: string;
  due_date: string | null;
  status: 'todo' | 'in_progress' | 'done';
  related_couple_id: string | null;
  couple?: { id: string; name: string } | null;
}

interface DashboardTasksProps {
  tasks: DashboardTask[];
  isLoading: boolean;
  onCoupleClick: (couple: { id: string; name: string }) => void;
}

const isOverdue = isPastDue;

export function DashboardTasks({ tasks, isLoading, onCoupleClick }: DashboardTasksProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-4">Outstanding Tasks</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" strokeWidth={1.5} />
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-4">Outstanding Tasks</h2>
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">All caught up.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
      <h2 className="text-base sm:text-xl font-semibold text-gray-900 mb-4 shrink-0">
        Outstanding Tasks
      </h2>
      <div className="space-y-1 flex-1 max-h-60 overflow-y-auto scrollbar-hover pr-1">
        {tasks.map((task) => {
          const overdue = isOverdue(task.due_date);
          return (
            <div
              key={task.id}
              onClick={() => {
                if (task.couple) onCoupleClick(task.couple);
              }}
              className="flex items-center gap-2 py-2 transition cursor-pointer group"
            >
              <div className="flex-1 min-w-0">
                <span className="truncate block text-xs sm:text-sm text-gray-900 transition-opacity group-hover:opacity-80">
                  {task.title}
                </span>
                {task.couple && (
                  <span className="text-gray-400 text-xs truncate block">{task.couple.name}</span>
                )}
              </div>
              {task.due_date && (
                <span
                  className={`text-xs shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}
                >
                  {formatRelativeDate(task.due_date)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
