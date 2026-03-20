"use client";

import { useEffect, useState, useMemo } from "react";
import {
  useCouples,
  useCreateCouple,
  useUpdateCouple,
  useDeleteCouple,
} from "./use-couples";
import { CouplesHeader } from "./couples-header";
import { CouplesList } from "./couples-list";
import { CouplesKanban } from "./couples-kanban";
import { CouplesCalendar } from "./couples-calendar";
import { CoupleModal } from "./couple-modal";
import { CoupleProfile } from "./couple-profile";
import {
  Couple,
  ViewMode,
  CoupleStatus,
  SortField,
  SortDirection,
} from "./couples-types";

export default function CouplesPage() {
  const { data: couples, isLoading } = useCouples();
  const createCouple = useCreateCouple();
  const updateCouple = useUpdateCouple();
  const deleteCouple = useDeleteCouple();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CoupleStatus | "all">("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCouple, setEditingCouple] = useState<Couple | undefined>();
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<CoupleStatus | undefined>();

  useEffect(() => {
    const saved = localStorage.getItem("zebri_couples_view");
    if (saved === "kanban" || saved === "list" || saved === "calendar") {
      setViewMode(saved as ViewMode);
    }
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("zebri_couples_view", mode);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setEditingCouple(undefined);
          setDefaultStatus(undefined);
          setModalOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredCouples = useMemo(() => {
    const filtered = couples.filter((couple) => {
      const matchesSearch =
        search === "" ||
        couple.name.toLowerCase().includes(search.toLowerCase()) ||
        couple.email.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || couple.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }, [couples, search, statusFilter, sortField, sortDirection]);

  const handleSaveCouple = async (
    data: Omit<Couple, "id" | "user_id" | "created_at"> & { id?: string }
  ) => {
    if (data.id && editingCouple) {
      const updated = { ...editingCouple, ...data };
      await updateCouple.mutateAsync(updated);
      // If the profile panel is open for this couple, update it with fresh data
      if (selectedCouple?.id === data.id) {
        setSelectedCouple(updated);
      }
    } else {
      await createCouple.mutateAsync(data);
    }
    setModalOpen(false);
    setEditingCouple(undefined);
  };

  const handleDeleteCouple = async (id: string) => {
    await deleteCouple.mutateAsync(id);
    setModalOpen(false);
    setEditingCouple(undefined);
    if (selectedCouple?.id === id) {
      setSelectedCouple(null);
    }
  };

  const handleDragEnd = async (
    source: string,
    destination: string,
    coupleId: string
  ) => {
    if (source === destination) return;

    const couple = couples.find((c) => c.id === coupleId);
    if (!couple) return;

    await updateCouple.mutateAsync({
      ...couple,
      status: destination as CoupleStatus,
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-3 flex-shrink-0">
        <CouplesHeader
          couples={couples}
          onAddClick={() => {
            setEditingCouple(undefined);
            setDefaultStatus(undefined);
            setModalOpen(true);
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

      <div className={`flex-1 min-h-0 overflow-hidden px-6 ${viewMode !== 'list' ? 'pb-14' : ''}`}>
        {viewMode === "list" ? (
          <CouplesList
            couples={filteredCouples}
            onRowClick={(couple) => setSelectedCouple(couple)}
            loading={isLoading}
          />
        ) : viewMode === "kanban" ? (
          <div className="overflow-x-auto overflow-y-auto h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <CouplesKanban
              couples={filteredCouples}
              onCardClick={(couple) => setSelectedCouple(couple)}
              onDragEnd={handleDragEnd}
              onAddClick={(status) => {
                setEditingCouple(undefined);
                setDefaultStatus(status as CoupleStatus);
                setModalOpen(true);
              }}
            />
          </div>
        ) : (
          <CouplesCalendar
            onSelectCouple={(coupleId) => {
              const couple = couples.find((c) => c.id === coupleId);
              if (couple) setSelectedCouple(couple);
            }}
          />
        )}
      </div>

      {/* Profile slide-over (z-40/50) — stays open behind the edit modal */}
      <CoupleProfile
        couple={selectedCouple}
        onClose={() => setSelectedCouple(null)}
        onEdit={(couple) => {
          setEditingCouple(couple);
          setModalOpen(true);
        }}
      />

      {/* Edit/Add modal (z-50/60) — opens on top of everything */}
      <CoupleModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCouple(undefined);
        }}
        onSave={handleSaveCouple}
        onDelete={handleDeleteCouple}
        couple={editingCouple}
        defaultStatus={defaultStatus}
        loading={
          createCouple.isPending ||
          updateCouple.isPending ||
          deleteCouple.isPending
        }
      />
    </div>
  );
}
