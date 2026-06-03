/**
 * React Query hooks for the persisted `task_priorities` /
 * `task_types` option lookups.
 *
 * These tables back the colour-aware Notion-style dropdowns on the
 * `priority` and `task_type` cells. Reads stay on the RLS-scoped
 * client, writes go through the server actions in `./actions.ts` so
 * input validation lives in one place.
 *
 * @module app/(dashboard)/tasks/use-task-options
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { TaskOption, toTaskOptionColor } from '@/types/task';

import {
  createTaskPriorityAction,
  createTaskStatusAction,
  createTaskTypeAction,
  deleteTaskPriorityAction,
  deleteTaskStatusAction,
  deleteTaskTypeAction,
  updateTaskPriorityAction,
  updateTaskStatusAction,
  updateTaskTypeAction,
} from './actions';

const PRIORITIES_KEY = ['task-priorities'] as const;
const STATUSES_KEY = ['task-statuses'] as const;
const TYPES_KEY = ['task-types'] as const;

function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data;
  throw new Error(result.error);
}

/** Coerce a DB row to a strongly-typed `TaskOption`. */
function toOption(row: {
  id: string;
  name: string;
  color: string;
}): TaskOption {
  return {
    id: row.id,
    name: row.name,
    color: toTaskOptionColor(row.color),
  };
}

/* ─── Priorities ──────────────────────────────────────────────── */

export function useTaskPriorities() {
  const supabase = createClient();
  return useQuery({
    queryKey: PRIORITIES_KEY,
    queryFn: async (): Promise<TaskOption[]> => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('task_priorities')
        .select('id, name, color, position')
        .eq('user_id', user.user.id)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toOption);
    },
  });
}

/**
 * Optimistically inserts a temp row into the option cache so any
 * pill resolver (e.g. `resolvePriorityPillClass`) finds the new
 * option's colour the instant Create is clicked — without this the
 * just-created label briefly renders in the fallback grey while the
 * server round-trip + refetch completes. The temp row carries a
 * `temp-` id; `invalidate` swaps it for the real server row.
 */
function buildOptimisticOption(
  name: string,
  color: TaskOption['color'],
): TaskOption {
  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    color,
  };
}

export function useCreateTaskPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: TaskOption['color'] }) =>
      unwrap(
        await createTaskPriorityAction({
          name: input.name,
          color: input.color ?? 'gray',
        }),
      ),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: PRIORITIES_KEY });
      const previous = qc.getQueryData<TaskOption[]>(PRIORITIES_KEY);
      const optimistic = buildOptimisticOption(
        input.name,
        input.color ?? 'gray',
      );
      qc.setQueryData<TaskOption[]>(PRIORITIES_KEY, (old) =>
        old ? [...old, optimistic] : [optimistic],
      );
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(PRIORITIES_KEY, ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRIORITIES_KEY });
    },
  });
}

export function useUpdateTaskPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      color?: TaskOption['color'];
    }) => {
      const patch: { name?: string; color?: TaskOption['color'] } = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.color !== undefined) patch.color = input.color;
      unwrap(await updateTaskPriorityAction({ id: input.id, patch }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRIORITIES_KEY });
      // A rename cascades to tasks server-side, so any visible task
      // list needs to refetch to pick up the new value.
      qc.invalidateQueries({ queryKey: ['all-tasks'] });
      qc.invalidateQueries({ queryKey: ['couple-tasks'] });
      qc.invalidateQueries({ queryKey: ['event-tasks'] });
    },
  });
}

export function useDeleteTaskPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteTaskPriorityAction(id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRIORITIES_KEY });
      qc.invalidateQueries({ queryKey: ['all-tasks'] });
      qc.invalidateQueries({ queryKey: ['couple-tasks'] });
      qc.invalidateQueries({ queryKey: ['event-tasks'] });
    },
  });
}

/* ─── Task types ──────────────────────────────────────────────── */

export function useTaskTypes() {
  const supabase = createClient();
  return useQuery({
    queryKey: TYPES_KEY,
    queryFn: async (): Promise<TaskOption[]> => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('task_types')
        .select('id, name, color, position')
        .eq('user_id', user.user.id)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toOption);
    },
  });
}

export function useCreateTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: TaskOption['color'] }) =>
      unwrap(
        await createTaskTypeAction({
          name: input.name,
          color: input.color ?? 'gray',
        }),
      ),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: TYPES_KEY });
      const previous = qc.getQueryData<TaskOption[]>(TYPES_KEY);
      const optimistic = buildOptimisticOption(
        input.name,
        input.color ?? 'gray',
      );
      qc.setQueryData<TaskOption[]>(TYPES_KEY, (old) =>
        old ? [...old, optimistic] : [optimistic],
      );
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(TYPES_KEY, ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TYPES_KEY });
    },
  });
}

export function useUpdateTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      color?: TaskOption['color'];
    }) => {
      const patch: { name?: string; color?: TaskOption['color'] } = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.color !== undefined) patch.color = input.color;
      unwrap(await updateTaskTypeAction({ id: input.id, patch }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TYPES_KEY });
      qc.invalidateQueries({ queryKey: ['all-tasks'] });
      qc.invalidateQueries({ queryKey: ['couple-tasks'] });
      qc.invalidateQueries({ queryKey: ['event-tasks'] });
    },
  });
}

export function useDeleteTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteTaskTypeAction(id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TYPES_KEY });
      qc.invalidateQueries({ queryKey: ['all-tasks'] });
      qc.invalidateQueries({ queryKey: ['couple-tasks'] });
      qc.invalidateQueries({ queryKey: ['event-tasks'] });
    },
  });
}

/* ─── Statuses ────────────────────────────────────────────────── */

export function useTaskStatuses() {
  const supabase = createClient();
  return useQuery({
    queryKey: STATUSES_KEY,
    queryFn: async (): Promise<TaskOption[]> => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('task_statuses')
        .select('id, name, color, position')
        .eq('user_id', user.user.id)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toOption);
    },
  });
}

export function useCreateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: TaskOption['color'] }) =>
      unwrap(
        await createTaskStatusAction({
          name: input.name,
          color: input.color ?? 'gray',
        }),
      ),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: STATUSES_KEY });
      const previous = qc.getQueryData<TaskOption[]>(STATUSES_KEY);
      const optimistic = buildOptimisticOption(
        input.name,
        input.color ?? 'gray',
      );
      qc.setQueryData<TaskOption[]>(STATUSES_KEY, (old) =>
        old ? [...old, optimistic] : [optimistic],
      );
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(STATUSES_KEY, ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STATUSES_KEY });
    },
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      color?: TaskOption['color'];
    }) => {
      const patch: { name?: string; color?: TaskOption['color'] } = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.color !== undefined) patch.color = input.color;
      unwrap(await updateTaskStatusAction({ id: input.id, patch }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STATUSES_KEY });
      qc.invalidateQueries({ queryKey: ['all-tasks'] });
      qc.invalidateQueries({ queryKey: ['couple-tasks'] });
      qc.invalidateQueries({ queryKey: ['event-tasks'] });
    },
  });
}

export function useDeleteTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteTaskStatusAction(id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STATUSES_KEY });
      qc.invalidateQueries({ queryKey: ['all-tasks'] });
      qc.invalidateQueries({ queryKey: ['couple-tasks'] });
      qc.invalidateQueries({ queryKey: ['event-tasks'] });
    },
  });
}
