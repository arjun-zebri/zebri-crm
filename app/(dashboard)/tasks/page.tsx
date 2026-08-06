"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

import { CoupleModal } from "@/app/(dashboard)/couples/couple-modal";
import { CoupleProfile } from "@/app/(dashboard)/couples/couple-profile";
import { useCoupleStatuses } from "@/app/(dashboard)/couples/use-couple-statuses";
import { useCouples } from "@/app/(dashboard)/couples/use-couples";
import { useUpdateCouple, useDeleteCouple } from "@/app/(dashboard)/couples/use-couples";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { Couple } from '@/types/couple';
import {
  PRIORITY_ORDER,
  STATUS_ORDER,
  TaskPriority,
  TaskStatus,
} from '@/types/task';

import {
  bulkDeleteTasksAction,
  bulkUpdateTasksAction,
  createTaskAction,
  deleteTaskAction,
  reorderTasksAction,
  updateTaskAction,
} from './actions';
import { BulkActionsBar } from "./bulk-actions-bar";
import { GroupByToggle, GroupByMode } from "./group-by-toggle";
import { TaskRow, TaskRowTask } from "./task-row";
import {
  useTaskGroups,
  useCreateTaskGroup,
  useUpdateTaskGroup,
  useDeleteTaskGroup,
  TaskGroup,
  TaskGroupColor,
  TASK_GROUP_DOT_CLASS,
} from "./use-task-groups";
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
} from "./use-task-options";
import { TaskSidePanel, TaskFieldUpdate } from "./task-side-panel";
import { GroupSection, UNGROUPED_ID } from "./group-section";
import { FilterBar, TaskFilter, TaskSort } from "./filter-bar";
import {
  PriorityPill,
  StatusPill,
} from "./task-cells";




/** Throw on `ok: false` so React Query treats it as an error. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data;
  throw new Error(result.error);
}

interface Task extends TaskRowTask {
  position: number;
}

const STORAGE_KEY = "tasks-group-by";

function parseGroupByFromStorage(): GroupByMode {
  if (typeof window === "undefined") return "status";
  const v = window.localStorage.getItem(STORAGE_KEY);
  const valid: GroupByMode[] = ["status", "date", "couple", "priority", "custom", "none"];
  return (valid as string[]).includes(v ?? "") ? (v as GroupByMode) : "status";
}

function todayYMD() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDaysYMD(days: number): string {
  const d = todayYMD();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { data: couples } = useCouples();
  const { data: statuses } = useCoupleStatuses();
  const updateCouple = useUpdateCouple();
  const deleteCouple = useDeleteCouple();
  const { toast } = useToast();

  // Read the persisted group-by mode in the `useState` initializer so
  // there's no mount-effect-then-setState cycle (which the React
  // compiler flags as a cascading-render risk).
  const [groupBy, setGroupBy] = useState<GroupByMode>(() =>
    parseGroupByFromStorage(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<TaskFilter[]>([]);
  const [sorts, setSorts] = useState<TaskSort[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  // Id of the task created by the most recent "New task" click, so the panel
  // knows to select the placeholder title instead of opening read-ready.
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [coupleModalOpen, setCoupleModalOpen] = useState(false);
  const [editingCouple, setEditingCouple] = useState<Couple | undefined>();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, groupBy);
    }
  }, [groupBy]);

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIds(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds.size]);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, title, due_date, description, status, related_couple_id, group_id, position, priority, task_type, couples(id, name)"
        )
        .eq("user_id", user.user.id);
      if (error) throw error;
      type Row = Omit<Task, "couple"> & {
        couples: { id: string; name: string } | { id: string; name: string }[] | null;
      };
      return ((data || []) as unknown as Row[]).map((t) => {
        const couple = Array.isArray(t.couples) ? (t.couples[0] ?? null) : t.couples ?? null;
        return { ...t, couple };
      }) as Task[];
    },
  });

  const { data: groups } = useTaskGroups();
  const createGroup = useCreateTaskGroup();
  const updateGroup = useUpdateTaskGroup();
  const deleteGroup = useDeleteTaskGroup();

  // Persisted status + priority + task_type option lists. These back
  // the colour-aware Notion-style dropdowns on those cells.
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

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const patchTask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskFieldUpdate }) => {
      unwrap(await updateTaskAction({ id, patch }));
    },
    onMutate: ({ id, patch }) => {
      queryClient.setQueryData(["all-tasks"], (old: Task[] | undefined) =>
        old?.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
  });

  const insertTask = useMutation({
    // Caller supplies the new task's UUID (via `crypto.randomUUID()`)
    // so the optimistic row's id matches the server-side row's id —
    // that way cell edits can fire `patchTask` against a real UUID
    // immediately after `+ New task` instead of failing on a `temp-`
    // placeholder.
    mutationFn: async (
      input: Partial<Task> & { id: string; title: string },
    ) => {
      unwrap(
        await createTaskAction({
          id: input.id,
          title: input.title,
          due_date: input.due_date ?? null,
          group_id: input.group_id ?? null,
          related_couple_id: input.related_couple_id ?? null,
          status: input.status ?? "todo",
          priority: input.priority ?? null,
          task_type: input.task_type ?? null,
        }),
      );
    },
    onMutate: (input) => {
      const couple = input.related_couple_id
        ? coupleList.find((c) => c.id === input.related_couple_id) ?? null
        : null;
      const optimistic: Task = {
        id: input.id,
        title: input.title,
        due_date: input.due_date ?? null,
        description: null,
        status: input.status ?? "todo",
        related_couple_id: input.related_couple_id ?? null,
        group_id: input.group_id ?? null,
        priority: input.priority ?? null,
        task_type: input.task_type ?? null,
        couple,
        position: Number.MAX_SAFE_INTEGER,
      };
      queryClient.setQueryData(["all-tasks"], (old: Task[] | undefined) =>
        old ? [...old, optimistic] : [optimistic]
      );
      return { id: input.id };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
    onError: (_err, _input, ctx) => {
      if (ctx?.id) {
        queryClient.setQueryData(["all-tasks"], (old: Task[] | undefined) =>
          old?.filter((t) => t.id !== ctx.id)
        );
      }
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteTaskAction(id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({
      ids,
      patch,
    }: {
      ids: string[];
      patch: Record<string, unknown>;
    }) => {
      // The action's Zod schema is narrower than `Record<string,
      // unknown>` — the bulk-bar only emits valid keys (status,
      // priority, task_type, group_id, due_date) so this is safe.
      unwrap(
        await bulkUpdateTasksAction({
          ids,
          patch: patch as Parameters<typeof bulkUpdateTasksAction>[0]['patch'],
        }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      unwrap(await bulkDeleteTasksAction(ids));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
  });

  const reorderPositions = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      unwrap(await reorderTasksAction(orderedIds));
    },
    onMutate: (orderedIds: string[]) => {
      const positionById = new Map<string, number>();
      orderedIds.forEach((id, i) => positionById.set(id, (i + 1) * 1000));
      queryClient.setQueryData(["all-tasks"], (old: Task[] | undefined) =>
        old?.map((t) =>
          positionById.has(t.id) ? { ...t, position: positionById.get(t.id)! } : t
        )
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
  });

  // ─── Derived data ──────────────────────────────────────────────────────────
  const groupsList = useMemo(() => groups ?? [], [groups]);
  const groupById = useMemo(() => {
    const m = new Map<string, TaskGroup>();
    for (const g of groupsList) m.set(g.id, g);
    return m;
  }, [groupsList]);

  const coupleList = useMemo(
    () => (couples || []).map((c) => ({ id: c.id, name: c.name })),
    [couples]
  );

  // String-name lists for the filter bar (which doesn't care about
  // colours). Priorities merge built-ins + user-defined options;
  // task types are entirely user-defined.
  const knownTypes = useMemo(
    () => typeOptions.map((o) => o.name).sort(),
    [typeOptions],
  );

  const knownStatuses = useMemo(() => {
    const base = new Set((STATUS_ORDER as string[]).map((s) => s.toLowerCase()));
    const customs = statusOptions
      .map((o) => o.name)
      .filter((n) => !base.has(n.toLowerCase()));
    return [...(STATUS_ORDER as string[]), ...customs];
  }, [statusOptions]);

  const knownPriorities = useMemo(() => {
    const base = new Set(PRIORITY_ORDER);
    const customs = priorityOptions
      .map((o) => o.name)
      .filter((n) => !base.has(n.toLowerCase()));
    return [...PRIORITY_ORDER, ...customs];
  }, [priorityOptions]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let out = (tasks || []).filter((t) => {
      if (q) {
        const matches =
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false);
        if (!matches) return false;
      }
      for (const f of filters) {
        if (!f.value) continue; // empty filter = no constraint yet
        if (f.property === "status" && t.status !== f.value) return false;
        if (f.property === "priority" && (t.priority ?? "") !== f.value) return false;
        if (f.property === "task_type" && (t.task_type ?? "") !== f.value) return false;
        if (f.property === "couple" && (t.related_couple_id ?? "") !== f.value) return false;
      }
      return true;
    });
    if (sorts.length > 0) {
      const cmp = (a: Task, b: Task) => {
        for (const s of sorts) {
          const dir = s.direction === "asc" ? 1 : -1;
          if (s.property === "due_date") {
            const av = a.due_date ?? "9999";
            const bv = b.due_date ?? "9999";
            if (av !== bv) return av < bv ? -1 * dir : 1 * dir;
          } else if (s.property === "title") {
            const c = a.title.localeCompare(b.title);
            if (c !== 0) return c * dir;
          } else if (s.property === "status") {
            const av = knownStatuses.indexOf(a.status);
            const bv = knownStatuses.indexOf(b.status);
            if (av !== bv) return (av - bv) * dir;
          } else if (s.property === "priority") {
            const av = a.priority ? PRIORITY_ORDER.indexOf(a.priority) : 99;
            const bv = b.priority ? PRIORITY_ORDER.indexOf(b.priority) : 99;
            if (av !== bv) return (av - bv) * dir;
          }
        }
        return a.position - b.position;
      };
      out = [...out].sort(cmp);
    } else {
      out = [...out].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }
    return out;
  }, [tasks, searchQuery, filters, sorts]);

  // ─── Selection ─────────────────────────────────────────────────────────────
  const selectionActive = selectedIds.size > 0;
  const onToggleSelect = (taskId: string, e: React.MouseEvent, visibleIds: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (e.shiftKey && lastClickedId && lastClickedId !== taskId) {
        const a = visibleIds.indexOf(lastClickedId);
        const b = visibleIds.indexOf(taskId);
        if (a !== -1 && b !== -1) {
          const [from, to] = a < b ? [a, b] : [b, a];
          for (let i = from; i <= to; i++) next.add(visibleIds[i]);
        }
      } else if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
    setLastClickedId(taskId);
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────
  /**
   * Create a task and open it in the side panel straight away.
   *
   * The id is generated client-side and used for the optimistic row, so the
   * panel can render (and patch) the new task before the server round-trip
   * finishes.
   *
   * @param defaults - Field defaults from the section the task was added to.
   */
  const handleCreateTask = (defaults?: Partial<Task>) => {
    const id = crypto.randomUUID();
    insertTask.mutate({ ...defaults, id, title: "Untitled task" });
    setCreatedTaskId(id);
    setEditingTaskId(id);
  };

  const handleSelectCouple = (coupleId: string) => {
    const c = (couples || []).find((x) => x.id === coupleId);
    if (c) setSelectedCouple(c);
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
    setCoupleModalOpen(false);
    setEditingCouple(undefined);
  };

  const handleDeleteCouple = async (id: string) => {
    await deleteCouple.mutateAsync(id);
    setCoupleModalOpen(false);
    setEditingCouple(undefined);
    if (selectedCouple?.id === id) setSelectedCouple(null);
    toast("Couple deleted");
  };

  // ─── Drag-and-drop ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const draggedTask = (tasks || []).find((t) => t.id === activeId);
    if (!draggedTask) return;

    let destBucket: string | null | undefined;
    if (overId.startsWith("group:")) {
      const raw = overId.slice("group:".length);
      destBucket = raw === UNGROUPED_ID ? null : raw;
    } else {
      const overTask = (tasks || []).find((t) => t.id === overId);
      if (!overTask) return;
      destBucket = bucketKeyFor(overTask, groupBy);
    }

    const sourceBucket = bucketKeyFor(draggedTask, groupBy);

    if (destBucket !== sourceBucket && destBucket !== undefined) {
      // Move between buckets - patch the underlying property
      const patch = bucketPatch(groupBy, destBucket);
      if (patch) {
        patchTask.mutate({ id: activeId, patch });
        return;
      }
    }

    // Same-bucket reorder
    const peers = filteredTasks.filter(
      (t) => bucketKeyFor(t, groupBy) === sourceBucket
    );
    const oldIdx = peers.findIndex((t) => t.id === activeId);
    const newIdx = peers.findIndex((t) => t.id === overId);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(peers, oldIdx, newIdx);
    reorderPositions.mutate(reordered.map((p) => p.id));
  };

  // ─── Bucket builders ───────────────────────────────────────────────────────
  // Returns a list of (key, header, group?, tasks) for the current groupBy mode
  type Section = {
    droppableId: string;
    header: React.ReactNode;
    tasks: Task[];
    group?: TaskGroup;
    addTaskDefaults?: Partial<Task>;
  };

  const sections = useMemo<Section[]>(() => {
    if (groupBy === "status") {
      return knownStatuses.map((s) => ({
        droppableId: `status:${s}`,
        header: <StatusPill value={s} options={statusOptions} />,
        tasks: filteredTasks.filter((t) => t.status === s),
        addTaskDefaults: { status: s },
      }));
    }
    if (groupBy === "priority") {
      const out: Section[] = knownPriorities.map((p) => ({
        droppableId: `priority:${p}`,
        header: <PriorityPill value={p} options={priorityOptions} />,
        tasks: filteredTasks.filter((t) => t.priority === p),
        addTaskDefaults: { priority: p },
      }));
      out.push({
        droppableId: `priority:none`,
        header: <span className="text-sm text-gray-400">No priority</span>,
        tasks: filteredTasks.filter((t) => !t.priority),
        addTaskDefaults: { priority: null },
      });
      return out;
    }
    if (groupBy === "couple") {
      const map = new Map<string, Task[]>();
      const unassigned: Task[] = [];
      for (const t of filteredTasks) {
        if (t.related_couple_id) {
          if (!map.has(t.related_couple_id)) map.set(t.related_couple_id, []);
          map.get(t.related_couple_id)!.push(t);
        } else {
          unassigned.push(t);
        }
      }
      const out: Section[] = [];
      for (const c of coupleList) {
        const list = map.get(c.id);
        if (!list) continue;
        out.push({
          droppableId: `couple:${c.id}`,
          header: <span className="text-sm font-medium text-gray-900">{c.name}</span>,
          tasks: list,
          addTaskDefaults: { related_couple_id: c.id },
        });
      }
      if (unassigned.length > 0) {
        out.push({
          droppableId: `couple:none`,
          header: <span className="text-sm text-gray-400">Unassigned</span>,
          tasks: unassigned,
          addTaskDefaults: { related_couple_id: null },
        });
      }
      return out;
    }
    if (groupBy === "custom") {
      const map = new Map<string, Task[]>();
      const ungrouped: Task[] = [];
      for (const t of filteredTasks) {
        if (t.group_id && groupById.has(t.group_id)) {
          if (!map.has(t.group_id)) map.set(t.group_id, []);
          map.get(t.group_id)!.push(t);
        } else {
          ungrouped.push(t);
        }
      }
      const out: Section[] = groupsList.map((g) => ({
        droppableId: g.id,
        group: g,
        header: (
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${TASK_GROUP_DOT_CLASS[g.color]}`} />
            <span className="text-sm font-medium text-gray-900">{g.name}</span>
          </span>
        ),
        tasks: map.get(g.id) ?? [],
        addTaskDefaults: { group_id: g.id },
      }));
      out.push({
        droppableId: UNGROUPED_ID,
        header: <span className="text-sm text-gray-400">Ungrouped</span>,
        tasks: ungrouped,
        addTaskDefaults: { group_id: null },
      });
      return out;
    }
    if (groupBy === "date") {
      const today = todayYMD();
      const overdue: Task[] = [];
      const todayTasks: Task[] = [];
      const upcoming: Task[] = [];
      const noDate: Task[] = [];
      for (const t of filteredTasks) {
        if (!t.due_date) {
          noDate.push(t);
          continue;
        }
        const due = new Date(t.due_date + "T00:00:00");
        due.setHours(0, 0, 0, 0);
        const diff = due.getTime() - today.getTime();
        if (diff < 0) overdue.push(t);
        else if (diff === 0) todayTasks.push(t);
        else upcoming.push(t);
      }
      return [
        {
          droppableId: "date:overdue",
          header: <span className="text-sm font-medium text-red-600">Overdue</span>,
          tasks: overdue,
        },
        {
          droppableId: "date:today",
          header: <span className="text-sm font-medium text-gray-900">Today</span>,
          tasks: todayTasks,
          addTaskDefaults: { due_date: addDaysYMD(0) },
        },
        {
          droppableId: "date:upcoming",
          header: <span className="text-sm font-medium text-gray-900">Upcoming</span>,
          tasks: upcoming,
          addTaskDefaults: { due_date: addDaysYMD(1) },
        },
        {
          droppableId: "date:none",
          header: <span className="text-sm text-gray-400">No date</span>,
          tasks: noDate,
          addTaskDefaults: { due_date: null },
        },
      ];
    }
    // none
    return [
      {
        droppableId: "all",
        header: <span className="text-sm font-medium text-gray-900">All tasks</span>,
        tasks: filteredTasks,
      },
    ];
  }, [groupBy, filteredTasks, coupleList, groupsList, groupById]);

  // ─── Bulk handlers ─────────────────────────────────────────────────────────
  const clearSelection = () => setSelectedIds(new Set());
  const bulkMarkDone = () => {
    bulkUpdate.mutate({ ids: [...selectedIds], patch: { status: "done" } });
    clearSelection();
  };
  const bulkChangeDate = (date: string | null) => {
    bulkUpdate.mutate({ ids: [...selectedIds], patch: { due_date: date } });
    clearSelection();
  };
  const bulkMoveToGroup = (groupId: string | null) => {
    bulkUpdate.mutate({ ids: [...selectedIds], patch: { group_id: groupId } });
    clearSelection();
  };
  const bulkDeleteSelected = () => {
    bulkDelete.mutate([...selectedIds]);
    clearSelection();
  };

  // ─── Selection range + panel target ────────────────────────────────────────
  const flatVisible = useMemo(
    () => sections.flatMap((s) => s.tasks.map((t) => t.id)),
    [sections]
  );
  const editingTask = (tasks || []).find((t) => t.id === editingTaskId);

  // Total stats
  const totalCount = filteredTasks.length;
  const isEmpty = !isLoading && totalCount === 0;

  // ─── Render ────────────────────────────────────────────────────────────────
  const visibleIds = flatVisible;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Page header */}
      <div className="px-6 sm:px-[3.75rem] pt-6 pb-3 flex-shrink-0">
        <PageHeader
          title="Tasks"
          className="mb-4"
          actions={
            <button
              onClick={() => handleCreateTask()}
              className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition cursor-pointer"
              aria-label="New task"
            >
              <Plus size={16} strokeWidth={2} />
            </button>
          }
        />

        {/* Toolbar */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative w-full sm:w-56">
            <Search
              size={11}
              strokeWidth={1.5}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full border border-gray-200 rounded-md pl-6 pr-6 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition cursor-pointer p-0.5"
              >
                <X size={10} strokeWidth={2} />
              </button>
            )}
          </div>
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            sorts={sorts}
            setSorts={setSorts}
            knownTypes={knownTypes}
            knownStatuses={knownStatuses}
            knownPriorities={knownPriorities}
            statusOptions={statusOptions}
            priorityOptions={priorityOptions}
            typeOptions={typeOptions}
            couples={coupleList}
          />
          <div className="ml-auto flex items-center gap-2">
            <GroupByToggle value={groupBy} onChange={setGroupBy} />
            <button
              onClick={() => handleCreateTask()}
              className="hidden sm:inline-flex items-center gap-1 px-2 py-2 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-700 transition cursor-pointer"
            >
              <Plus size={11} strokeWidth={2} />
              New task
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-y-auto pl-6 pr-6 sm:pr-[3.75rem] pb-24">
        {isLoading ? (
          <div className="space-y-2 mt-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-400 text-sm">No tasks match these filters.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {sections.map((s) => (
              <GroupSection
                key={s.droppableId}
                droppableId={s.droppableId}
                header={s.header}
                count={s.tasks.length}
                taskIds={s.tasks.map((t) => t.id)}
                group={s.group}
                onRename={
                  s.group ? (id, name) => updateGroup.mutate({ id, name }) : undefined
                }
                onRecolor={
                  s.group
                    ? (id, color: TaskGroupColor) => updateGroup.mutate({ id, color })
                    : undefined
                }
                onDelete={s.group ? (id) => deleteGroup.mutate(id) : undefined}
                onAddTask={() => handleCreateTask(s.addTaskDefaults)}
              >
                {s.tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    statusOptions={statusOptions}
                    priorityOptions={priorityOptions}
                    typeOptions={typeOptions}
                    selected={selectedIds.has(t.id)}
                    selectionActive={selectionActive}
                    draggable
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
                    onDeleteStatusOption={(id) =>
                      deleteStatusOption.mutate(id)
                    }
                    onCreatePriorityOption={(input) =>
                      createPriorityOption.mutate(input)
                    }
                    onRecolorPriorityOption={(id, color) =>
                      updatePriorityOption.mutate({ id, color })
                    }
                    onDeletePriorityOption={(id) =>
                      deletePriorityOption.mutate(id)
                    }
                    onCreateTypeOption={(input) =>
                      createTypeOption.mutate(input)
                    }
                    onRecolorTypeOption={(id, color) =>
                      updateTypeOption.mutate({ id, color })
                    }
                    onDeleteTypeOption={(id) => deleteTypeOption.mutate(id)}
                    onOpen={() => setEditingTaskId(t.id)}
                    onCoupleClick={handleSelectCouple}
                    onToggleSelect={(e) => onToggleSelect(t.id, e, visibleIds)}
                  />
                ))}
              </GroupSection>
            ))}

            {groupBy === "custom" && (
              <button
                onClick={() => {
                  const name = window.prompt("Group name");
                  if (name && name.trim()) createGroup.mutate({ name: name.trim() });
                }}
                className="mt-2 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 border border-dashed border-gray-200 hover:border-gray-300 rounded-xl px-3 py-1.5 transition cursor-pointer"
              >
                <Plus size={13} strokeWidth={1.5} />
                New group
              </button>
            )}
          </DndContext>
        )}
      </div>

      <BulkActionsBar
        count={selectedIds.size}
        onClear={clearSelection}
        onMarkDone={bulkMarkDone}
        onChangeDate={bulkChangeDate}
        onMoveToGroup={groupBy === "custom" ? bulkMoveToGroup : undefined}
        onDelete={bulkDeleteSelected}
        groups={groupsList}
      />

      <TaskSidePanel
        isOpen={!!editingTask}
        onClose={() => {
          setEditingTaskId(null);
          setCreatedTaskId(null);
        }}
        task={editingTask}
        autoFocusTitle={!!editingTaskId && editingTaskId === createdTaskId}
        couples={coupleList}
        groups={groupsList}
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
          deleteTaskMutation.mutate(id);
          setEditingTaskId(null);
          toast("Task deleted");
        }}
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
        isOpen={coupleModalOpen}
        onClose={() => {
          setCoupleModalOpen(false);
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

// ─── Helpers ────────────────────────────────────────────────────────────────
function bucketKeyFor(t: Task, mode: GroupByMode): string | null {
  if (mode === "status") return t.status;
  if (mode === "priority") return t.priority ?? "none";
  if (mode === "couple") return t.related_couple_id ?? "none";
  if (mode === "custom") return t.group_id ?? UNGROUPED_ID;
  return null;
}

function bucketPatch(mode: GroupByMode, bucket: string | null): TaskFieldUpdate | null {
  if (mode === "status" && bucket) {
    return { status: bucket };
  }
  if (mode === "priority") {
    if (bucket === "none") return { priority: null };
    if (bucket) return { priority: bucket };
  }
  if (mode === "couple") {
    return { related_couple_id: bucket === "none" ? null : bucket };
  }
  if (mode === "custom") {
    return { group_id: bucket === UNGROUPED_ID ? null : bucket };
  }
  return null;
}
