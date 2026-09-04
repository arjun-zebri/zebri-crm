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
import { GripVertical, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useState } from 'react'

/** An item row under edit (id is a React key only: saves re-insert). */
export interface EditableItem {
  id: string
  description: string
  /**
   * Optional note rendered under this line on the sent document. Only
   * collected when the editor is given `showNote`.
   */
  note?: string | null
  amount: number
  quantity: number
}

/** Hide the native number-spinner chrome: matches the couple/event modals. */
export const noArrowsClass =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

/**
 * Which optional columns are on, as a stable key into {@link GRID_COLUMNS}.
 */
function columnKey(quantity: boolean, amount: boolean, note: boolean): string {
  return `${quantity ? 'q' : ''}${amount ? 'a' : ''}${note ? 'n' : ''}` || 'base'
}

/**
 * Full column templates, one per combination of optional columns.
 *
 * Written out literally so Tailwind can see each class. See the comment at the
 * call site for why building these by concatenation does not work.
 */
const GRID_COLUMNS: Record<string, string> = {
  // description only (single-price package: unpriced inclusions)
  base: 'grid-cols-[16px_1fr_24px]',
  // + note toggle
  n: 'grid-cols-[16px_1fr_24px_24px]',
  // + amount (the historical default)
  a: 'grid-cols-[16px_1fr_96px_24px]',
  // + amount + note (invoice templates)
  an: 'grid-cols-[16px_1fr_96px_24px_24px]',
  // + quantity
  q: 'grid-cols-[16px_1fr_48px_24px]',
  qn: 'grid-cols-[16px_1fr_48px_24px_24px]',
  // + quantity + amount (packages)
  qa: 'grid-cols-[16px_1fr_48px_96px_24px]',
  qan: 'grid-cols-[16px_1fr_48px_96px_24px_24px]',
}

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
  /**
   * Show the price column. Off for a package priced as a single figure, where
   * the line items are unpriced inclusions and the total is entered once.
   * Defaults to on, which is every historical caller.
   */
  showAmount?: boolean
  /**
   * Offer a per-row note. Off by default: most line-item lists (packages,
   * add-ons) have nowhere to render a note on the sent document, so collecting
   * one would be a dead field.
   */
  showNote?: boolean
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
  showAmount = true,
  showNote = false,
}: LineItemsEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  // Shared column template so the header and every row line up exactly.
  //
  // Every variant is spelled out in full rather than assembled from parts.
  // Tailwind's JIT scans source text for COMPLETE class names, so a template
  // built at runtime (`'grid-cols-[16px_1fr' + '_24px]'`) produces a class for
  // which no CSS is ever generated: the grid silently loses its columns and
  // every cell stacks. Columns are grip · description · [qty] · [amount] ·
  // [note toggle] · remove.
  const gridClass = `grid items-center gap-2 ${GRID_COLUMNS[columnKey(showQuantity, showAmount, showNote)]}`

  const addItem = () =>
    onChange([
      ...items,
      { id: `new-${crypto.randomUUID()}`, description: '', note: null, amount: 0, quantity: 1 },
    ])

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
          {showAmount && <span className="text-right">{amountHeader}</span>}
          {showNote && <span />}
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
                showAmount={showAmount}
                showNote={showNote}
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
  showAmount,
  showNote,
  compact,
  onUpdate,
  onRemove,
}: {
  item: EditableItem
  disabled: boolean
  descriptionPlaceholder: string
  gridClass: string
  showQuantity: boolean
  showAmount: boolean
  showNote: boolean
  compact: boolean
  onUpdate: (id: string, patch: Partial<EditableItem>) => void
  onRemove: (id: string) => void
}) {
  // A row that already carries a note always shows it, so nothing the MC typed
  // can hide behind a toggle they forgot they pressed.
  const hasNote = Boolean(item.note && item.note.length > 0)
  const [noteOpen, setNoteOpen] = useState(false)
  const showNoteField = showNote && (hasNote || noteOpen)
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
    <div ref={setNodeRef} style={style} className="border-b border-border">
      <div className={gridClass}>
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

      {showAmount && (
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
      )}

      {showNote && (
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          className={`flex items-center justify-center transition cursor-pointer ${
            showNoteField ? 'text-text' : 'text-text-subtle hover:text-text-muted'
          }`}
          disabled={disabled}
          aria-label={showNoteField ? 'Hide note' : 'Add a note to this item'}
          aria-pressed={showNoteField}
          title="Add a note"
        >
          <StickyNote size={14} strokeWidth={1.5} />
        </button>
      )}

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

      {/* Indented to line up with the description, past the drag handle. */}
      {showNoteField ? (
        <div className="pb-1.5 pl-[24px]">
          <textarea
            value={item.note ?? ''}
            onChange={(e) => onUpdate(item.id, { note: e.target.value })}
            placeholder="Add a note for this item"
            disabled={disabled}
            rows={2}
            autoFocus={noteOpen && !hasNote}
            aria-label={`Note for ${item.description || 'this item'}`}
            className="w-full resize-none rounded-control border border-border bg-surface px-2 py-1.5 text-body text-text-muted placeholder:text-text-subtle focus:outline-none focus:border-border-strong disabled:opacity-50"
          />
        </div>
      ) : null}
    </div>
  )
}
