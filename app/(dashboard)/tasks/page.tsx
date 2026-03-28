"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { useCouples } from "@/app/(dashboard)/couples/use-couples";
import { useCoupleStatuses } from "@/app/(dashboard)/couples/use-couple-statuses";
import { useUpdateCouple, useDeleteCouple } from "@/app/(dashboard)/couples/use-couples";
import { CoupleProfile } from "@/app/(dashboard)/couples/couple-profile";
import { CoupleModal } from "@/app/(dashboard)/couples/couple-modal";
import { useToast } from "@/components/ui/toast";
import { Couple } from "@/app/(dashboard)/couples/couples-types";
import { CheckSquare, Circle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  status: "todo" | "in_progress" | "done";
  related_couple_id: string | null;
  couple?: { id: string; name: string } | null;
}

type FilterStatus = "all" | "todo" | "done";

export default function TasksPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { data: couples } = useCouples();
  const { data: statuses } = useCoupleStatuses();
  const updateCouple = useUpdateCouple();
  const deleteCouple = useDeleteCouple();
  const { toast } = useToast();

  const [filter, setFilter] = useState<FilterStatus>("todo");
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCouple, setEditingCouple] = useState<Couple | undefined>();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, status, related_couple_id, couples(id, name)")
        .eq("user_id", user.user.id)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return ((data || []) as any[]).map((t) => ({
        ...t,
        couple: t.couples ?? null,
      })) as Task[];
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "done" ? "todo" : "done";
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });

  const handleSelectCouple = (coupleId: string) => {
    const couple = couples.find((c) => c.id === coupleId);
    if (couple) setSelectedCouple(couple);
  };

  const handleSaveCouple = async (
    data: Omit<Couple, "id" | "user_id" | "created_at"> & { id?: string }
  ) => {
    if (data.id && editingCouple) {
      const updated = { ...editingCouple, ...data };
      await updateCouple.mutateAsync(updated);
      if (selectedCouple?.id === data.id) setSelectedCouple(updated);
      toast("Couple updated");
    }
    setModalOpen(false);
    setEditingCouple(undefined);
  };

  const handleDeleteCouple = async (id: string) => {
    await deleteCouple.mutateAsync(id);
    setModalOpen(false);
    setEditingCouple(undefined);
    if (selectedCouple?.id === id) setSelectedCouple(null);
    toast("Couple deleted");
  };

  const filtered = (tasks || []).filter((t) => {
    if (filter === "all") return true;
    if (filter === "todo") return t.status !== "done";
    return t.status === "done";
  });

  const todoCounts = {
    all: (tasks || []).length,
    todo: (tasks || []).filter((t) => t.status !== "done").length,
    done: (tasks || []).filter((t) => t.status === "done").length,
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === "done") return false;
    return new Date(task.due_date) < new Date(new Date().toDateString());
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-6 flex-shrink-0">
        <div className="flex items-baseline gap-3 mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Tasks</h1>
          <span className="text-sm text-gray-400">{todoCounts.todo} outstanding</span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {(["todo", "all", "done"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg transition cursor-pointer font-medium ${
                filter === f
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f === "todo" ? "Outstanding" : f === "done" ? "Done" : "All"}
              <span className="ml-1.5 text-xs text-gray-400">{todoCounts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare size={40} strokeWidth={1} className="text-gray-200 mb-3" />
            <p className="text-gray-500 text-sm">
              {filter === "todo" ? "No outstanding tasks." : filter === "done" ? "No completed tasks yet." : "No tasks yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((task) => {
              const overdue = isOverdue(task);
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition group"
                >
                  <button
                    onClick={() => toggleTask.mutate({ id: task.id, currentStatus: task.status })}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition cursor-pointer"
                    title={task.status === "done" ? "Mark as outstanding" : "Mark as done"}
                  >
                    {task.status === "done" ? (
                      <CheckSquare size={16} strokeWidth={1.5} className="text-emerald-500" />
                    ) : (
                      <Circle size={16} strokeWidth={1.5} />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        task.status === "done"
                          ? "text-gray-400 line-through"
                          : "text-gray-900"
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.couple && (
                      <button
                        onClick={() => handleSelectCouple(task.couple!.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
                      >
                        {task.couple.name}
                      </button>
                    )}
                  </div>

                  {task.due_date && (
                    <span
                      className={`text-xs flex-shrink-0 ${
                        overdue ? "text-red-500 font-medium" : "text-gray-400"
                      }`}
                    >
                      {overdue ? "Overdue · " : ""}{formatDate(task.due_date)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CoupleProfile
        couple={selectedCouple}
        onClose={() => setSelectedCouple(null)}
        defaultTab="tasks"
        onSave={() => {}}
        onDelete={() => {}}
        loading={false}
      />

      <CoupleModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCouple(undefined);
        }}
        onSave={handleSaveCouple}
        onDelete={handleDeleteCouple}
        couple={editingCouple}
        statuses={statuses}
        loading={updateCouple.isPending || deleteCouple.isPending}
      />
    </div>
  );
}
