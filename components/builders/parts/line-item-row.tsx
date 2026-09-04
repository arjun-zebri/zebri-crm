/**
 * One editable row of the builders' line-items table.
 *
 * Split out of `line-items-table.tsx` when the optional per-line note was
 * added: the row grew a second, conditionally-rendered line and the table file
 * was already past the size where it reads comfortably.
 *
 * The note is revealed per row rather than always shown. Most lines never need
 * one, and a permanently empty textarea under every line makes a three-item
 * invoice look like a form to fill in. Once a row has a note it stays visible,
 * so nothing an MC typed can hide behind a toggle they forgot they pressed.
 *
 * @module components/builders/parts/line-item-row
 */
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, StickyNote, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { LineItem, LineItemField } from './line-items-table';

export interface LineItemRowProps {
  item: LineItem;
  canEdit: boolean;
  /** Borderless caption-size rendering for tables nested inside a card. */
  compact?: boolean;
  onUpdate: (id: string, field: LineItemField, value: string | number) => void;
  onRemove: (id: string) => void;
}

export function LineItemRow({
  item,
  canEdit,
  compact = false,
  onUpdate,
  onRemove,
}: LineItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? transition.replace('all', 'transform') : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  // A row with an existing note always shows it; the toggle only governs an
  // empty one the MC just opened.
  const hasNote = Boolean(item.note && item.note.length > 0);
  const [noteOpen, setNoteOpen] = useState(false);
  const showNote = hasNote || noteOpen;

  const gridClass = compact
    ? 'grid grid-cols-[1fr_96px_48px] sm:grid-cols-[16px_1fr_96px_48px] items-center gap-2'
    : 'grid grid-cols-[1fr_120px_60px] sm:grid-cols-[24px_1fr_120px_60px] gap-2 sm:gap-3 px-3 py-2 items-center';
  const wrapClass = compact
    ? 'border-b border-border'
    : 'border-t border-border bg-surface';
  const textClass = 'text-body';
  const fieldPad = compact ? 'py-1.5' : '';

  return (
    <div ref={setNodeRef} style={style} className={wrapClass}>
      <div className={gridClass}>
        {/* Drag handle, desktop only */}
        {canEdit ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="hidden sm:flex cursor-grab active:cursor-grabbing text-text-subtle hover:text-text-muted touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical size={14} strokeWidth={1.5} />
          </button>
        ) : (
          <span className="hidden sm:block" />
        )}

        <input
          type="text"
          value={item.description}
          onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
          placeholder="Description"
          readOnly={!canEdit}
          disabled={!canEdit}
          className={`min-w-0 bg-transparent ${fieldPad} ${textClass} text-text placeholder:text-text-subtle focus:outline-none disabled:opacity-70`}
        />

        <div className="relative">
          <span
            className={`absolute left-0 top-1/2 -translate-y-1/2 ${textClass} text-text-subtle pointer-events-none`}
          >
            $
          </span>
          <input
            type="number"
            value={item.amount || ''}
            onChange={(e) => onUpdate(item.id, 'amount', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            min="0"
            step="0.01"
            readOnly={!canEdit}
            disabled={!canEdit}
            className={`w-full bg-transparent pl-4 text-right ${fieldPad} ${textClass} text-text placeholder:text-text-subtle tabular-nums focus:outline-none disabled:opacity-70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          />
        </div>

        {canEdit ? (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setNoteOpen((v) => !v)}
              className={`transition cursor-pointer ${
                showNote ? 'text-text' : 'text-text-subtle hover:text-text-muted'
              }`}
              aria-label={showNote ? 'Hide note' : 'Add a note to this item'}
              aria-pressed={showNote}
              title="Add a note"
            >
              <StickyNote size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="text-text-subtle hover:text-danger transition cursor-pointer"
              aria-label="Remove item"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <span />
        )}
      </div>

      {/* The note sits under the description, indented to line up with it on
          desktop where the drag handle occupies the first column. */}
      {showNote ? (
        <div className={compact ? 'pb-1.5 sm:pl-[18px]' : 'px-3 pb-2 sm:pl-[27px]'}>
          <textarea
            value={item.note ?? ''}
            onChange={(e) => onUpdate(item.id, 'note', e.target.value)}
            placeholder="Add a note for this item"
            readOnly={!canEdit}
            disabled={!canEdit}
            rows={2}
            autoFocus={noteOpen && !hasNote}
            aria-label={`Note for ${item.description || 'this item'}`}
            className="w-full resize-none rounded-control border border-border bg-surface px-2 py-1.5 text-body text-text-muted placeholder:text-text-subtle focus:outline-none focus:border-border-strong disabled:opacity-70"
          />
        </div>
      ) : null}
    </div>
  );
}
