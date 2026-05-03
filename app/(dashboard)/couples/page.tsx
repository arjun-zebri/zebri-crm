"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  useCouples,
  useCreateCouple,
  useUpdateCouple,
  useDeleteCouple,
  useBulkMoveCouples,
  useBulkUpdateCouplesStatus,
  useBulkDeleteCouples,
} from "./use-couples";
import { useCoupleStatuses } from "./use-couple-statuses";
import { CouplesHeader } from "./couples-header";
import { CouplesList } from "./couples-list";
import { CouplesKanban } from "./couples-kanban";
import { CoupleModal } from "./couple-modal";
import { CoupleProfile } from "./couple-profile";
import { BulkActionBar } from "./bulk-action-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Couple, ViewMode, SortField, SortDirection } from "./couples-types";

export default function CouplesPage() {
  const { data: couples, isLoading } = useCouples();
  const { data: statuses } = useCoupleStatuses();
  const createCouple = useCreateCouple();
  const updateCouple = useUpdateCouple();
  const deleteCouple = useDeleteCouple();
  const bulkMoveCouples = useBulkMoveCouples();
  const bulkUpdateStatus = useBulkUpdateCouplesStatus();
  const bulkDeleteCouples = useBulkDeleteCouples();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("zebri_couples_view");
    if (saved === "kanban" || saved === "list") {
      setViewMode(saved as ViewMode);
    }
  }, []);

  // Open a couple from a deep link (?openCouple=<id>) — syncs URL → React state
  useEffect(() => {
    if (!couples.length || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("openCouple");
    if (!openId) return;
    const match = couples.find((c) => c.id === openId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (match) setSelectedCouple(match);
    params.delete("openCouple");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/couples?${qs}` : "/couples");
  }, [couples]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("zebri_couples_view", mode);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedIds.size > 0) {
        setSelectedIds(new Set());
        return;
      }
      if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setDefaultStatus(undefined);
          setAddModalOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds]);

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (selectedIds.size === 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("[data-couple-id]") ||
      target.closest("[data-bulk-action-bar]") ||
      target.closest("[data-couple-checkbox]") ||
      target.closest("[role='dialog']") ||
      target.closest("[data-modal]")
    ) {
      return;
    }
    setSelectedIds(new Set());
  };

  const baseFiltered = useMemo(() => {
    return couples.filter((couple) => {
      const matchesSearch =
        search === "" ||
        couple.name.toLowerCase().includes(search.toLowerCase()) ||
        couple.email.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || couple.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [couples, search, statusFilter]);

  const filteredCouples = useMemo(() => {
    return [...baseFiltered].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }, [baseFiltered, sortField, sortDirection]);

  const kanbanCouples = useMemo(() => {
    return [...baseFiltered].sort(
      (a, b) => (a.kanban_position ?? 0) - (b.kanban_position ?? 0)
    );
  }, [baseFiltered]);

  const handleAddCouple = async (
    data: Omit<Couple, "id" | "user_id" | "created_at"> & { id?: string }
  ) => {
    const positionsInStatus = couples
      .filter((c) => c.status === data.status)
      .map((c) => c.kanban_position ?? 0);
    const nextPosition =
      positionsInStatus.length > 0 ? Math.max(...positionsInStatus) + 1 : 0;
    await createCouple.mutateAsync({ ...data, kanban_position: nextPosition });
    toast("Couple added");
    setAddModalOpen(false);
  };

  const handleUpdateCouple = async (
    data: Omit<Couple, "id" | "user_id" | "created_at"> & { id?: string }
  ) => {
    const existing = couples.find((c) => c.id === data.id);
    if (!existing) return;
    const updated = { ...existing, ...data } as Couple;
    await updateCouple.mutateAsync(updated);
    setSelectedCouple(updated);
    toast("Couple updated");
  };

  const handleDeleteCouple = async (id: string) => {
    await deleteCouple.mutateAsync(id);
    setSelectedCouple(null);
    toast("Couple deleted");
  };

  const handleDragEnd = async (
    source: string,
    destination: string,
    destinationIndex: number,
    coupleId: string,
    selectedAtStart: Set<string>
  ) => {
    const couple = couples.find((c) => c.id === coupleId);
    if (!couple) return;

    const isMultiDrag = selectedAtStart.has(coupleId) && selectedAtStart.size > 1;
    const movingIds = isMultiDrag ? new Set(selectedAtStart) : new Set([coupleId]);

    const draggedCouples = couples.filter((c) => movingIds.has(c.id));
    const orderedDragged = [...draggedCouples].sort((a, b) => {
      const aStatusIdx = statuses.findIndex((s) => s.slug === a.status);
      const bStatusIdx = statuses.findIndex((s) => s.slug === b.status);
      if (aStatusIdx !== bStatusIdx) return aStatusIdx - bStatusIdx;
      return (a.kanban_position ?? 0) - (b.kanban_position ?? 0);
    });

    const destColumn = couples
      .filter((c) => c.status === destination && !movingIds.has(c.id))
      .sort((a, b) => (a.kanban_position ?? 0) - (b.kanban_position ?? 0));

    const count = orderedDragged.length;
    let basePosition: number;
    let stepSize: number;
    if (destColumn.length === 0) {
      basePosition = 0;
      stepSize = 1;
    } else if (destinationIndex <= 0) {
      const firstPos = destColumn[0].kanban_position ?? 0;
      basePosition = firstPos - count;
      stepSize = 1;
    } else if (destinationIndex >= destColumn.length) {
      const lastPos = destColumn[destColumn.length - 1].kanban_position ?? 0;
      basePosition = lastPos + 1;
      stepSize = 1;
    } else {
      const prev = destColumn[destinationIndex - 1].kanban_position ?? 0;
      const next = destColumn[destinationIndex].kanban_position ?? 0;
      stepSize = (next - prev) / (count + 1);
      basePosition = prev + stepSize;
    }

    if (
      !isMultiDrag &&
      source === destination &&
      couple.kanban_position === basePosition
    ) {
      return;
    }

    const updates = orderedDragged.map((c, idx) => ({
      id: c.id,
      status: destination,
      kanban_position: basePosition + idx * stepSize,
    }));

    if (isMultiDrag) {
      await bulkMoveCouples.mutateAsync(updates);
      setSelectedIds(new Set());
      toast(`${count} couples moved`);
    } else {
      await updateCouple.mutateAsync({
        ...couple,
        status: destination,
        kanban_position: basePosition,
      });
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    await bulkUpdateStatus.mutateAsync({ ids: [...selectedIds], status });
    setSelectedIds(new Set());
    toast("Status updated");
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    await bulkDeleteCouples.mutateAsync([...selectedIds]);
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    toast(`${count} couples deleted`);
  };

  const handleExportCSV = () => {
    const selected = couples.filter((c) => selectedIds.has(c.id));
    const headers = ["Name", "Email", "Phone", "Event Date", "Venue", "Status"];
    const rows = selected.map((c) => [
      c.name,
      c.email || "",
      c.phone || "",
      c.event_date || "",
      c.venue || "",
      c.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "couples.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" onClick={handleBackgroundClick}>
      <div className="px-6 pt-6 pb-2 flex-shrink-0">
        <CouplesHeader
          couples={couples}
          statuses={statuses}
          onAddClick={() => {
            setDefaultStatus(undefined);
            setAddModalOpen(true);
          }}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={(field, direction) => {
            setSortField(field);
            setSortDirection(direction);
          }}
        />
      </div>

      <div
        className={`flex-1 min-h-0 overflow-hidden px-6 ${
          viewMode !== "list" ? "pb-14" : ""
        }`}
      >
        {viewMode === "list" ? (
          <CouplesList
            couples={filteredCouples}
            statuses={statuses}
            onRowClick={(couple) => setSelectedCouple(couple)}
            loading={isLoading}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        ) : (
          <div className="overflow-x-auto overflow-y-auto h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pt-2">
            <CouplesKanban
              couples={kanbanCouples}
              statuses={statuses}
              onCardClick={(couple) => setSelectedCouple(couple)}
              onDragEnd={handleDragEnd}
              onAddClick={(statusSlug) => {
                setDefaultStatus(statusSlug);
                setAddModalOpen(true);
              }}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </div>
        )}
      </div>

      <CoupleProfile
        couple={selectedCouple}
        onClose={() => setSelectedCouple(null)}
        onSave={handleUpdateCouple}
        onDelete={handleDeleteCouple}
        loading={updateCouple.isPending || deleteCouple.isPending}
      />

      <CoupleModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddCouple}
        onDelete={() => {}}
        statuses={statuses}
        defaultStatus={defaultStatus}
        loading={createCouple.isPending}
      />

      {/* Mobile FAB — hidden when profile panel is open */}
      {!selectedCouple && (
        <button
          onClick={() => {
            setDefaultStatus(undefined);
            setAddModalOpen(true);
          }}
          className="sm:hidden fixed bottom-6 right-6 z-40 w-11 h-11 bg-black text-white rounded-full shadow-xl flex items-center justify-center hover:bg-neutral-800 active:scale-95 transition cursor-pointer"
        >
          <Plus size={18} strokeWidth={1.5} />
        </button>
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        statuses={statuses}
        loading={bulkUpdateStatus.isPending || bulkDeleteCouples.isPending}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkStatusChange={handleBulkStatusChange}
        onDeleteClick={() => setBulkDeleteOpen(true)}
        onExportCSV={handleExportCSV}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? "couple" : "couples"}?`}
        description="This action cannot be undone."
        loading={bulkDeleteCouples.isPending}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
