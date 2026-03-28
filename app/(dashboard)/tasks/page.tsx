"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/utils";
import { useCouples } from "@/app/(dashboard)/couples/use-couples";
import { useCoupleStatuses } from "@/app/(dashboard)/couples/use-couple-statuses";
import { useUpdateCouple, useDeleteCouple } from "@/app/(dashboard)/couples/use-couples";
import { CoupleProfile } from "@/app/(dashboard)/couples/couple-profile";
import { CoupleModal } from "@/app/(dashboard)/couples/couple-modal";
import { TaskModal, TaskFormData } from "@/app/(dashboard)/tasks/task-modal";
import { useToast } from "@/components/ui/toast";
import { Couple } from "@/app/(dashboard)/couples/couples-types";
import { CheckSquare, Circle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  description?: string | null;
  status: "todo" | "in_progress" | "done";
  related_couple_id: string | null;
  couple?: { id: string; name: string } | null;
}

function groupTasks(tasks: Task[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue: Task[] = [];
  const todayTasks: Task[] = [];
  const upcoming: Task[] = [];
  const done: Task[] = [];

  for (const task of tasks) {
    if (task.status === "done") { done.push(task); continue; }
    if (!task.due_date) { upcoming.push(task); continue; }
    const due = new Date(task.due_date + "T00:00:00");
    due.setHours(0, 0, 0, 0);
    const diff = due.getTime() - today.getTime();
    if (diff < 0) overdue.push(task);
    else if (diff === 0) todayTasks.push(task);
    else upcoming.push(task);
  }

  return { overdue, today: todayTasks, upcoming, done };
}

function TaskRow({
  task,
  onToggle,
  onCoupleClick,
  onClick,
  overdue = false,
}: {
  task: Task;
  onToggle: () => void;
  onCoupleClick: (id: string) => void;
  onClick: () => void;
  overdue?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-1 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer rounded-sm ${
        overdue ? "border-l-2 border-l-red-300 pl-3" : ""
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="shrink-0 text-gray-300 hover:text-gray-600 transition cursor-pointer"
        title={task.status === "done" ? "Mark as outstanding" : "Mark as done"}
      >
        {task.status === "done" ? (
          <CheckSquare size={15} strokeWidth={1.5} className="text-emerald-400" />
        ) : (
          <Circle size={15} strokeWidth={1.5} />
        )}
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className={`text-sm ${task.status === "done" ? "text-gray-300 line-through" : "text-gray-800"}`}>
          {task.title}
        </p>
        {task.couple && (
          <button
            onClick={(e) => { e.stopPropagation(); onCoupleClick(task.couple!.id); }}
            className="text-xs bg-gray-100 text-gray-400 rounded-full px-2 py-0.5 hover:bg-gray-200 hover:text-gray-600 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            {task.couple.name}
          </button>
        )}
      </div>

      {task.due_date && (
        <span className={`text-xs shrink-0 ${overdue ? "text-red-400 font-medium" : "text-gray-400"}`}>
          {formatRelativeDate(task.due_date)}
        </span>
      )}
    </div>
  );
}

function SectionGroup({
  label,
  tasks,
  onToggle,
  onCoupleClick,
  onTaskClick,
  overdue = false,
}: {
  label: string;
  tasks: Task[];
  onToggle: (id: string, status: string) => void;
  onCoupleClick: (id: string) => void;
  onTaskClick: (task: Task) => void;
  overdue?: boolean;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-6">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 px-1">{label}</p>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggle={() => onToggle(task.id, task.status)}
          onCoupleClick={onCoupleClick}
          onClick={() => onTaskClick(task)}
          overdue={overdue}
        />
      ))}
    </div>
  );
}

export default function TasksPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { data: couples } = useCouples();
  const { data: statuses } = useCoupleStatuses();
  const updateCouple = useUpdateCouple();
  const deleteCouple = useDeleteCouple();
  const { toast } = useToast();

  const [showDone, setShowDone] = useState(false);
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCouple, setEditingCouple] = useState<Couple | undefined>();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, description, status, related_couple_id, couples(id, name)")
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
      const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
  });

  const saveTask = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");

      if (data.id) {
        const { error } = await supabase
          .from("tasks")
          .update({
            title: data.title,
            due_date: data.due_date,
            description: data.description,
            related_couple_id: data.related_couple_id ?? null,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({
          title: data.title,
          due_date: data.due_date,
          description: data.description,
          related_couple_id: data.related_couple_id ?? null,
          status: "todo",
          user_id: user.user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      toast(data.id ? "Task updated" : "Task added");
      setTaskModalOpen(false);
      setEditingTask(undefined);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      toast("Task deleted");
      setTaskModalOpen(false);
      setEditingTask(undefined);
    },
  });

  const handleSelectCouple = (coupleId: string) => {
    const couple = (couples || []).find((c) => c.id === coupleId);
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

  const allTasks = tasks || [];
  const groups = groupTasks(allTasks);
  const pendingCount = groups.overdue.length + groups.today.length + groups.upcoming.length;
  const coupleList = (couples || []).map((c) => ({ id: c.id, name: c.name }));

  const openTaskModal = (task?: Task) => {
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-5 flex-shrink-0 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-gray-900">Tasks</h1>
        <button
          onClick={() => openTaskModal()}
          className="text-sm px-3 py-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 transition cursor-pointer"
        >
          + New Task
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : pendingCount === 0 && groups.done.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare size={36} strokeWidth={1} className="text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">No tasks yet.</p>
          </div>
        ) : (
          <>
            {pendingCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckSquare size={36} strokeWidth={1} className="text-gray-200 mb-3" />
                <p className="text-gray-400 text-sm">No outstanding tasks.</p>
              </div>
            ) : (
              <>
                <SectionGroup
                  label="Overdue"
                  tasks={groups.overdue}
                  onToggle={(id, status) => toggleTask.mutate({ id, currentStatus: status })}
                  onCoupleClick={handleSelectCouple}
                  onTaskClick={openTaskModal}
                  overdue
                />
                <SectionGroup
                  label="Today"
                  tasks={groups.today}
                  onToggle={(id, status) => toggleTask.mutate({ id, currentStatus: status })}
                  onCoupleClick={handleSelectCouple}
                  onTaskClick={openTaskModal}
                />
                <SectionGroup
                  label="Upcoming"
                  tasks={groups.upcoming}
                  onToggle={(id, status) => toggleTask.mutate({ id, currentStatus: status })}
                  onCoupleClick={handleSelectCouple}
                  onTaskClick={openTaskModal}
                />
              </>
            )}

            {groups.done.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowDone((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  {showDone ? "Hide completed" : `Show ${groups.done.length} completed`}
                </button>
                {showDone && (
                  <div className="mt-3">
                    {groups.done.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onToggle={() => toggleTask.mutate({ id: task.id, currentStatus: task.status })}
                        onCoupleClick={handleSelectCouple}
                        onClick={() => openTaskModal(task)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setEditingTask(undefined); }}
        onSave={(data) => saveTask.mutate(data)}
        onDelete={(id) => deleteTask.mutate(id)}
        task={editingTask}
        couples={coupleList}
        loading={saveTask.isPending || deleteTask.isPending}
      />

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
        onClose={() => { setModalOpen(false); setEditingCouple(undefined); }}
        onSave={handleSaveCouple}
        onDelete={handleDeleteCouple}
        couple={editingCouple}
        statuses={statuses}
        loading={updateCouple.isPending || deleteCouple.isPending}
      />
    </div>
  );
}
