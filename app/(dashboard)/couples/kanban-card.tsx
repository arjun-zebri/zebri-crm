"use client";

import {
  Draggable,
  DraggingStyle,
  NotDraggingStyle,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { Calendar, GripVertical, Mail, MapPin, Phone } from "lucide-react";

import { formatDate } from "@/lib/utils";
import { Couple } from '@/types/couple';

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
  // Primary partner contact, falling back to the couple-level fields for
  // pre-partner-contacts rows. Event date/venue come from the resolved
  // next event (`next_event_*`), since the couple-level columns are legacy.
  const email = couple.primary_email || couple.email;
  const phone = couple.primary_phone || couple.phone;
  const hasDetails =
    email || phone || couple.next_event_date || couple.next_event_venue;

  return (
    <>
      <div className="hidden sm:block mt-0.5 shrink-0 text-gray-300">
        <GripVertical size={14} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-body text-text">{couple.name}</div>
        {hasDetails && (
          <div className="mt-1 text-body text-text-subtle space-y-0.5">
            {email && (
              <div className="flex items-center gap-1.5 truncate">
                <Mail size={12} strokeWidth={1.5} className="shrink-0" />
                <span className="truncate">{email}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-1.5">
                <Phone size={12} strokeWidth={1.5} className="shrink-0" />
                <span className="truncate">{phone}</span>
              </div>
            )}
            {couple.next_event_date && (
              <div className="flex items-center gap-1.5">
                <Calendar size={12} strokeWidth={1.5} className="shrink-0" />
                <span>{formatDate(couple.next_event_date)}</span>
              </div>
            )}
            {couple.next_event_venue && (
              <div className="flex items-center gap-1.5 truncate">
                <MapPin size={12} strokeWidth={1.5} className="shrink-0" />
                <span className="truncate">{couple.next_event_venue}</span>
              </div>
            )}
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
            className={`group flex items-start gap-1.5 cursor-pointer px-3 py-2.5 mb-2 last:mb-0 border rounded-control select-none transition relative ${
              snapshot.isDragging
                ? "shadow-lg opacity-95 bg-surface border-border"
                : isMovingButGhosted
                ? "bg-gray-50 border-border-strong opacity-40"
                : isSelected
                ? "bg-gray-50 border-border-strong"
                : "bg-surface border-border"
            }`}
          >
            <CardBody couple={couple} />

            {showStack && (
              <div className="absolute top-full left-0 right-0 pt-2 space-y-2 pointer-events-none">
                {otherMoving.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-1.5 px-3 py-2.5 bg-surface border border-border rounded-control shadow-lg"
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
