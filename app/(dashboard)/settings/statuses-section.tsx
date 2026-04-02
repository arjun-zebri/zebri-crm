"use client";

import { useState, useEffect } from "react";
import { GripVertical, Trash2, Plus, ChevronDown } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Modal } from "@/components/ui/modal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCoupleStatuses,
  useCreateStatus,
  useUpdateStatus,
  useDeleteStatus,
  useReorderStatuses,
} from "@/app/(dashboard)/couples/use-couple-statuses";
import {
  CoupleStatusRecord,
  COLOR_PALETTE,
  getStatusClasses,
} from "@/app/(dashboard)/couples/couples-types";
import { useToast } from "@/components/ui/toast";

function StatusRow({
  status,
  onUpdate,
  onDelete,
}: {
  status: CoupleStatusRecord;
  onUpdate: (status: CoupleStatusRecord) => void;
  onDelete: (statusId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });
  const [colorOpen, setColorOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? transition.replace('all', 'transform') : undefined,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  const classes = getStatusClasses(status.color);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-xl border bg-white transition-colors ${
        isDragging
          ? "border-gray-300 bg-gray-50 shadow-lg"
          : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical size={16} />
      </button>

      <input
        type="text"
        value={status.name}
        onChange={(e) => onUpdate({ ...status, name: e.target.value })}
        className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200"
        placeholder="Status name"
      />

      <Popover.Root open={colorOpen} onOpenChange={setColorOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="shrink-0 flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm"
          >
            <div className={`w-3 h-3 rounded-full ${classes.dot}`} />
            <ChevronDown size={14} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-[9999]"
            sideOffset={4}
            align="end"
          >
            <div className="grid grid-cols-5 gap-2">
              {COLOR_PALETTE.map((color) => {
                const colorClasses = getStatusClasses(color);
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onUpdate({ ...status, color });
                      setColorOpen(false);
                    }}
                    className={`w-6 h-6 rounded-full border-2 transition ${
                      status.color === color
                        ? "border-black"
                        : "border-gray-300"
                    } ${colorClasses.dot}`}
                    title={color}
                  />
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <button
        type="button"
        onClick={() => onDelete(status.id)}
        className="shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function StatusesSection() {
  const { data: statuses, isLoading } = useCoupleStatuses();
  const createStatus = useCreateStatus();
  const updateStatus = useUpdateStatus();
  const deleteStatus = useDeleteStatus();
  const reorderStatuses = useReorderStatuses();

  const { toast } = useToast();
  const [localStatuses, setLocalStatuses] =
    useState<CoupleStatusRecord[]>(statuses);
  const [hasChanges, setHasChanges] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState<string>("blue");
  const [newColorOpen, setNewColorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setLocalStatuses(statuses);
    setHasChanges(false);
  }, [statuses.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localStatuses.findIndex((s) => s.id === active.id);
    const newIndex = localStatuses.findIndex((s) => s.id === over.id);

    const reordered = arrayMove(localStatuses, oldIndex, newIndex);
    setLocalStatuses(reordered);
    setHasChanges(true);
  };

  const handleUpdateStatus = (status: CoupleStatusRecord) => {
    setLocalStatuses((prev) =>
      prev.map((s) => (s.id === status.id ? status : s))
    );
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await reorderStatuses.mutateAsync(localStatuses);

      for (const status of localStatuses) {
        const originalStatus = statuses.find((s) => s.id === status.id);
        if (
          originalStatus &&
          (originalStatus.name !== status.name ||
            originalStatus.color !== status.color)
        ) {
          await updateStatus.mutateAsync(status);
        }
      }

      setHasChanges(false);
      toast("Statuses saved.");
    } catch (err: any) {
      toast(err.message || "Failed to save changes", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    try {
      await deleteStatus.mutateAsync(statusId);
      setLocalStatuses((prev) => prev.filter((s) => s.id !== statusId));
    } catch (err: any) {
      toast(err.message || "Failed to delete status", "error");
    }
  };

  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusName.trim()) return;

    setIsCreating(true);
    try {
      await createStatus.mutateAsync({
        name: newStatusName,
        color: newStatusColor,
      });
      setNewStatusName("");
      setNewStatusColor("blue");
      setIsModalOpen(false);
      toast("Status created.");
    } catch (err: any) {
      toast(err.message || "Failed to create status", "error");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Manage Statuses
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Customise the statuses that appear in your couples kanban board.
            </p>
          </div>
          {hasChanges && (
            <button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 text-sm font-medium"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localStatuses.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {localStatuses.map((status) => (
                <StatusRow
                  key={status.id}
                  status={status}
                  onUpdate={handleUpdateStatus}
                  onDelete={handleDeleteStatus}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="border-t border-gray-200 pt-6 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Add New Status</h4>
          <p className="text-xs text-gray-600 mt-1">
            Create a new status for your workflow
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition text-sm font-medium flex items-center gap-2"
        >
          <Plus size={16} />
          Add Status
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setNewStatusName("");
          setNewStatusColor("blue");
        }}
        title="Add New Status"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setIsModalOpen(false);
                setNewStatusName("");
                setNewStatusColor("blue");
              }}
              disabled={isCreating}
              className="text-sm px-4 py-2 rounded-xl bg-gray-100 text-gray-900 hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateStatus}
              disabled={isCreating || !newStatusName.trim()}
              className="text-sm px-4 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateStatus} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              placeholder="e.g., Inquiry, Interested, Engaged"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-200"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <Popover.Root open={newColorOpen} onOpenChange={setNewColorOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-sm"
                >
                  <div
                    className={`w-5 h-5 rounded-full ${
                      getStatusClasses(newStatusColor).dot
                    }`}
                  />
                  <span className="text-gray-900 capitalize">
                    {newStatusColor}
                  </span>
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-[9999]"
                  sideOffset={4}
                  align="start"
                >
                  <div className="grid grid-cols-5 gap-2">
                    {COLOR_PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setNewStatusColor(color);
                          setNewColorOpen(false);
                        }}
                        className={`w-6 h-6 rounded-full border-2 transition ${
                          newStatusColor === color
                            ? "border-black"
                            : "border-gray-300"
                        } ${getStatusClasses(color).dot}`}
                        title={color}
                      />
                    ))}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </form>
      </Modal>
    </div>
  );
}
