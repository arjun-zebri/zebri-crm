"use client";

import { DragDropContext, DragStart, DropResult } from "@hello-pangea/dnd";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
    coupleId: string,
    selectedAtStart: Set<string>
  ) => void;
  onAddClick?: (statusSlug: string) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function CouplesKanban({
  couples,
  statuses,
  onCardClick,
  onDragEnd,
  onAddClick,
  selectedIds,
  onSelectionChange,
}: CouplesKanbanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const justDraggedRef = useRef(false);
  const lastClickedIdRef = useRef<string | null>(null);
  const dndSelectionSnapshotRef = useRef<Set<string>>(new Set());
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ draggableId: string; movingIds: Set<string>; movingCouples: Couple[] } | null>(null);

  // Flat visual order: column-by-column, top-to-bottom within each column
  const orderedCouples = statuses.flatMap((status) =>
    couples.filter((c) => c.status === status.slug)
  );

  const handleBeforeDragStart = (start: DragStart) => {
    const movingIds = selectedIds.has(start.draggableId)
      ? new Set(selectedIds)
      : new Set([start.draggableId]);
    dndSelectionSnapshotRef.current = movingIds;
    const movingCouples = couples.filter((c) => movingIds.has(c.id));
    setActiveDrag({ draggableId: start.draggableId, movingIds, movingCouples });
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    const snapshot = dndSelectionSnapshotRef.current;
    dndSelectionSnapshotRef.current = new Set();
    setActiveDrag(null);
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
      draggableId,
      snapshot
    );
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        isDraggingRef.current = true;
        document.body.style.userSelect = "none";
        const newRect = {
          x: Math.min(e.clientX, dragStartRef.current.x),
          y: Math.min(e.clientY, dragStartRef.current.y),
          w: Math.abs(dx),
          h: Math.abs(dy),
        };
        dragRectRef.current = newRect;
        setDragRect(newRect);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current && dragRectRef.current) {
        const r = dragRectRef.current;
        const cards = containerRef.current?.querySelectorAll<HTMLElement>("[data-couple-id]");
        if (cards) {
          const newSelected = new Set(selectedIds);
          cards.forEach((card) => {
            const cardRect = card.getBoundingClientRect();
            if (
              cardRect.left < r.x + r.w &&
              cardRect.right > r.x &&
              cardRect.top < r.y + r.h &&
              cardRect.bottom > r.y
            ) {
              const coupleId = card.getAttribute("data-couple-id");
              if (coupleId) newSelected.add(coupleId);
            }
          });
          onSelectionChange(newSelected);
        }
        justDraggedRef.current = true;
        setTimeout(() => (justDraggedRef.current = false), 100);

        const suppressNextClick = (e: MouseEvent) => {
          e.stopImmediatePropagation();
          window.removeEventListener("click", suppressNextClick, true);
        };
        window.addEventListener("click", suppressNextClick, true);
        setTimeout(
          () => window.removeEventListener("click", suppressNextClick, true),
          250
        );
      }
      dragStartRef.current = null;
      isDraggingRef.current = false;
      dragRectRef.current = null;
      document.body.style.userSelect = "";
      setDragRect(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [selectedIds, onSelectionChange]);

  const handleCardInteract = (couple: Couple, e: React.MouseEvent) => {
    e.stopPropagation();
    if (justDraggedRef.current) return;

    if (e.shiftKey) {
      e.preventDefault();
      const lastId = lastClickedIdRef.current;
      const lastIdx = lastId ? orderedCouples.findIndex((c) => c.id === lastId) : -1;
      const curIdx = orderedCouples.findIndex((c) => c.id === couple.id);
      const start = lastIdx >= 0 ? Math.min(lastIdx, curIdx) : curIdx;
      const end = lastIdx >= 0 ? Math.max(lastIdx, curIdx) : curIdx;
      const newSelected = new Set(selectedIds);
      for (let i = start; i <= end; i++) {
        newSelected.add(orderedCouples[i].id);
      }
      onSelectionChange(newSelected);
      lastClickedIdRef.current = couple.id;
      return;
    }

    if (selectedIds.size > 0) {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(couple.id)) newSelected.delete(couple.id);
      else newSelected.add(couple.id);
      onSelectionChange(newSelected);
    } else {
      onCardClick(couple);
    }
    lastClickedIdRef.current = couple.id;
  };

  return (
    <DragDropContext onBeforeDragStart={handleBeforeDragStart} onDragEnd={handleDragEnd}>
      <div
        ref={containerRef}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("[data-couple-id]")) return;
          if (target.tagName === "INPUT" || target.tagName === "BUTTON") return;
          if (e.shiftKey) e.preventDefault();
          dragStartRef.current = { x: e.clientX, y: e.clientY };
        }}
        className="flex flex-col sm:flex-row pb-4 sm:items-stretch sm:min-h-full gap-px sm:gap-0 select-none"
      >
        {statuses.map((status, index) => (
          <div key={status.id} className="flex flex-col sm:flex-row sm:items-stretch w-full sm:w-auto">
            {index > 0 && <div className="hidden sm:block w-px bg-gray-100 self-stretch mx-1" />}
            <KanbanColumn
              status={status}
              couples={couples.filter((c) => c.status === status.slug)}
              onCardInteract={handleCardInteract}
              onAddClick={onAddClick}
              selectedIds={selectedIds}
              activeDrag={activeDrag}
            />
            {index < statuses.length - 1 && (
              <div className="sm:hidden h-px bg-gray-100 mx-3" />
            )}
          </div>
        ))}
      </div>
      {dragRect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: dragRect.x,
              top: dragRect.y,
              width: dragRect.w,
              height: dragRect.h,
              background: "rgba(0,0,0,0.06)",
              border: "1px solid rgba(0,0,0,0.2)",
              borderRadius: 3,
              pointerEvents: "none",
              zIndex: 9999,
            }}
          />,
          document.body
        )}
    </DragDropContext>
  );
}
