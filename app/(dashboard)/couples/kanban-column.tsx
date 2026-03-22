"use client";

import { Droppable } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import {
  Couple,
  CoupleStatusRecord,
  getStatusClasses,
} from "./couples-types";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  status: CoupleStatusRecord;
  couples: Couple[];
  onCardClick: (couple: Couple) => void;
  onAddClick?: (statusSlug: string) => void;
}

export function KanbanColumn({
  status,
  couples,
  onCardClick,
  onAddClick,
}: KanbanColumnProps) {
  const classes = getStatusClasses(status.color);
  const hoverColorMap: Record<string, string> = {
    amber: "hover:bg-amber-600",
    blue: "hover:bg-blue-600",
    purple: "hover:bg-purple-600",
    emerald: "hover:bg-emerald-600",
    gray: "hover:bg-gray-500",
    green: "hover:bg-green-600",
    red: "hover:bg-red-600",
    orange: "hover:bg-orange-600",
    pink: "hover:bg-pink-600",
    indigo: "hover:bg-indigo-600",
  };

  return (
    <div className="w-64 shrink-0 bg-gray-50 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-md ${classes.pill}`}
        >
          {status.name}
        </span>
        <span className="text-xs text-gray-300">{couples.length}</span>
      </div>
      <Droppable droppableId={status.slug}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[2px] ${couples.length > 0 ? "space-y-2 mb-2" : "mb-2"}`}
          >
            {couples.map((couple, index) => (
              <KanbanCard
                key={couple.id}
                couple={couple}
                index={index}
                onClick={() => onCardClick(couple)}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <button
        onClick={() => onAddClick?.(status.slug)}
        className={`w-full flex items-center justify-center gap-1 text-sm text-gray-400 transition py-1.5 rounded-full border ${classes.border} bg-white ${hoverColorMap[status.color] || "hover:bg-gray-50"} hover:text-white cursor-pointer`}
      >
        <Plus size={14} strokeWidth={1.5} />
        New
      </button>
    </div>
  );
}
