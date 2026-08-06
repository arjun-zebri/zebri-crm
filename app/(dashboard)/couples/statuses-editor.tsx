/**
 * Couple-status editor: reorder (drag), rename, recolour, add, and delete
 * the statuses that drive the couples Kanban columns, list badges, filters,
 * and the couple-modal selector.
 *
 * Name/colour/order edits are buffered into a local draft and persisted
 * together via "Save changes"; create and delete persist immediately. All
 * persistence goes through the shared `use-couple-statuses` React Query
 * hooks, so the board behind the modal refreshes on cache invalidation.
 *
 * Rendered inside `StatusesModal` (opened from the couples header gear).
 *
 * @module app/(dashboard)/couples/statuses-editor
 */
'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import {
  useCoupleStatuses,
  useUpdateStatus,
  useDeleteStatus,
  useReorderStatuses,
} from '@/app/(dashboard)/couples/use-couple-statuses';
import { useToast } from '@/components/ui/toast';
import { CoupleStatusRecord } from '@/types/couple';

import { AddStatusModal } from './add-status-modal';
import { StatusRow } from './status-row';

interface StatusesEditorProps {
  /** Close the host modal — called immediately on save so it feels instant. */
  onClose: () => void;
}

/** The full status-management editor (list + add). */
export function StatusesEditor({ onClose }: StatusesEditorProps) {
  const { data: statuses, isLoading } = useCoupleStatuses();
  // Destructure `mutateAsync` (referentially stable) so the row callbacks
  // below can be memoised — otherwise every keystroke re-renders all rows.
  const { mutateAsync: updateStatusAsync } = useUpdateStatus();
  const { mutateAsync: deleteStatusAsync } = useDeleteStatus();
  const { mutateAsync: reorderStatusesAsync } = useReorderStatuses();

  const { toast } = useToast();
  const [localStatuses, setLocalStatuses] = useState<CoupleStatusRecord[]>(statuses);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Re-sync the local draft when statuses are added/removed (length change).
  // Depending on `statuses` itself would re-sync on every query refetch and
  // clobber mid-edit name/colour/order tweaks, which live only in the draft
  // until "Save changes".
  useEffect(() => {
    setLocalStatuses(statuses);
    setHasChanges(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localStatuses.findIndex((s) => s.id === active.id);
    const newIndex = localStatuses.findIndex((s) => s.id === over.id);

    setLocalStatuses(arrayMove(localStatuses, oldIndex, newIndex));
    setHasChanges(true);
  };

  const handleUpdateStatus = useCallback((status: CoupleStatusRecord) => {
    setLocalStatuses((prev) => prev.map((s) => (s.id === status.id ? status : s)));
    setHasChanges(true);
  }, []);

  const handleDeleteStatus = useCallback(
    async (statusId: string) => {
      try {
        await deleteStatusAsync(statusId);
        setLocalStatuses((prev) => prev.filter((s) => s.id !== statusId));
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : 'Failed to delete status', 'error');
      }
    },
    [deleteStatusAsync, toast]
  );

  // Close the modal immediately so the action feels instant, then persist the
  // draft in the background. Only re-write positions when the order actually
  // changed, and push the changed name/colour rows in parallel.
  const handleSaveChanges = () => {
    const draft = localStatuses;
    const orderChanged = draft.some((s, idx) => statuses[idx]?.id !== s.id);
    onClose();

    void (async () => {
      try {
        if (orderChanged) await reorderStatusesAsync(draft);

        await Promise.all(
          draft
            .map((status, idx) => {
              const original = statuses.find((s) => s.id === status.id);
              const changed =
                original &&
                (original.name !== status.name || original.color !== status.color);
              return changed ? updateStatusAsync({ ...status, position: idx }) : null;
            })
            .filter((p): p is Promise<CoupleStatusRecord> => p !== null)
        );

        toast('Statuses saved.');
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : 'Failed to save changes', 'error');
      }
    })();
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-surface-emphasis rounded-control" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-body text-gray-600">
        Customise the statuses that appear in your couples kanban board.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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

      <div className="border-t border-border pt-6 flex items-center justify-between gap-3">
        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-1 px-2 py-2 bg-gray-900 text-white text-caption rounded-control hover:bg-gray-700 transition cursor-pointer"
        >
          <Plus size={11} strokeWidth={2} />
          Add status
        </button>
        {hasChanges && (
          <button
            onClick={handleSaveChanges}
            className="inline-flex items-center px-2 py-2 bg-gray-900 text-white text-caption rounded-control hover:bg-gray-700 transition cursor-pointer"
          >
            Save changes
          </button>
        )}
      </div>

      <AddStatusModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
