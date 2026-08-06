/**
 * Per-couple Tasks tab inside the Couple Profile.
 *
 * Reads via React Query against `tasks` (RLS scopes to the
 * authenticated user). Writes go through the server actions in
 * `./actions.ts` — the component is pure composition + the hook
 * preserves optimistic cache updates.
 *
 * Reuses the standalone Tasks page's row + side-panel + column
 * header so visuals stay consistent.
 *
 * @module app/(dashboard)/couples/couple-tasks
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListTodo, Plus } from 'lucide-react';
import { useState } from 'react';

import { ColumnHeader } from '@/app/(dashboard)/tasks/group-section';
import { TaskRow, TaskRowTask } from '@/app/(dashboard)/tasks/task-row';
import {
  TaskFieldUpdate,
  TaskSidePanel,
} from '@/app/(dashboard)/tasks/task-side-panel';
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
} from '@/app/(dashboard)/tasks/use-task-options';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { isPastDue } from '@/lib/utils';
import { TaskPriority } from '@/types/task';

import {
  createCoupleTaskAction,
  deleteCoupleTaskAction,
  updateCoupleTaskAction,
} from './actions';
import { CoupleTabEmpty, CoupleTabShell, type TabStat } from './couple-tab-shell';

interface CoupleTasksProps {
  coupleId: string;
}

interface Task extends TaskRowTask {
  position: number;
}

/** Throw on `ok: false` so React Query treats it as an error and
 *  the optimistic update can roll back if we add one later. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data;
  throw new Error(result.error);
}

export function CoupleTasks({ coupleId }: CoupleTasksProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Persisted status + priority + task_type option lists. The
  // dropdowns on those cells read from these so custom options survive
  // even when no task currently references them, and each option
  // carries a stable colour.
  const { data: statusOptions = [] } = useTaskStatuses();
  const { data: priorityOptions = [] } = useTaskPriorities();
  const { data: typeOptions = [] } = useTaskTypes();
  const createStatusOption = useCreateTaskStatus();
  const updateStatusOption = useUpdateTaskStatus();
  const deleteStatusOption = useDeleteTaskStatus();
  const createPriorityOption = useCreateTaskPriority();
  const updatePriorityOption = useUpdateTaskPriority();
  const deletePriorityOption = useDeleteTaskPriority();
  const createTypeOption = useCreateTaskType();
  const updateTypeOption = useUpdateTaskType();
  const deleteTypeOption = useDeleteTaskType();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['couple-tasks', coupleId],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, due_date, description, status, related_couple_id, group_id, position, priority, task_type',
        )
        .eq('related_couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data as Task[]) || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['couple-tasks', coupleId] });
    queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
  };

  /**
   * Optimistic patch. The cache is updated **before** the server call
   * so cell edits (status pill, due date, priority, title, etc.) feel
   * instant — Notion-style. We snapshot the prior list so we can put
   * the row back the way it was if the server rejects the update.
   * `invalidate()` on success re-syncs from the server (a no-op since
   * the optimistic value already matches what the server wrote, but
   * keeps any server-side derived fields fresh).
   */
  const patchTask = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: TaskFieldUpdate;
    }) => {
      unwrap(await updateCoupleTaskAction({ id, patch }));
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({
        queryKey: ['couple-tasks', coupleId],
      });
      const previous = queryClient.getQueryData<Task[]>([
        'couple-tasks',
        coupleId,
      ]);
      queryClient.setQueryData<Task[]>(
        ['couple-tasks', coupleId],
        (old) => old?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData<Task[]>(
          ['couple-tasks', coupleId],
          ctx.previous,
        );
      }
    },
    onSuccess: invalidate,
  });

  /**
   * Insert with an optimistic row using a **client-generated UUID**
   * (the same id is passed through to the server insert) so the new
   * row is immediately editable: any `patchTask` fired by a cell edit
   * targets a real UUID that satisfies Zod's validation, even before
   * the server insert resolves. On error we roll back by filtering
   * the same id out.
   */
  const insertTask = useMutation({
    mutationFn: async (input: { id: string; title: string }) => {
      unwrap(
        await createCoupleTaskAction({
          id: input.id,
          coupleId,
          title: input.title,
        }),
      );
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: ['couple-tasks', coupleId],
      });
      const optimistic: Task = {
        id: input.id,
        title: input.title,
        due_date: null,
        description: null,
        status: 'todo',
        related_couple_id: coupleId,
        group_id: null,
        position: Number.MAX_SAFE_INTEGER,
        priority: null,
        task_type: null,
      };
      queryClient.setQueryData<Task[]>(
        ['couple-tasks', coupleId],
        (old) => (old ? [...old, optimistic] : [optimistic]),
      );
      return { id: input.id };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.id) {
        queryClient.setQueryData<Task[]>(
          ['couple-tasks', coupleId],
          (old) => old?.filter((t) => t.id !== ctx.id),
        );
      }
    },
    onSuccess: invalidate,
  });

  /**
   * Delete with an optimistic remove so the row disappears
   * instantly. We snapshot the prior list so the row can be put back
   * exactly where it was if the server rejects the delete.
   */
  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteCoupleTaskAction(id));
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ['couple-tasks', coupleId],
      });
      const previous = queryClient.getQueryData<Task[]>([
        'couple-tasks',
        coupleId,
      ]);
      queryClient.setQueryData<Task[]>(
        ['couple-tasks', coupleId],
        (old) => old?.filter((t) => t.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData<Task[]>(
          ['couple-tasks', coupleId],
          ctx.previous,
        );
      }
    },
    onSuccess: invalidate,
  });

  const editingTask = (tasks || []).find((t) => t.id === editingTaskId);
  const all = tasks || [];

  const addTask = () =>
    insertTask.mutate({ id: crypto.randomUUID(), title: 'Untitled task' });

  // "Open" = anything not in the canonical done status (custom statuses count
  // as open). See TaskStatus in types/task.ts.
  const openCount = all.filter((t) => t.status !== 'done').length;
  const doneCount = all.length - openCount;
  // Overdue = a still-open task whose due date has passed.
  const overdueCount = all.filter(
    (t) => t.status !== 'done' && isPastDue(t.due_date),
  ).length;
  const stats: TabStat[] = [{ label: `${all.length} total` }];
  if (doneCount > 0) stats.push({ label: `${doneCount} done`, tone: 'success' });
  if (openCount > 0) stats.push({ label: `${openCount} open` });
  if (overdueCount > 0) stats.push({ label: `${overdueCount} overdue`, tone: 'danger' });

  return (
    <CoupleTabShell
      title="Tasks"
      stats={all.length > 0 ? stats : undefined}
      actions={
        <Button size="sm" onClick={addTask} className="cursor-pointer gap-1.5">
          <Plus size={14} strokeWidth={1.5} />
          New task
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-2" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 bg-gray-100 rounded-control animate-pulse" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <CoupleTabEmpty
          icon={ListTodo}
          title="No tasks yet"
          description="Add a task with the button above and it will show up here."
        />
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
              onCommitTitle={(title) =>
                patchTask.mutate({ id: t.id, patch: { title } })
              }
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
            onClick={addTask}
            className="w-full flex items-center gap-2 pl-3.5 pr-2 py-2 text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer"
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
          deleteTask.mutate(id);
          setEditingTaskId(null);
        }}
      />
    </CoupleTabShell>
  );
}
