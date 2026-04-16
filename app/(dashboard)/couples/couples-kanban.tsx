"use client";

import { memo } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { Couple, CoupleStatusRecord } from "./couples-types";
import { KanbanColumn } from "./kanban-column";

interface CouplesKanbanProps {
  couples: Couple[];
  statuses: CoupleStatusRecord[];
  onCardClick: (couple: Couple) => void;
  onDragEnd: (source: string, destination: string, coupleId: string) => void;
  onAddClick?: (statusSlug: string) => void;
}

const MemoKanbanColumn = memo(KanbanColumn);

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

    onDragEnd(source.droppableId, destination.droppableId, draggableId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex pb-4 items-start">
        {statuses.map((status, index) => (
          <div key={status.id} className="flex items-start">
            {index > 0 && <div className="w-px bg-gray-100 self-stretch mx-1" />}
            <MemoKanbanColumn
              status={status}
              couples={couples.filter((c) => c.status === status.slug)}
              onCardClick={onCardClick}
              onAddClick={onAddClick}
            />
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
