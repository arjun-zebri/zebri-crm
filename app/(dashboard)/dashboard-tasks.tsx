'use client';

import { Card } from '@/components/ui/card';
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
      <Card>
        <h2 className="text-base sm:text-section font-semibold text-text mb-4">Outstanding Tasks</h2>
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-2 py-2">
              <div className="flex-1 min-w-0">
                <div className="h-3.5 bg-surface-emphasis rounded-control w-40 mb-1.5" />
                <div className="h-3 bg-surface-emphasis rounded-control w-24" />
              </div>
              <div className="h-3 bg-surface-emphasis rounded-control w-12 shrink-0" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <h2 className="text-base sm:text-section font-semibold text-text mb-4">Outstanding Tasks</h2>
        <div className="text-center py-12">
          <p className="text-text-muted text-body">All caught up.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <h2 className="text-base sm:text-section font-semibold text-text mb-4 shrink-0">
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
                <span className="truncate block text-caption sm:text-body text-text transition-opacity group-hover:opacity-80">
                  {task.title}
                </span>
                {task.couple && (
                  <span className="text-text-subtle text-caption truncate block">{task.couple.name}</span>
                )}
              </div>
              {task.due_date && (
                <span
                  className={`text-caption shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-text-muted'}`}
                >
                  {formatRelativeDate(task.due_date)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
