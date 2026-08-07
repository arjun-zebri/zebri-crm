/**
 * Shared drag-sortable, editable list of priced line items.
 *
 * Used by the Packages, Quotes, and Invoices edit modals so every
 * line-item list looks and behaves the same: an aligned grid — grip ·
 * description · (qty) · amount · remove — with borderless inputs and a
 * hairline under each row, mirroring the quote/invoice builders' table.
 * The `Qty` column is opt-in (`showQuantity`) since only packages carry
 * quantities. Reorder is handled by dnd-kit; add/remove is instant (no
 * auto-animate — it fought dnd-kit's sortable layout and jittered). Rows
 * are controlled; the parent owns the array.
 *
 * @module app/(dashboard)/templates/line-items-editor
 */
'use client'

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'

/** An item row under edit (id is a React key only: saves re-insert). */
export interface EditableItem {
  id: string
  description: string
  amount: number
  quantity: number
}

/** Hide the native number-spinner chrome: matches the couple/event modals. */
export const noArrowsClass =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

interface LineItemsEditorProps {
  items: EditableItem[]
  onChange: (items: EditableItem[]) => void
  disabled: boolean
  /** Placeholder for a new row's description. */
  descriptionPlaceholder: string
  /** Label on the add button ("Add line item" / "Add add-on"). */
  addLabel: string
  /** Show the per-unit quantity column (packages only). Defaults to false. */
  showQuantity?: boolean
  /** Header over the price column. Defaults to "Amount". */
  amountHeader?: string
  /** Caption-size cells for modals built on sm inputs (packages).
   *  Default keeps text-body to match the underline-style modals. */
  compact?: boolean
}

export function LineItemsEditor({
  items,
  onChange,
  disabled,
  descriptionPlaceholder,
  addLabel,
  showQuantity = false,
  amountHeader = 'Amount',
  compact = false,
}: LineItemsEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  // Shared column template so the header and every row line up exactly.
  const gridClass = showQuantity
    ? 'grid grid-cols-[16px_1fr_48px_96px_24px] items-center gap-2'
    : 'grid grid-cols-[16px_1fr_96px_24px] items-center gap-2'

  const addItem = () =>
    onChange([...items, { id: `new-${crypto.randomUUID()}`, description: '', amount: 0, quantity: 1 }])

  const updateItem = (id: string, patch: Partial<EditableItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  const removeItem = (id: string) => onChange(items.filter((item) => item.id !== id))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    onChange(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <div>
      {items.length > 0 && (
        <div className={`${gridClass} pb-1 text-body text-text-subtle`}>
          <span />
          <span />
          {showQuantity && <span className="text-right">Qty</span>}
          <span className="text-right">{amountHeader}</span>
          <span />
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div>
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                disabled={disabled}
                descriptionPlaceholder={descriptionPlaceholder}
                gridClass={gridClass}
                showQuantity={showQuantity}
                compact={compact}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        className={`mt-2 flex items-center gap-1 py-1 ${compact ? 'text-body' : 'text-body'} text-text-muted transition hover:text-text cursor-pointer disabled:opacity-50`}
      >
        <Plus size={14} strokeWidth={1.5} />
        {addLabel}
      </button>
    </div>
  )
}

function ItemRow({
  item,
  disabled,
  descriptionPlaceholder,
  gridClass,
  showQuantity,
  compact,
  onUpdate,
  onRemove,
}: {
  item: EditableItem
  disabled: boolean
  descriptionPlaceholder: string
  gridClass: string
  showQuantity: boolean
  compact: boolean
  onUpdate: (id: string, patch: Partial<EditableItem>) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? transition.replace('all', 'transform') : undefined,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties

  const cellInput = `bg-transparent ${compact ? 'py-1.5 text-body' : 'py-2 text-body'} text-text placeholder:text-text-subtle focus:outline-none`

  return (
    <div ref={setNodeRef} style={style} className={`${gridClass} border-b border-border`}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder item"
        className="flex cursor-grab items-center text-text-subtle transition hover:text-text-muted active:cursor-grabbing"
        disabled={disabled}
      >
        <GripVertical size={14} strokeWidth={1.5} />
      </button>

      <input
        type="text"
        value={item.description}
        onChange={(e) => onUpdate(item.id, { description: e.target.value })}
        placeholder={descriptionPlaceholder}
        disabled={disabled}
        className={`${cellInput} min-w-0`}
      />

      {showQuantity && (
        <input
          type="number"
          value={item.quantity === 1 ? '' : item.quantity}
          onChange={(e) => onUpdate(item.id, { quantity: parseFloat(e.target.value) || 1 })}
          placeholder="1"
          min="1"
          step="1"
          aria-label="Quantity"
          className={`${cellInput} w-full text-right tabular-nums ${noArrowsClass}`}
          disabled={disabled}
        />
      )}

      <div className="relative">
        <span className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 ${compact ? 'text-body' : 'text-body'} text-text-muted`}>$</span>
        <input
          type="number"
          value={item.amount || ''}
          onChange={(e) => onUpdate(item.id, { amount: parseFloat(e.target.value) || 0 })}
          placeholder="0"
          step="0.01"
          aria-label="Amount"
          className={`${cellInput} w-full pl-4 text-right tabular-nums ${noArrowsClass}`}
          disabled={disabled}
        />
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="flex items-center justify-center text-text-subtle transition hover:text-danger cursor-pointer"
        disabled={disabled}
        aria-label="Remove item"
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
