import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: TaskGroupColor }) => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");
      const { data: existing } = await supabase
        .from("task_groups")
        .select("position")
        .eq("user_id", user.user.id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = existing && existing.length > 0 ? (existing[0].position ?? 0) + 1 : 0;
      const { data, error } = await supabase
        .from("task_groups")
        .insert({
          name: input.name,
          color: input.color ?? "gray",
          position: nextPosition,
          user_id: user.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TaskGroup;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateTaskGroup() {
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; color?: TaskGroupColor }) => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.color !== undefined) patch.color = input.color;
      const { error } = await supabase.from("task_groups").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useReorderTaskGroups() {
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from("task_groups")
          .update({ position: i })
          .eq("id", orderedIds[i]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteTaskGroup() {
  const supabase = createClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}
