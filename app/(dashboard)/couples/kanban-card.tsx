"use client";

import { Draggable } from "@hello-pangea/dnd";
import { Couple } from "./couples-types";
import { formatDate } from "@/lib/utils";

interface KanbanCardProps {
  couple: Couple;
  index: number;
  onClick: () => void;
}

export function KanbanCard({ couple, index, onClick }: KanbanCardProps) {
  return (
    <Draggable draggableId={couple.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-white rounded-lg px-3 py-2.5 shadow-sm transition cursor-pointer ${
            snapshot.isDragging
              ? "shadow-lg rotate-1 scale-[1.02]"
              : "hover:shadow-md"
          }`}
        >
          <div className="font-medium text-sm text-gray-900">{couple.name}</div>

          {(couple.event_date || couple.venue) && (
            <div className="mt-1 text-xs text-gray-400 space-y-0.5">
              {couple.event_date && <div>{formatDate(couple.event_date)}</div>}
              {couple.venue && <div className="truncate">{couple.venue}</div>}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
