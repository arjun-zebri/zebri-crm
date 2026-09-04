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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';

import { LineItemRow } from './line-item-row';

export interface LineItem {
  id: string;
  description: string;
  /**
   * Optional note shown under this line on the public invoice and the PDF.
   * A single trailing note on the document cannot say which charge it
   * qualifies, which is why it lives per line.
   */
  note?: string | null;
  amount: number;
  position: number;
}

/** Fields of a {@link LineItem} the table can edit in place. */
export type LineItemField = 'description' | 'amount' | 'note';

export interface LineItemsTableProps {
  items: LineItem[];
  /** Whether fields can be edited. Locked invoices / accepted quotes
   *  pass `false`; the table renders as read-only. */
  canEdit: boolean;
  onUpdate: (id: string, field: LineItemField, value: string | number) => void;
  onRemove: (id: string) => void;
  onReorder: (next: LineItem[]) => void;
  onAdd: () => void;
  /** Optional slot rendered above the table (template picker on quotes). */
  headerAccessory?: React.ReactNode;
  /** Borderless compact rendering for tables nested inside a card —
   *  same visual language as the Templates line-item editors: no outer
   *  box, hairline row rules, caption-size text. Default keeps the boxed
   *  table the invoice builder uses at the top level. */
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
          className={`w-full rounded-control border border-dashed border-border bg-surface-muted/40 ${
            compact ? 'py-8' : 'py-12'
          } text-center transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-pill bg-surface text-text-muted">
            <Plus size={18} strokeWidth={1.5} />
          </div>
          <p className={`mt-3 ${compact ? 'text-body' : 'text-body'} text-text-muted`}>
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
        <div className="grid grid-cols-[1fr_96px_48px] sm:grid-cols-[16px_1fr_96px_48px] items-center gap-2 pb-1 text-body text-text-subtle">
          <span className="hidden sm:block" />
          <span />
          <span className="text-right">Amount</span>
          <span />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <LineItemRow
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
            className="mt-1.5 flex cursor-pointer items-center gap-1 py-1 text-body text-text-muted transition hover:text-text"
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
      <div className="rounded-control border border-border overflow-hidden">
        {/* Column header */}
        <div className="grid grid-cols-[1fr_120px_60px] sm:grid-cols-[24px_1fr_120px_60px] gap-2 sm:gap-3 px-3 py-2 bg-surface-muted text-body font-medium uppercase tracking-wide text-text-muted">
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
              <LineItemRow
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
