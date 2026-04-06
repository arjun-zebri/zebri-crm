"use client";

import { useState, useMemo, useRef, useEffect, Fragment } from "react";
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
import { CheckSquare, Square, Search, X, ChevronDown, Plus } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";

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
  const noDate: Task[] = [];
  const done: Task[] = [];

  for (const task of tasks) {
    if (task.status === "done") { done.push(task); continue; }
    if (!task.due_date) { noDate.push(task); continue; }
    const due = new Date(task.due_date + "T00:00:00");
    due.setHours(0, 0, 0, 0);
    const diff = due.getTime() - today.getTime();
    if (diff < 0) overdue.push(task);
    else if (diff === 0) todayTasks.push(task);
    else upcoming.push(task);
  }

  return { overdue, today: todayTasks, upcoming, noDate, done };
}

function ProgressSummary({
  overdue,
  today,
  upcoming,
  noDate,
}: {
  overdue: number;
  today: number;
  upcoming: number;
  noDate: number;
}) {
  const total = overdue + today + upcoming + noDate;

  if (total === 0) {
    return (
      <div className="px-6 pb-4 flex items-center gap-1.5 text-sm text-gray-400">
        <CheckSquare size={13} strokeWidth={1.5} className="text-emerald-400" />
        All caught up
      </div>
    );
  }

  const items: { label: string; dot: string; textClass?: string }[] = [
    ...(overdue > 0 ? [{ label: `${overdue} overdue`, dot: "bg-red-400", textClass: "text-red-500" }] : []),
    ...(today > 0 ? [{ label: `${today} today`, dot: "bg-emerald-400" }] : []),
    ...(upcoming > 0 ? [{ label: `${upcoming} upcoming`, dot: "bg-gray-300" }] : []),
    ...(noDate > 0 ? [{ label: `${noDate} no date`, dot: "bg-gray-200" }] : []),
  ];

  return (
    <div className="px-6 pb-4 flex items-center gap-2 text-sm text-gray-400 flex-wrap">
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <span className="text-gray-200">·</span>}
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
            <span className={item.textClass}>{item.label}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function TasksFilterBar({
  searchQuery,
  setSearchQuery,
  filterCoupleId,
  setFilterCoupleId,
  couples,
  compact = false,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterCoupleId: string | null;
  setFilterCoupleId: (v: string | null) => void;
  couples: { id: string; name: string }[];
  compact?: boolean;
}) {
  const [coupleOpen, setCoupleOpen] = useState(false);
  const selectedCouple = couples.find((c) => c.id === filterCoupleId);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative w-40">
          <Search
            size={12}
            strokeWidth={1.5}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full border border-gray-200 rounded-lg pl-7 pr-6 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-1 focus:ring-green-100 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition cursor-pointer p-0.5"
            >
              <X size={11} strokeWidth={2} />
            </button>
          )}
        </div>

        {couples.length > 0 && (
          <Popover.Root open={coupleOpen} onOpenChange={setCoupleOpen}>
            <Popover.Trigger asChild>
              <button className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition whitespace-nowrap cursor-pointer">
                <span className="truncate max-w-24">{selectedCouple ? selectedCouple.name : "Couples"}</span>
                <ChevronDown size={10} strokeWidth={1.5} className="text-gray-400 shrink-0" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[70] w-48 max-h-48 overflow-y-auto"
                sideOffset={4}
                align="end"
              >
                <button
                  type="button"
                  onClick={() => { setFilterCoupleId(null); setCoupleOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition ${
                    !filterCoupleId ? "bg-green-50 text-green-700" : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  All couples
                </button>
                {couples.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setFilterCoupleId(c.id); setCoupleOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition ${
                      filterCoupleId === c.id
                        ? "bg-green-50 text-green-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    );
  }

  return null;
}

function InlineAdd({
  sectionKey,
  onAdd,
  loading,
}: {
  sectionKey: "today" | "upcoming" | "noDate";
  onAdd: (title: string, dueDate: string | null) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const getDueDate = (): string | null => {
    if (sectionKey === "noDate") return null;
    const d = new Date();
    if (sectionKey === "upcoming") d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSubmit = () => {
    const trimmed = title.trim();
    setTitle("");
    setOpen(false);
    if (trimmed) onAdd(trimmed, getDueDate());
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-1 py-2 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
      >
        <Plus size={12} strokeWidth={2} className="shrink-0" />
        Add task
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 px-1 py-2.5 border-b border-gray-100 bg-gray-50 rounded-sm">
      <Square size={20} strokeWidth={1.5} className="shrink-0 text-gray-200" />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") { setOpen(false); setTitle(""); }
        }}
        onBlur={() => {
          if (!title.trim()) { setOpen(false); setTitle(""); }
          else handleSubmit();
        }}
        placeholder="Task title..."
        className="flex-1 text-sm text-gray-800 placeholder:text-gray-400 outline-none bg-transparent"
        disabled={loading}
      />
      <span className="text-xs text-gray-300 shrink-0">↵</span>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onCoupleClick,
  onClick,
}: {
  task: Task;
  onToggle: () => void;
  onCoupleClick: (id: string) => void;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 px-1 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer rounded-sm"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="shrink-0 text-gray-300 hover:text-gray-500 transition cursor-pointer mt-0.5"
        title={task.status === "done" ? "Mark as outstanding" : "Mark as done"}
      >
        {task.status === "done" ? (
          <CheckSquare size={20} strokeWidth={1.5} className="text-emerald-400" />
        ) : (
          <Square size={20} strokeWidth={1.5} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
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
        {task.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{task.description}</p>
        )}
      </div>

      {task.due_date && (
        <span className="text-xs shrink-0 mt-0.5 text-gray-400">
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
  sectionKey,
  onAddTask,
  addLoading,
}: {
  label: string;
  tasks: Task[];
  onToggle: (id: string, status: string) => void;
  onCoupleClick: (id: string) => void;
  onTaskClick: (task: Task) => void;
  overdue?: boolean;
  sectionKey?: "today" | "upcoming" | "noDate";
  onAddTask?: (title: string, dueDate: string | null) => void;
  addLoading?: boolean;
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2 px-1">
        <p className={`text-xs font-medium uppercase tracking-wider ${overdue ? "text-red-400" : "text-gray-400"}`}>
          {label}
        </p>
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
            overdue ? "bg-red-50 text-red-400" : "bg-gray-100 text-gray-400"
          }`}
        >
          {tasks.length}
        </span>
      </div>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggle={() => onToggle(task.id, task.status)}
          onCoupleClick={onCoupleClick}
          onClick={() => onTaskClick(task)}
        />
      ))}
      {sectionKey && onAddTask && (
        <InlineAdd sectionKey={sectionKey} onAdd={onAddTask} loading={!!addLoading} />
      )}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCoupleId, setFilterCoupleId] = useState<string | null>(null);

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

  const filteredTasks = useMemo(() => {
    const all = tasks || [];
    if (!searchQuery && !filterCoupleId) return all;
    return all.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false);
      const matchesCouple = !filterCoupleId || t.related_couple_id === filterCoupleId;
      return matchesSearch && matchesCouple;
    });
  }, [tasks, searchQuery, filterCoupleId]);

  const groups = groupTasks(filteredTasks);
  const pendingCount =
    groups.overdue.length + groups.today.length + groups.upcoming.length + groups.noDate.length;
  const coupleList = (couples || []).map((c) => ({ id: c.id, name: c.name }));

  const openTaskModal = (task?: Task) => {
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const handleInlineAdd = (title: string, dueDate: string | null) => {
    saveTask.mutate({ title, due_date: dueDate, description: null, related_couple_id: null });
  };

  const sharedGroupProps = {
    onToggle: (id: string, status: string) => toggleTask.mutate({ id, currentStatus: status }),
    onCoupleClick: handleSelectCouple,
    onTaskClick: openTaskModal,
    onAddTask: handleInlineAdd,
    addLoading: saveTask.isPending,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-3 flex-shrink-0 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-gray-900">Tasks</h1>
        <div className="flex items-center gap-2">
          <TasksFilterBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterCoupleId={filterCoupleId}
            setFilterCoupleId={setFilterCoupleId}
            couples={coupleList}
            compact
          />
          <button
            onClick={() => openTaskModal()}
            className="text-sm px-3 py-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 transition cursor-pointer shrink-0"
          >
            + New Task
          </button>
        </div>
      </div>

      {!isLoading && (
        <ProgressSummary
          overdue={groups.overdue.length}
          today={groups.today.length}
          upcoming={groups.upcoming.length}
          noDate={groups.noDate.length}
        />
      )}

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
                  overdue
                  {...sharedGroupProps}
                  onAddTask={undefined}
                />
                <SectionGroup
                  label="Today"
                  tasks={groups.today}
                  sectionKey="today"
                  {...sharedGroupProps}
                />
                <SectionGroup
                  label="Upcoming"
                  tasks={groups.upcoming}
                  sectionKey="upcoming"
                  {...sharedGroupProps}
                />
                <SectionGroup
                  label="No Date"
                  tasks={groups.noDate}
                  sectionKey="noDate"
                  {...sharedGroupProps}
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
