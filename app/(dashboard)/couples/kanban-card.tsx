"use client";

import {
  Draggable,
  DraggingStyle,
  NotDraggingStyle,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { Couple } from "./couples-types";
import { formatDate } from "@/lib/utils";

interface KanbanCardProps {
  couple: Couple;
  index: number;
  onClick: () => void;
}

function getDragStyle(
  style: DraggingStyle | NotDraggingStyle | undefined,
  snapshot: DraggableStateSnapshot
) {
  if (!style) return undefined;
  if (snapshot.isDropAnimating) {
    return { ...style, transitionDuration: "0.001s" };
  }
  return style;
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
          style={getDragStyle(provided.draggableProps.style, snapshot)}
          className={`group flex items-start gap-1.5 cursor-pointer px-3 py-2.5 mb-2 last:mb-0 border border-gray-200 rounded-xl bg-white select-none ${
            snapshot.isDragging ? "shadow-lg opacity-90" : ""
          }`}
        >
          <div className="hidden sm:block mt-0.5 shrink-0 text-gray-300 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none">
            <GripVertical size={14} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm text-gray-900">
              {couple.name}
            </div>
            {(couple.event_date || couple.venue) && (
              <div className="mt-1 text-xs text-gray-400 space-y-0.5">
                {couple.event_date && (
                  <div>{formatDate(couple.event_date)}</div>
                )}
                {couple.venue && <div className="truncate">{couple.venue}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
