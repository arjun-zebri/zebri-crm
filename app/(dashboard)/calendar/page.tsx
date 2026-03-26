"use client";

import { useState } from "react";
import { useCouples } from "@/app/(dashboard)/couples/use-couples";
import { CouplesCalendar } from "@/app/(dashboard)/couples/couples-calendar";
import { CoupleProfile } from "@/app/(dashboard)/couples/couple-profile";
import { CoupleModal } from "@/app/(dashboard)/couples/couple-modal";
import { useCoupleStatuses } from "@/app/(dashboard)/couples/use-couple-statuses";
import {
  useUpdateCouple,
  useDeleteCouple,
} from "@/app/(dashboard)/couples/use-couples";
import { useToast } from "@/components/ui/toast";
import { Couple } from "@/app/(dashboard)/couples/couples-types";

export default function CalendarPage() {
  const { data: couples } = useCouples();
  const { data: statuses } = useCoupleStatuses();
  const updateCouple = useUpdateCouple();
  const deleteCouple = useDeleteCouple();
  const { toast } = useToast();

  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCouple, setEditingCouple] = useState<Couple | undefined>();

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
      if (selectedCouple?.id === data.id) {
        setSelectedCouple(updated);
      }
      toast("Couple updated");
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
    toast("Couple deleted");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-3 flex-shrink-0">
        <h1 className="text-3xl font-semibold text-gray-900">Calendar</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
        <CouplesCalendar onSelectCouple={handleSelectCouple} />
      </div>

      <CoupleProfile
        couple={selectedCouple}
        onClose={() => setSelectedCouple(null)}
        onEdit={(couple) => {
          setEditingCouple(couple);
          setModalOpen(true);
        }}
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
