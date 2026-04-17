"use client";

import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { Couple, CoupleStatusRecord } from "./couples-types";
import { KanbanColumn } from "./kanban-column";

interface CouplesKanbanProps {
  couples: Couple[];
  statuses: CoupleStatusRecord[];
  onCardClick: (couple: Couple) => void;
  onDragEnd: (
    source: string,
    destination: string,
    destinationIndex: number,
    coupleId: string
  ) => void;
  onAddClick?: (statusSlug: string) => void;
}

export function CouplesKanban({
  couples,
  statuses,
  onCardClick,
  onDragEnd,
  onAddClick,
}: CouplesKanbanProps) {
  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    onDragEnd(
      source.droppableId,
      destination.droppableId,
      destination.index,
      draggableId
    );
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col sm:flex-row pb-4 sm:items-stretch sm:min-h-full gap-px sm:gap-0">
        {statuses.map((status, index) => (
          <div key={status.id} className="flex flex-col sm:flex-row sm:items-stretch w-full sm:w-auto">
            {index > 0 && <div className="hidden sm:block w-px bg-gray-100 self-stretch mx-1" />}
            <KanbanColumn
              status={status}
              couples={couples.filter((c) => c.status === status.slug)}
              onCardClick={onCardClick}
              onAddClick={onAddClick}
            />
            {index < statuses.length - 1 && (
              <div className="sm:hidden h-px bg-gray-100 mx-3" />
            )}
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
