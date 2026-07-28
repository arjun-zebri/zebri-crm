/**
 * Shared line-items table for the Quote + Invoice builders.
 *
 * Two columns only — description (text) + amount (number). The
 * `quantity` column is deliberately gone (Phase 2C.2 locked decision):
 * MCs/celebrants charge per item, never multi-unit. The persistence
 * layer (`saveInvoiceAction`) keeps `quantity = 1, unit_price = amount`
 * so the DB schema stays valid until the column drop in a follow-up.
 *
 * Reorder via dnd-kit drag handle (desktop only). Mobile gets the same
 * fields without the handle.
 *
 * @module components/builders/parts/line-items-table
 */
'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

export interface LineItem {
  id: string;
  description: string;
  amount: number;
  position: number;
}

export interface LineItemsTableProps {
  items: LineItem[];
  /** Whether fields can be edited. Locked invoices / accepted quotes
   *  pass `false`; the table renders as read-only. */
  canEdit: boolean;
  onUpdate: (id: string, field: 'description' | 'amount', value: string | number) => void;
  onRemove: (id: string) => void;
  onReorder: (next: LineItem[]) => void;
  onAdd: () => void;
  /** Optional slot rendered above the table (template picker on quotes). */
  headerAccessory?: React.ReactNode;
  /** Borderless compact rendering for tables nested inside a card
   *  (the proposal option card) — same visual language as the
   *  Templates line-item editors: no outer box, hairline row rules,
   *  caption-size text. Default keeps the boxed table the invoice
   *  builder uses at the top level. */
  compact?: boolean;
}

export function LineItemsTable({
  items,
  canEdit,
  onUpdate,
  onRemove,
  onReorder,
  onAdd,
  headerAccessory,
  compact = false,
}: LineItemsTableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(
      arrayMove(items, oldIndex, newIndex).map((item, idx) => ({ ...item, position: idx })),
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        {headerAccessory}
        <button
          type="button"
          onClick={onAdd}
          disabled={!canEdit}
          className={`w-full rounded-card border border-dashed border-border bg-surface-muted/40 ${
            compact ? 'py-8' : 'py-12'
          } text-center transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface text-text-muted">
            <Plus size={18} strokeWidth={1.5} />
          </div>
          <p className={`mt-3 ${compact ? 'text-caption' : 'text-body'} text-text-muted`}>
            Add your first line item
          </p>
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div>
        {headerAccessory}
        <div className="grid grid-cols-[1fr_96px_24px] sm:grid-cols-[16px_1fr_96px_24px] items-center gap-2 pb-1 text-xs text-text-subtle">
          <span className="hidden sm:block" />
          <span />
          <span className="text-right">Amount</span>
          <span />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableRow
                key={item.id}
                item={item}
                canEdit={canEdit}
                compact
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))}
          </SortableContext>
        </DndContext>
        {canEdit ? (
          <button
            type="button"
            onClick={onAdd}
            className="mt-1.5 flex cursor-pointer items-center gap-1 py-1 text-caption text-text-muted transition hover:text-text"
          >
            <Plus size={13} strokeWidth={1.5} />
            Add item
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {headerAccessory}
      <div className="rounded-card border border-border overflow-hidden">
        {/* Column header */}
        <div className="grid grid-cols-[1fr_120px_36px] sm:grid-cols-[24px_1fr_120px_36px] gap-2 sm:gap-3 px-3 py-2 bg-surface-muted text-caption font-medium uppercase tracking-wide text-text-muted">
          <span className="hidden sm:block" />
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item) => (
              <SortableRow
                key={item.id}
                item={item}
                canEdit={canEdit}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))}
          </SortableContext>
        </DndContext>

        {canEdit ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-body text-text-muted hover:bg-surface-muted hover:text-text transition-colors border-t border-border cursor-pointer"
          >
            <Plus size={14} strokeWidth={1.5} />
            Add item
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Row ───────────────────────────────────────────────────────── */

interface SortableRowProps {
  item: LineItem;
  canEdit: boolean;
  compact?: boolean;
  onUpdate: LineItemsTableProps['onUpdate'];
  onRemove: LineItemsTableProps['onRemove'];
}

function SortableRow({ item, canEdit, compact = false, onUpdate, onRemove }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? transition.replace('all', 'transform') : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const rowClass = compact
    ? 'grid grid-cols-[1fr_96px_24px] sm:grid-cols-[16px_1fr_96px_24px] items-center gap-2 border-b border-border'
    : 'grid grid-cols-[1fr_120px_36px] sm:grid-cols-[24px_1fr_120px_36px] gap-2 sm:gap-3 px-3 py-2 border-t border-border items-center bg-surface';
  const textClass = compact ? 'text-caption' : 'text-body';
  const fieldPad = compact ? 'py-1.5' : '';

  return (
    <div ref={setNodeRef} style={style} className={rowClass}>
      {/* Drag handle — desktop only */}
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
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className={`${compact ? '' : 'p-1 '}text-text-subtle hover:text-danger transition cursor-pointer justify-self-center`}
          aria-label="Remove item"
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
