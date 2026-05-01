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
  isSelected?: boolean;
  onClick: (e: React.MouseEvent) => void;
  activeDrag: { draggableId: string; movingIds: Set<string>; movingCouples: Couple[] } | null;
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

function CardBody({ couple }: { couple: Couple }) {
  return (
    <>
      <div className="hidden sm:block mt-0.5 shrink-0 text-gray-300">
        <GripVertical size={14} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm text-gray-900">{couple.name}</div>
        {(couple.event_date || couple.venue) && (
          <div className="mt-1 text-xs text-gray-400 space-y-0.5">
            {couple.event_date && <div>{formatDate(couple.event_date)}</div>}
            {couple.venue && <div className="truncate">{couple.venue}</div>}
          </div>
        )}
      </div>
    </>
  );
}

export function KanbanCard({ couple, index, isSelected, onClick, activeDrag }: KanbanCardProps) {
  return (
    <Draggable draggableId={couple.id} index={index}>
      {(provided, snapshot) => {
        const isMultiDrag = !!activeDrag && activeDrag.movingIds.size > 1;
        const showStack = snapshot.isDragging && isMultiDrag;
        const isMovingButGhosted =
          !snapshot.isDragging &&
          !!activeDrag &&
          activeDrag.movingIds.has(couple.id);
        const otherMoving = showStack
          ? activeDrag!.movingCouples.filter((c) => c.id !== couple.id)
          : [];

        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            data-couple-id={couple.id}
            style={getDragStyle(provided.draggableProps.style, snapshot)}
            onClick={(e) => onClick(e)}
            className={`group flex items-start gap-1.5 cursor-pointer px-3 py-2.5 mb-2 last:mb-0 border rounded-xl select-none transition relative ${
              snapshot.isDragging
                ? "shadow-lg opacity-95 bg-white border-gray-200"
                : isMovingButGhosted
                ? "bg-gray-50 border-gray-300 opacity-40"
                : isSelected
                ? "bg-gray-50 border-gray-300"
                : "bg-white border-gray-200"
            }`}
          >
            <CardBody couple={couple} />

            {showStack && (
              <div className="absolute top-full left-0 right-0 pt-2 space-y-2 pointer-events-none">
                {otherMoving.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-1.5 px-3 py-2.5 bg-white border border-gray-200 rounded-xl shadow-lg"
                  >
                    <CardBody couple={c} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }}
    </Draggable>
  );
}
