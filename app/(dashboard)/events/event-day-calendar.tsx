"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  useDraggable,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { TimelineItem } from "./events-types";
import { CATEGORY_LABELS } from "../contacts/contacts-types";
import { EventTimelineModal } from "./event-timeline-modal";
import { EventTimelineShare } from "./event-timeline-share";

const HOUR_HEIGHT = 80; // px per hour
const MIN_PX = HOUR_HEIGHT / 60;
const SNAP_MIN = 15;
const GRID_OFFSET = 6 * 60; // grid starts at 6am (360 min from midnight)
const TOTAL_HEIGHT = 24 * 60 * MIN_PX; // 1920px — always full 24h

// Hours displayed: 6, 7, … 23, 0, 1, 2, 3, 4, 5, 6
const HOURS: number[] = [];
for (let i = 0; i <= 24; i++) HOURS.push((i + 6) % 24);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Converts HH:MM → pixel position in the 6am-based grid
function timeToGridMinutes(time: string): number {
  const m = timeToMinutes(time);
  return m >= GRID_OFFSET ? m - GRID_OFFSET : m + (24 * 60 - GRID_OFFSET);
}

// Converts a grid pixel offset (in minutes) back to HH:MM, snapped to 15 min
function gridMinutesToTime(gridMins: number): string {
  const snapped = Math.round(gridMins / SNAP_MIN) * SNAP_MIN;
  const clamped = Math.max(0, Math.min(24 * 60 - SNAP_MIN, snapped));
  const actualMins = (clamped + GRID_OFFSET) % (24 * 60);
  const h = Math.floor(actualMins / 60);
  const m = actualMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

// ─── Draggable event card ────────────────────────────────────────────────────

function computeColumns(
  items: TimelineItem[]
): Map<string, { col: number; totalCols: number }> {
  const result = new Map<string, { col: number; totalCols: number }>();
  if (items.length === 0) return result;

  const sorted = [...items].sort(
    (a, b) => timeToGridMinutes(a.start_time!) - timeToGridMinutes(b.start_time!)
  );

  let i = 0;
  while (i < sorted.length) {
    const group = [sorted[i]];
    let maxEnd =
      timeToGridMinutes(sorted[i].start_time!) + (sorted[i].duration_min ?? 60);

    let j = i + 1;
    while (j < sorted.length) {
      const jStart = timeToGridMinutes(sorted[j].start_time!);
      if (jStart < maxEnd) {
        group.push(sorted[j]);
        maxEnd = Math.max(maxEnd, jStart + (sorted[j].duration_min ?? 60));
        j++;
      } else {
        break;
      }
    }

    const colEnds: number[] = [];
    for (const item of group) {
      const itemStart = timeToGridMinutes(item.start_time!);
      const itemEnd = itemStart + (item.duration_min ?? 60);
      let assigned = colEnds.findIndex((end) => end <= itemStart);
      if (assigned === -1) {
        assigned = colEnds.length;
        colEnds.push(itemEnd);
      } else {
        colEnds[assigned] = itemEnd;
      }
      result.set(item.id, { col: assigned, totalCols: -1 });
    }

    const totalCols = colEnds.length;
    for (const item of group) {
      result.set(item.id, { ...result.get(item.id)!, totalCols });
    }
    i = j;
  }
  return result;
}

interface DraggableEventProps {
  item: TimelineItem;
  col: number;
  totalCols: number;
  onEdit: (item: TimelineItem) => void;
  onResize: (id: string, newDuration: number) => void;
}

function DraggableEvent({ item, col, totalCols, onEdit, onResize }: DraggableEventProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
    });

  const [resizeDelta, setResizeDelta] = useState(0);
  const resizing = useRef(false);
  const resizeStartY = useRef(0);
  const resizeStartDuration = useRef(0);

  const topPx = timeToGridMinutes(item.start_time!) * MIN_PX;
  const baseDuration = item.duration_min ?? 60;
  const liveDuration = Math.max(SNAP_MIN, baseDuration + resizeDelta);
  const heightPx = Math.max(liveDuration * MIN_PX, 44);

  const GAP = 4; // px between columns
  const colLeft =
    totalCols === 1
      ? "10px"
      : `calc(10px + ${col} * ((100% - 20px + ${GAP}px) / ${totalCols}))`;
  const colWidth =
    totalCols === 1
      ? "calc(100% - 20px)"
      : `calc((100% - 20px - ${GAP * (totalCols - 1)}px) / ${totalCols})`;

  const categoryLabel = item.contact?.category
    ? CATEGORY_LABELS[item.contact.category as keyof typeof CATEGORY_LABELS] ??
      item.contact.category
    : null;

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = true;
    resizeStartY.current = e.clientY;
    resizeStartDuration.current = item.duration_min ?? 60;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const handlePointerMove = (ev: PointerEvent) => {
      if (!resizing.current) return;
      const deltaY = ev.clientY - resizeStartY.current;
      const snapped = Math.round(deltaY / MIN_PX / SNAP_MIN) * SNAP_MIN;
      setResizeDelta(snapped);
    };

    const handlePointerUp = (ev: PointerEvent) => {
      if (!resizing.current) return;
      resizing.current = false;
      const deltaY = ev.clientY - resizeStartY.current;
      const snapped = Math.round(deltaY / MIN_PX / SNAP_MIN) * SNAP_MIN;
      const newDuration = Math.max(
        SNAP_MIN,
        resizeStartDuration.current + snapped
      );
      setResizeDelta(0);
      if (newDuration !== resizeStartDuration.current) {
        onResize(item.id, newDuration);
      }
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        top: topPx,
        left: colLeft,
        width: colWidth,
        height: heightPx,
        transform: `translateY(${transform?.y ?? 0}px)`,
        zIndex: isDragging ? 50 : 1,
      }}
      className={`rounded-xl border select-none transition-shadow ${
        isDragging
          ? "shadow-2xl border-gray-400 ring-2 ring-gray-200 opacity-90"
          : item.pending_review
          ? "border-dashed border-amber-300 shadow-sm cursor-grab active:cursor-grabbing opacity-60"
          : "border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 cursor-grab active:cursor-grabbing"
      } bg-white`}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging && !resizing.current) onEdit(item);
      }}
      {...attributes}
      {...listeners}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${item.pending_review ? "bg-amber-400" : "bg-gray-900"}`} />

      <div
        className="pl-3.5 pr-2 py-1.5 overflow-hidden"
        style={{ height: heightPx - 12 }}
      >
        <p className="text-xs font-semibold text-gray-900 leading-tight truncate">
          {item.title}
        </p>
        {heightPx > 50 && item.contact && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {item.contact.name}
            {categoryLabel ? ` · ${categoryLabel}` : ""}
          </p>
        )}
        {heightPx > 65 && (
          <p className="text-xs text-gray-400 mt-0.5">{liveDuration} min</p>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center group"
        onPointerDown={handleResizeStart}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-6 h-0.5 bg-gray-300 rounded group-hover:bg-gray-500 transition-colors" />
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface EventDayCalendarProps {
  eventId: string;
  hideShareLink?: boolean;
  hideUnscheduled?: boolean;
}

export function EventDayCalendar({ eventId, hideShareLink, hideUnscheduled }: EventDayCalendarProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);
  const [clickTime, setClickTime] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Grid starts at 6am — scroll to top on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, []);

  // Auto-scroll during drag only — gated on isDraggingRef
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (!scrollContainerRef.current) return;

      const container = scrollContainerRef.current;
      const rect = container.getBoundingClientRect();
      const scrollThreshold = 80;

      if (e.clientY < rect.top + scrollThreshold) {
        container.scrollTop = Math.max(0, container.scrollTop - 4);
      } else if (e.clientY > rect.bottom - scrollThreshold) {
        container.scrollTop = Math.min(
          container.scrollHeight - container.clientHeight,
          container.scrollTop + 4
        );
      }
    };

    document.addEventListener("pointermove", handlePointerMove);
    return () => document.removeEventListener("pointermove", handlePointerMove);
  }, []);

  // ── Queries ──

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["event-timeline", eventId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("timeline_items")
        .select("*, contact:contact_id(id, name, category)")
        .eq("event_id", eventId)
        .eq("user_id", user.user.id)
        .order("start_time", { ascending: true, nullsFirst: false })
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TimelineItem[];
    },
  });

  const { data: eventContacts = [] } = useQuery({
    queryKey: ["event-contacts", eventId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("event_contacts")
        .select("contact_id, contact:contact_id(id, name, category)")
        .eq("event_id", eventId)
        .eq("user_id", user.user.id);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        contact_id: string;
        contact: { id: string; name: string; category: string };
      }>;
    },
  });

  const { data: shareData } = useQuery({
    queryKey: ["event-share", eventId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("events")
        .select("share_token, share_token_enabled")
        .eq("id", eventId)
        .eq("user_id", user.user.id)
        .single();
      if (error) throw error;
      return data as {
        share_token: string | null;
        share_token_enabled: boolean;
      };
    },
  });

  const timedItems = items.filter((i) => i.start_time);
  const untimedItems = items.filter((i) => !i.start_time);

  // ── Mutations ──

  const addItem = useMutation({
    mutationFn: async (
      data: Omit<
        TimelineItem,
        "id" | "event_id" | "user_id" | "created_at" | "contact"
      >
    ) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const maxPos =
        items.length > 0 ? Math.max(...items.map((i) => i.position)) : 0;
      const { error } = await supabase.from("timeline_items").insert({
        ...data,
        event_id: eventId,
        user_id: user.user.id,
        position: maxPos + 1000,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-timeline", eventId] });
      setShowModal(false);
      toast("Item added");
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<TimelineItem> & { id: string }) => {
      const { error } = await supabase
        .from("timeline_items")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-timeline", eventId] });
      setShowModal(false);
      setEditingItem(null);
      toast("Item updated");
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("timeline_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-timeline", eventId] });
      setShowModal(false);
      setEditingItem(null);
      toast("Item deleted");
    },
  });

  const toggleShare = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("events")
        .update({ share_token_enabled: enabled })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["event-share", eventId] });
      toast(enabled ? "Share link enabled" : "Share link disabled");
    },
  });

  const regenerateToken = useMutation({
    mutationFn: async () => {
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("events")
        .update({ share_token: newToken })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-share", eventId] });
      toast("Link regenerated");
    },
  });

  // ── Handlers ──

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      isDraggingRef.current = false;
      const { active, delta } = event;
      const item = items.find((i) => i.id === active.id);
      if (!item?.start_time) return;

      const minutesDelta = delta.y / MIN_PX;
      const newTime = gridMinutesToTime(
        timeToGridMinutes(item.start_time) + minutesDelta
      );

      if (newTime === item.start_time) return;

      queryClient.setQueryData(
        ["event-timeline", eventId],
        (old: TimelineItem[] = []) =>
          old.map((i) => (i.id === item.id ? { ...i, start_time: newTime } : i))
      );
      updateItem.mutate({ id: item.id, start_time: newTime });

      // Scroll to keep dropped item visible
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const itemTopPx = timeToGridMinutes(newTime) * MIN_PX;
        const itemBottomPx = itemTopPx + (item.duration_min ?? 60) * MIN_PX;
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        if (itemTopPx < scrollTop) {
          container.scrollTop = Math.max(0, itemTopPx - 20);
        } else if (itemBottomPx > scrollTop + containerHeight) {
          container.scrollTop = Math.max(
            0,
            itemBottomPx - containerHeight + 20
          );
        }
      }
    },
    [items, updateItem, queryClient, eventId]
  );

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    const newTime = gridMinutesToTime(y / MIN_PX);
    setClickTime(newTime);
    setEditingItem(null);
    setShowModal(true);
  }, []);

  const handleResize = useCallback(
    (id: string, newDuration: number) => {
      queryClient.setQueryData(
        ["event-timeline", eventId],
        (old: TimelineItem[] = []) =>
          old.map((i) =>
            i.id === id ? { ...i, duration_min: newDuration } : i
          )
      );
      updateItem.mutate({ id, duration_min: newDuration });
    },
    [updateItem, queryClient, eventId]
  );

  const handleSave = (
    data: Omit<
      TimelineItem,
      "id" | "event_id" | "user_id" | "created_at" | "contact"
    >
  ) => {
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, ...data });
    } else {
      addItem.mutate(data);
    }
  };

  const mutating =
    addItem.isPending || updateItem.isPending || deleteItem.isPending;

  // ── Render ──

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        {/* + Add item */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Click anywhere on the grid to add an item, or drag to reschedule.
          </p>
          <button
            onClick={() => {
              setEditingItem(null);
              setClickTime("");
              setShowModal(true);
            }}
            className="text-xs text-gray-700 border border-gray-200 rounded-xl px-2.5 py-1 hover:bg-gray-50 transition cursor-pointer flex-shrink-0 ml-4"
          >
            + Add item
          </button>
        </div>

        {/* Grid + unscheduled side by side */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Scrollable grid container */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded-xl bg-white min-w-0"
          >
            <DndContext
              sensors={sensors}
              onDragStart={() => {
                isDraggingRef.current = true;
              }}
              onDragEnd={handleDragEnd}
            >
              {/* Padding wrapper — no position:relative so absolute event coords are unaffected */}
              <div className="pt-4 pb-6">
                <div className="flex select-none">
                  {/* Hour labels */}
                  <div
                    className="relative flex-shrink-0 w-14"
                    style={{ height: TOTAL_HEIGHT }}
                  >
                    {HOURS.map((hour, idx) => (
                      <div
                        key={idx}
                        className="absolute right-3"
                        style={{ top: idx * 60 * MIN_PX - 9 }}
                      >
                        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                          {formatHourLabel(hour)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Grid + events */}
                  <div
                    ref={gridRef}
                    className="flex-1 relative border-l border-gray-200 cursor-crosshair"
                    style={{ height: TOTAL_HEIGHT }}
                    onClick={handleGridClick}
                  >
                    {/* Hour lines */}
                    {HOURS.map((_, idx) => (
                      <div
                        key={`h-${idx}`}
                        className="absolute left-0 right-0 border-t border-gray-200"
                        style={{ top: idx * 60 * MIN_PX }}
                      />
                    ))}

                    {/* Half-hour lines */}
                    {HOURS.slice(0, -1).map((_, idx) => (
                      <div
                        key={`hh-${idx}`}
                        className="absolute left-0 right-0 border-t border-gray-100"
                        style={{ top: (idx * 60 + 30) * MIN_PX }}
                      />
                    ))}

                    {/* Event blocks */}
                    {(() => {
                      const colMap = computeColumns(timedItems);
                      return timedItems.map((item) => {
                        const layout = colMap.get(item.id) ?? { col: 0, totalCols: 1 };
                        return (
                          <DraggableEvent
                            key={item.id}
                            item={item}
                            col={layout.col}
                            totalCols={layout.totalCols}
                            onEdit={(i) => {
                              setEditingItem(i);
                              setClickTime("");
                              setShowModal(true);
                            }}
                            onResize={handleResize}
                          />
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </DndContext>
          </div>

          {/* Unscheduled items — right column */}
          {!hideUnscheduled && untimedItems.length > 0 && (
            <div className="w-44 flex-shrink-0 overflow-y-auto min-h-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Unscheduled
              </p>
              <div className="space-y-2">
                {untimedItems.map((item) => {
                  const catLabel = item.contact?.category
                    ? CATEGORY_LABELS[
                        item.contact.category as keyof typeof CATEGORY_LABELS
                      ] ?? item.contact.category
                    : null;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setEditingItem(item);
                        setClickTime("");
                        setShowModal(true);
                      }}
                      className="flex flex-col gap-0.5 px-3 py-2.5 border border-dashed border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition cursor-pointer"
                    >
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {item.title}
                      </p>
                      {item.contact && (
                        <p className="text-xs text-gray-400 truncate">
                          {item.contact.name}
                          {catLabel ? ` · ${catLabel}` : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Close flex row */}
        </div>

        {/* Share link */}
        {!hideShareLink && (
          <div className="shrink-0 border-t border-gray-100 py-4">
            <EventTimelineShare
              shareToken={shareData?.share_token}
              shareEnabled={shareData?.share_token_enabled ?? false}
              onToggle={(enabled) => toggleShare.mutate(enabled)}
              onRegenerate={() => regenerateToken.mutate()}
              loading={toggleShare.isPending || regenerateToken.isPending}
            />
          </div>
        )}
      </div>

      <EventTimelineModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
          setClickTime("");
        }}
        onSave={handleSave}
        onDelete={
          editingItem ? () => deleteItem.mutate(editingItem.id) : undefined
        }
        item={editingItem}
        initialTime={clickTime}
        eventContacts={eventContacts}
        loading={mutating}
      />
    </>
  );
}
