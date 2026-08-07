"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createBrowserClient } from "@supabase/ssr";
import { Plus, ChevronDown, GripVertical } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";

import { Modal } from "@/components/ui/modal";
import { getRgb } from "@/lib/branding/contrast";
import { FONT_STACKS } from "@/lib/branding/fonts";
import type { PublicBranding } from "@/lib/branding/public-surface";
import { STATUS_COLORS } from "@/lib/branding/status-colors";
import { roleDefaults } from "@/lib/branding/type-defaults";

import type { PortalEvent, PortalTimelineItem } from "./page";

function anonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

function formatTimeDisplay(t: string): string {
  if (!t) return "TBD";
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

const ALL_TIMES: string[] = [];

/**
 * Delete affordance colours. Destructive is a status, not a brand state, so
 * these come from the fixed error value and are composited via getRgb because
 * a hex inside rgba() is invalid CSS.
 */
const DELETE_TINT = (() => {
  const rgb = getRgb(STATUS_COLORS.error);
  return {
    border: rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)` : STATUS_COLORS.error,
  };
})();

/** Unapproved timeline card: warning outline plus a soft wash of the same value. */
const PENDING_CARD = (() => {
  const rgb = getRgb(STATUS_COLORS.warning);
  return {
    borderColor: STATUS_COLORS.warning,
    backgroundColor: rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.1)` : "transparent",
  };
})();

/** Pending-review pill, from the fixed warning value. */
const PENDING_PILL = (() => {
  const rgb = getRgb(STATUS_COLORS.warning);
  return {
    color: STATUS_COLORS.warning,
    backgroundColor: rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.2)` : "transparent",
  };
})();
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    ALL_TIMES.push(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    );
  }
}

function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      if (value) {
        const idx = ALL_TIMES.indexOf(value);
        if (idx >= 0)
          listRef.current.scrollTop = Math.max(0, (idx + 1) * 34 - 68);
      } else {
        listRef.current.scrollTop = 0;
      }
    }
  }, [open, value]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-36 border border-border rounded-control px-3 py-2 text-sm bg-surface hover:bg-surface-muted transition cursor-pointer focus:outline-none"
      >
        <span className={value ? "text-text" : "text-text-muted"}>
          {formatTimeDisplay(value)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-text-muted ml-2 flex-shrink-0" />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-36 bg-surface border border-border rounded-control shadow-lg overflow-y-auto py-1"
          style={{ maxHeight: "220px" }}
        >
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm transition hover:bg-surface-muted cursor-pointer ${
              !value ? "font-medium text-text" : "text-text-muted"
            }`}
          >
            TBD
          </button>
          {ALL_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition hover:bg-surface-muted cursor-pointer ${
                t === value
                  ? "bg-surface-muted font-medium text-text"
                  : "text-text-muted"
              }`}
            >
              {formatTimeDisplay(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function addMinutesToTime(t: string, mins: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 45, timeToMinutes(t) + mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    start_time: string | null;
    title: string;
    description: string | null;
    duration_min: number | null;
  }) => void;
  onDelete?: () => void;
  item?: PortalTimelineItem | null;
  loading: boolean;
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding;
}

function ItemModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  item,
  loading,
  branding,
}: ItemModalProps) {
  // Type scale from branding.
  const bodyDefaults = roleDefaults(branding, 'body')

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const start = item?.start_time ?? "";
      const end =
        start && item?.duration_min
          ? addMinutesToTime(start, item.duration_min)
          : start
          ? addMinutesToTime(start, 60)
          : "";
      setStartTime(start);
      setEndTime(end);
      setTitle(item?.title ?? "");
      setDescription(item?.description ?? "");
      setDeleteConfirm(false);
    }
  }, [item, isOpen]);

  const handleStartChange = (val: string) => {
    if (val && endTime) {
      const oldDuration =
        startTime && endTime
          ? timeToMinutes(endTime) - timeToMinutes(startTime)
          : 60;
      setEndTime(addMinutesToTime(val, Math.max(15, oldDuration)));
    } else if (val && !endTime) {
      setEndTime(addMinutesToTime(val, 60));
    }
    setStartTime(val);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const durationMin =
      startTime && endTime
        ? Math.max(15, timeToMinutes(endTime) - timeToMinutes(startTime))
        : null;
    onSave({
      start_time: startTime || null,
      title: title.trim(),
      description: description.trim() || null,
      duration_min: durationMin,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? "Edit moment" : "Add moment"}
      footer={
        <div className="flex items-center justify-between">
          <div>
            {onDelete && (
              <button
                onClick={() => {
                  if (!deleteConfirm) {
                    setDeleteConfirm(true);
                    return;
                  }
                  onDelete();
                }}
                disabled={loading}
                className="text-sm px-3 py-1.5 rounded-control transition cursor-pointer disabled:opacity-50 border hover:opacity-90"
                style={
                  deleteConfirm
                    ? { backgroundColor: STATUS_COLORS.error, color: "#FFFFFF", borderColor: STATUS_COLORS.error }
                    : { color: STATUS_COLORS.error, borderColor: DELETE_TINT.border }
                }
              >
                {deleteConfirm ? "Confirm delete" : "Delete"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-1.5 text-sm border border-border rounded-control hover:bg-surface-muted transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !title.trim()}
              className="px-4 py-1.5 text-sm bg-brand-fg text-text-inverse rounded-control hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div>
            <label
              className="block font-medium mb-1.5"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: bodyDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: 500,
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              From
            </label>
            <TimePicker value={startTime} onChange={handleStartChange} />
          </div>
          <span className="text-body text-text-muted pb-2">to</span>
          <div>
            <label className="block text-body font-medium text-text-subtle mb-1.5">
              To
            </label>
            <TimePicker value={endTime} onChange={setEndTime} />
          </div>
        </div>
        <div>
          <label className="block text-body font-medium text-text-subtle mb-1.5">
            What's happening <span className="text-text-subtle">(required)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bridal party entrance"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            className="w-full border border-border rounded-control px-3 py-2 text-sm bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-border/50 focus:border-border"
          />
        </div>
        <div>
          <label className="block text-body font-medium text-text-subtle mb-1.5">
            Notes
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Any details for your MC..."
            className="w-full border border-border rounded-control px-3 py-2 text-sm bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-border/50 focus:border-border resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}

interface SortableRowProps {
  item: PortalTimelineItem;
  onEdit: (item: PortalTimelineItem) => void;
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding;
}

function SortableRow({ item, onEdit, branding }: SortableRowProps) {
  const bodyDefaults = roleDefaults(branding, 'body');
  const finePrintDefaults = roleDefaults(branding, 'finePrint');
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const approved = !item.pending_review;

  return (
    <div ref={setNodeRef} style={style} className="flex gap-5 group">
      {/* Left column: time rail */}
      <div className="flex flex-col items-center">
        {/* Drag handle + time pill */}
        <button
          {...attributes}
          {...listeners}
          className="flex items-center justify-center text-text-subtle hover:text-text-muted sm:group-hover:text-text-muted cursor-grab active:cursor-grabbing transition-colors mb-2 p-1"
          tabIndex={-1}
          title="Drag to reorder"
        >
          <GripVertical size={16} strokeWidth={1.5} />
        </button>

        {/* Time pill */}
        <div
          className="font-medium tabular-nums px-2 py-1 rounded-pill whitespace-nowrap"
          style={{
            fontSize: `${roleDefaults(branding, 'finePrint').fontSize}px`,
            ...(item.start_time
              ? approved
                ? { backgroundColor: '#e5e7eb', color: '#111827' }
                : { backgroundColor: '#f3f4f6', color: '#9ca3af' }
              : { color: '#9ca3af' })
          }}
        >
          {item.start_time ? formatTimeDisplay(item.start_time) : ""}
        </div>

        {/* Connecting line (bottom half) */}
        <div className="flex-1 w-0.5 sm:w-px mt-2" style={{ backgroundColor: branding.border_color }} />
      </div>

      {/* Right column: card */}
      <div
        onClick={() => onEdit(item)}
        className={`flex-1 rounded-control border bg-surface hover:shadow-sm transition-all cursor-pointer mb-3 ${
          approved ? "border-border hover:border-border-strong" : ""
        }`}
        // An unapproved item is a status, so its outline and wash come from the
        // fixed warning value rather than the brand palette.
        style={approved ? undefined : PENDING_CARD}
      >
        <div className="flex h-full">
          <div
            className={`w-[3px] rounded-pill my-3 ml-3 shrink-0 ${approved ? "bg-brand-fg" : ""}`}
            style={approved ? undefined : { backgroundColor: STATUS_COLORS.warning }}
          />
          <div className="flex-1 pl-3 pr-4 py-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold" style={{ fontSize: `${bodyDefaults.fontSize}px`, color: bodyDefaults.color, fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never] }}>
                {item.title}
              </p>
              {item.description && (
                <p className="mt-1 line-clamp-2" style={{ fontSize: `${finePrintDefaults.fontSize}px`, color: finePrintDefaults.color, fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never] }}>
                  {item.description}
                </p>
              )}
              {item.duration_min && (
                <p className="mt-1" style={{ fontSize: `${finePrintDefaults.fontSize}px`, color: finePrintDefaults.color, fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never] }}>
                  {item.duration_min} min
                </p>
              )}
            </div>
            {item.pending_review && (
              <span
                className="shrink-0 text-body font-medium px-2 py-1 rounded-pill whitespace-nowrap"
                style={PENDING_PILL}
              >
                Pending
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Saturday, 22 April" - the day a run sheet belongs to. */
function formatDayLabel(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** A distinct calendar day plus the events (and venues) that fall on it. */
interface PortalDay {
  date: string;
  eventIds: string[];
  venues: string[];
}

/**
 * Collapse the couple's events into distinct days, sorted chronologically.
 * A couple can have more than one event, and more than one on the same
 * day, so a day groups every event that shares its date (and its venues,
 * which the day selector shows so same-day events stay distinguishable).
 */
function buildDays(events: PortalEvent[]): PortalDay[] {
  const byDate = new Map<string, PortalDay>();
  for (const ev of events) {
    const day = byDate.get(ev.date) ?? { date: ev.date, eventIds: [], venues: [] };
    day.eventIds.push(ev.id);
    if (ev.venue && !day.venues.includes(ev.venue)) day.venues.push(ev.venue);
    byDate.set(ev.date, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** "Sunday 21 June · Park Hyatt Sydney" - date plus the day's venue(s). */
function dayLabel(day: PortalDay): string {
  const date = formatDayLabel(day.date);
  return day.venues.length > 0 ? `${date} · ${day.venues.join(", ")}` : date;
}

/**
 * The day to land on first: the soonest day that hasn't passed, else the
 * most recent past day. Mirrors how the portal RPC picks the headline event.
 */
function defaultDay(days: PortalDay[]): string | null {
  if (days.length === 0) return null;
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const upcoming = days.find((d) => d.date >= today);
  return (upcoming ?? days[days.length - 1])?.date ?? null;
}

/** Per-day dropdown, mirroring the time picker's popover styling. */
function DaySelector({
  days,
  value,
  onChange,
}: {
  days: PortalDay[];
  value: string;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = days.find((d) => d.date === value) ?? null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 border border-border rounded-control px-3 py-2 text-sm bg-surface hover:bg-surface-muted transition cursor-pointer focus:outline-none"
      >
        <span className="text-text font-medium">
          {active ? dayLabel(active) : formatDayLabel(value)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-full bg-surface border border-border rounded-control shadow-lg overflow-hidden py-1">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => {
                onChange(d.date);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap transition hover:bg-surface-muted cursor-pointer ${
                d.date === value
                  ? "bg-surface-muted font-medium text-text"
                  : "text-text-muted"
              }`}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TimelineSectionProps {
  token: string;
  initialItems: PortalTimelineItem[];
  events: PortalEvent[];
  hasEvent: boolean;
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding;
}

export function TimelineSection({
  token,
  initialItems,
  events,
  hasEvent,
  branding,
}: TimelineSectionProps) {
  // Type scale from branding.
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  const [items, setItems] = useState<PortalTimelineItem[]>(initialItems);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortalTimelineItem | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => buildDays(events), [events]);
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  // Derive the day in view from render rather than syncing through an
  // effect: the couple's pick if it's still a valid day, otherwise the
  // soonest upcoming day. This keeps render the single source of truth.
  const selectedDay =
    pickedDay && days.some((d) => d.date === pickedDay)
      ? pickedDay
      : defaultDay(days);

  // The event a new suggestion attaches to: the first event on the day
  // the couple is currently viewing.
  const activeDay = days.find((d) => d.date === selectedDay) ?? null;
  const targetEventId = activeDay?.eventIds[0] ?? null;
  const dayEventIds = new Set(activeDay?.eventIds ?? []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleOpenAdd = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: PortalTimelineItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditingItem(null);
  };

  const handleSave = async (data: {
    start_time: string | null;
    title: string;
    description: string | null;
    duration_min: number | null;
  }) => {
    setSaving(true);
    const supabase = anonSupabase();
    const newId = editingItem?.id ?? crypto.randomUUID();
    // New suggestions attach to the day being viewed; edits keep their
    // own event so they stay on the right day.
    const eventId = editingItem?.event_id ?? targetEventId;

    const { data: returnedId } = await supabase.rpc(
      "save_portal_timeline_item",
      {
        p_token: token,
        p_id: newId,
        p_start_time: data.start_time,
        p_title: data.title,
        p_description: data.description,
        p_duration_min: data.duration_min,
        p_event_id: eventId,
      }
    );

    if (returnedId) {
      if (editingItem) {
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? { ...i, ...data } : i))
        );
      } else if (eventId) {
        setItems((prev) => [
          ...prev,
          {
            id: returnedId as string,
            ...data,
            position: (prev.length + 1) * 1000,
            pending_review: true,
            event_id: eventId,
          },
        ]);
      }
    }

    setSaving(false);
    handleClose();
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    setItems((prev) => prev.filter((i) => i.id !== editingItem.id));
    const supabase = anonSupabase();
    await supabase.rpc("delete_portal_timeline_item", {
      p_token: token,
      p_id: editingItem.id,
    });
    handleClose();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    setItems(arrayMove(items, oldIndex, newIndex));
  };

  if (!hasEvent) {
    return (
      <p className="py-2" style={{ fontSize: `${bodyDefaults.fontSize}px`, color: bodyDefaults.color, fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never] }}>
        Your MC will set up a timeline for your event. Check back soon.
      </p>
    );
  }

  // Only the moments for the day in view - a couple with several events
  // (including more than one on the same day) sees one run sheet at a time.
  const dayItems = items.filter((i) => dayEventIds.has(i.event_id));
  const mcItems = dayItems.filter((i) => !i.pending_review);
  const pendingItems = dayItems.filter((i) => i.pending_review);

  return (
    <div className="space-y-4">
      <div
        className="px-5 py-3.5 border"
        style={{
          borderColor: branding.border_color,
          backgroundColor: branding.surface_color,
          borderRadius: branding.corner_radius,
          borderWidth: 1,
        }}
      >
        <p
          className="mb-2"
          style={{
            fontSize: `${bodyDefaults.fontSize}px`,
            color: finePrintDefaults.color,
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            fontWeight: bodyDefaults.fontWeight,
            lineHeight: bodyDefaults.lineHeight,
          }}
        >
          Add moments to suggest timing for your event. Moments you add will be reviewed by your MC before appearing on the official timeline.
        </p>
        <p
          style={{
            fontSize: `${finePrintDefaults.fontSize}px`,
            color: finePrintDefaults.color,
            fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
            fontWeight: finePrintDefaults.fontWeight,
            lineHeight: finePrintDefaults.lineHeight,
          }}
        >
          <strong
            style={{
              color: finePrintDefaults.color,
              fontWeight: 600,
            }}
          >
            Pending
          </strong>{' '}
          means your MC is reviewing your suggestion.
        </p>
      </div>

      {days.length > 1 && selectedDay && (
        <div className="flex items-center gap-2">
          <span
            className="font-medium"
            style={{
              fontSize: `${finePrintDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
              fontWeight: 500,
              lineHeight: finePrintDefaults.lineHeight,
            }}
          >
            Day
          </span>
          <DaySelector
            days={days}
            value={selectedDay}
            onChange={setPickedDay}
          />
        </div>
      )}

      {dayItems.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={dayItems.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="relative pl-8">
              {/* Vertical line behind everything */}
              <div
                className="absolute left-0 top-0 bottom-0 w-px"
                style={{ backgroundColor: branding.border_color }}
              />

              <div className="space-y-2">
                {mcItems.length > 0 && (
                  <p
                    className="font-medium pl-8"
                    style={{
                      fontSize: `${bodyDefaults.fontSize}px`,
                      color: finePrintDefaults.color,
                      fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                      fontWeight: 500,
                      lineHeight: bodyDefaults.lineHeight,
                    }}
                  >
                    Added by your MC
                  </p>
                )}
                {mcItems.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    onEdit={handleOpenEdit}
                    branding={branding}
                  />
                ))}
                {pendingItems.length > 0 && (
                  <p
                    className="font-medium pl-8 mt-6"
                    style={{
                      fontSize: `${bodyDefaults.fontSize}px`,
                      color: finePrintDefaults.color,
                      fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                      fontWeight: 500,
                      lineHeight: bodyDefaults.lineHeight,
                    }}
                  >
                    Your suggestions
                  </p>
                )}
                {pendingItems.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    onEdit={handleOpenEdit}
                    branding={branding}
                  />
                ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={handleOpenAdd}
        className="w-full border border-dashed py-3 flex items-center justify-center gap-1.5 transition cursor-pointer hover:opacity-75"
        style={{
          fontSize: `${bodyDefaults.fontSize}px`,
          color: finePrintDefaults.color,
          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
          fontWeight: bodyDefaults.fontWeight,
          lineHeight: bodyDefaults.lineHeight,
          borderColor: branding.border_color,
          backgroundColor: `${branding.border_color}10`,
          borderRadius: branding.corner_radius,
          borderWidth: 1,
        }}
      >
        <Plus size={14} strokeWidth={1.5} style={{ color: finePrintDefaults.color }} />
        Add moment
      </button>

      <ItemModal
        isOpen={modalOpen}
        onClose={handleClose}
        onSave={handleSave}
        onDelete={editingItem ? handleDelete : undefined}
        item={editingItem}
        loading={saving}
        branding={branding}
      />
    </div>
  );
}
