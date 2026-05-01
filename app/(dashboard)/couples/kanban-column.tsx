"use client";

import { useState } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Plus, ChevronDown } from "lucide-react";
import {
  Couple,
  CoupleStatusRecord,
  getStatusClasses,
} from "./couples-types";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  status: CoupleStatusRecord;
  couples: Couple[];
  onCardInteract: (couple: Couple, e: React.MouseEvent) => void;
  onAddClick?: (statusSlug: string) => void;
  selectedIds: Set<string>;
  activeDrag: { draggableId: string; movingIds: Set<string>; movingCouples: Couple[] } | null;
}

export function KanbanColumn({
  status,
  couples,
  onCardInteract,
  onAddClick,
  selectedIds,
  activeDrag,
}: KanbanColumnProps) {
  const classes = getStatusClasses(status.color);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="w-full sm:w-64 shrink-0 sm:rounded-xl px-0 py-2 sm:p-3 sm:flex sm:flex-col">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <button
          className="sm:hidden text-gray-400 transition cursor-pointer"
          onClick={() => setCollapsed((c) => !c)}
        >
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
        </button>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-md ${classes.pill}`}
        >
          {status.name}
        </span>
        <span className="text-xs text-gray-300 flex-1">{couples.length}</span>
        <button
          onClick={() => onAddClick?.(status.slug)}
          className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
      </div>
      {!collapsed && (
        <Droppable droppableId={status.slug}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="min-h-[120px] sm:min-h-0 sm:flex-1 pb-4"
            >
              {couples.map((couple, index) => (
                <KanbanCard
                  key={couple.id}
                  couple={couple}
                  index={index}
                  isSelected={selectedIds.has(couple.id)}
                  onClick={(e) => onCardInteract(couple, e)}
                  activeDrag={activeDrag}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}
