/**
 * React Query hooks for the task-groups surface.
 *
 * Reads stay on the RLS-scoped client. Mutations are thin wrappers
 * around the server actions in `./actions.ts` — the hook keeps the
 * cache invalidation; the action does the validated DB write.
 *
 * @module app/(dashboard)/tasks/use-task-groups
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

import {
  createTaskGroupAction,
  deleteTaskGroupAction,
  reorderTaskGroupsAction,
  updateTaskGroupAction,
} from "./actions";

export type TaskGroupColor = "gray" | "green" | "blue" | "amber" | "red" | "purple";

export const TASK_GROUP_COLORS: TaskGroupColor[] = [
  "gray",
  "green",
  "blue",
  "amber",
  "red",
  "purple",
];

export const TASK_GROUP_DOT_CLASS: Record<TaskGroupColor, string> = {
  gray: "bg-gray-300",
  green: "bg-emerald-400",
  blue: "bg-blue-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  purple: "bg-purple-400",
};

export interface TaskGroup {
  id: string;
  user_id: string;
  name: string;
  color: TaskGroupColor;
  position: number;
  created_at: string;
}

const QUERY_KEY = ["task-groups"] as const;

/** Throw on `ok: false` so React Query treats it as an error. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data;
  throw new Error(result.error);
}

export function useTaskGroups() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<TaskGroup[]> => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("task_groups")
        .select("id, user_id, name, color, position, created_at")
        .eq("user_id", user.user.id)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as TaskGroup[];
    },
  });
}

export function useCreateTaskGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: TaskGroupColor }) =>
      unwrap(
        await createTaskGroupAction({
          name: input.name,
          color: input.color ?? "gray",
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateTaskGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; color?: TaskGroupColor }) => {
      const patch: { name?: string; color?: TaskGroupColor } = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.color !== undefined) patch.color = input.color;
      unwrap(await updateTaskGroupAction({ id: input.id, patch }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useReorderTaskGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      unwrap(await reorderTaskGroupsAction(orderedIds));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteTaskGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteTaskGroupAction(id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}
