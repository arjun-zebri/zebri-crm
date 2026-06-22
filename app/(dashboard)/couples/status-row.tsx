/**
 * A single draggable row in the couple-status editor: a drag handle, an
 * inline name input, a colour-picker popover, and a delete button.
 *
 * Pure presentational + dnd-kit wiring — all persistence is owned by the
 * parent `StatusesEditor`, which batches edits behind a "Save changes"
 * action. Edits here only mutate the parent's local draft via `onUpdate`.
 *
 * @module app/(dashboard)/couples/status-row
 */
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as Popover from '@radix-ui/react-popover';
import { GripVertical, Trash2, ChevronDown } from 'lucide-react';
import { memo, useState } from 'react';

import { CoupleStatusRecord, COLOR_PALETTE, getStatusClasses } from '@/types/couple';

interface StatusRowProps {
  status: CoupleStatusRecord;
  /** Apply a name/colour/position edit to the parent's local draft. */
  onUpdate: (status: CoupleStatusRecord) => void;
  /** Delete the status (persisted immediately; guarded server-side if in use). */
  onDelete: (statusId: string) => void;
}

function StatusRowBase({ status, onUpdate, onDelete }: StatusRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: status.id });
  const [colorOpen, setColorOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    // Only animate transform — animating `all` causes the colour popover
    // and hover styles to lag during a drag.
    transition: transition ? transition.replace('all', 'transform') : undefined,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  const classes = getStatusClasses(status.color);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-xl border bg-white transition-colors ${
        isDragging
          ? 'border-gray-300 bg-gray-50 shadow-lg'
          : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical size={16} strokeWidth={1.5} />
      </button>

      <input
        type="text"
        value={status.name}
        onChange={(e) => onUpdate({ ...status, name: e.target.value })}
        className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200"
        placeholder="Status name"
      />

      <Popover.Root open={colorOpen} onOpenChange={setColorOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="shrink-0 flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm cursor-pointer"
          >
            <div className={`w-3 h-3 rounded-full ${classes.dot}`} />
            <ChevronDown size={14} strokeWidth={1.5} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-[9999]"
            sideOffset={4}
            align="end"
          >
            <div className="grid grid-cols-5 gap-2">
              {COLOR_PALETTE.map((color) => {
                const colorClasses = getStatusClasses(color);
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onUpdate({ ...status, color });
                      setColorOpen(false);
                    }}
                    className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                      status.color === color ? 'border-black' : 'border-gray-300'
                    } ${colorClasses.dot}`}
                    title={color}
                  />
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <button
        type="button"
        onClick={() => onDelete(status.id)}
        className="shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
      >
        <Trash2 size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}

/**
 * Renders one sortable, editable status row. Memoised (with stable callbacks
 * from the parent) so unrelated editor state changes — opening the add dialog,
 * editing another row — don't re-render every row + colour popover.
 */
export const StatusRow = memo(StatusRowBase);
