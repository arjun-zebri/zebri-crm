/**
 * One sortable row of the category manager (inside the picker's
 * "Edit categories" mode): drag to reorder, pencil to rename /
 * recolour in place, trash to delete (templates become uncategorised).
 *
 * @module app/(dashboard)/templates/category-manage-row
 */
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { CATEGORY_COLOR_KEYS, type EmailTemplateCategory } from '@/types/email-template'

import { categoryColorClasses } from './category-colors'

/** Row of colour swatches shared by the edit + create forms. */
export function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {CATEGORY_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={`Colour ${key}`}
          onClick={() => onChange(key)}
          className={`h-4 w-4 cursor-pointer rounded-pill ${categoryColorClasses(key).dot} ${
            value === key ? 'ring-2 ring-text ring-offset-1' : ''
          }`}
        />
      ))}
    </div>
  )
}

interface CategoryManageRowProps {
  category: EmailTemplateCategory
  onSave: (input: { id: string; name: string; color: string }) => void
  onDelete: (id: string) => void
}

export function CategoryManageRow({ category, onSave, onDelete }: CategoryManageRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState<string>(category.color)
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: category.id,
  })

  const save = () => {
    if (!name.trim()) return
    onSave({ id: category.id, name: name.trim(), color })
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      // dnd-kit transform positioning — dynamic values, so not Tailwind.
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-control ${isDragging ? 'z-10 bg-surface-muted' : ''}`}
    >
      {editing ? (
        <div className="space-y-2 rounded-control bg-surface-muted p-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                save()
              }
            }}
            aria-label="Category name"
            autoFocus
          />
          {/* Stacked like the create form: the swatch row fills the
              trigger-width popover, so Save gets its own line. */}
          <ColorSwatches value={color} onChange={setColor} />
          <button
            type="button"
            onClick={save}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-control py-1 text-body font-medium text-text transition hover:bg-surface"
          >
            <Check size={12} strokeWidth={1.5} />
            Save
          </button>
        </div>
      ) : (
        <div className="group flex items-center gap-2 rounded-control px-1 py-1 hover:bg-surface-muted">
          <button
            type="button"
            aria-label={`Reorder ${category.name}`}
            className="cursor-grab touch-none text-text-subtle"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} strokeWidth={1.5} />
          </button>
          <span className={`h-2 w-2 shrink-0 rounded-pill ${categoryColorClasses(category.color).dot}`} />
          <span className="min-w-0 flex-1 truncate text-body text-text">{category.name}</span>
          <button
            type="button"
            aria-label={`Rename ${category.name}`}
            onClick={() => {
              setName(category.name)
              setColor(category.color)
              setEditing(true)
            }}
            className="cursor-pointer rounded-control p-1 text-text-subtle opacity-0 transition hover:text-text group-hover:opacity-100"
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label={`Delete ${category.name}`}
            onClick={() => onDelete(category.id)}
            className="cursor-pointer rounded-control p-1 text-text-subtle opacity-0 transition hover:text-red-600 group-hover:opacity-100"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}
