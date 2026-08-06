/**
 * Presentational category control — the Notion pattern.
 *
 * The trigger reads like a Select (dot + current category name). The
 * popover lists categories to pick from, with an inline "New category"
 * form and an "Edit categories" mode for rename / recolour / delete /
 * drag-reorder — all without leaving the host modal.
 *
 * Data-source agnostic: the caller injects the category list and the
 * mutation callbacks, so the same control serves email templates
 * (`CategoryPicker`) and packages (`PackageCategoryPicker`). The
 * category shape is `EmailTemplateCategory` structurally —
 * `PackageCategory` is identical, so both satisfy it.
 *
 * @module app/(dashboard)/templates/category-picker-base
 */
'use client'

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { EmailTemplateCategory } from '@/types/email-template'

import { categoryColorClasses } from './category-colors'
import { CategoryManageRow, ColorSwatches } from './category-manage-row'

export interface CategoryPickerBaseProps {
  /** Selected category id (`null` = no category). */
  value: string | null
  onChange: (id: string | null) => void
  categories: EmailTemplateCategory[]
  createPending: boolean
  /** Create and return the new category; throws on failure (base toasts). */
  onCreate: (input: { name: string; color: string }) => Promise<{ id: string }>
  /** Persist a rename/recolour — the caller owns error handling. */
  onUpdate: (input: { id: string; name: string; color: string }) => void
  /** Delete a category — the caller owns error handling. */
  onDelete: (id: string) => void
  /** Persist a drag-reorder (full id list in new order). */
  onReorder: (ids: string[]) => void
}

export function CategoryPickerBase({
  value,
  onChange,
  categories,
  createPending,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
}: CategoryPickerBaseProps) {
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>('slate')

  const selected = categories.find((c) => c.id === value) ?? null

  const addCategory = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const created = await onCreate({ name, color: newColor })
      onChange(created.id)
      setCreating(false)
      setNewName('')
      setNewColor('slate')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create the category', 'error')
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = categories.map((c) => c.id)
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    // Mirrors the Input primitive's anatomy (space-y-1 wrapper, caption
    // label, sm-size rounded-control bg-surface field) so this sits flush
    // beside the labelled name Input in the host modal's shared row.
    <div className="space-y-1">
      <p className="block text-caption font-medium text-text">Category</p>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setManaging(false)
            setCreating(false)
          }
        }}
      >
        <Popover.Trigger
          aria-label="Category"
          className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-control border border-border bg-surface px-2.5 text-left text-caption text-text transition-colors hover:border-border-strong focus:border-brand-fg focus:outline-none data-[state=open]:border-brand-fg"
        >
          {selected && (
            <span className={`h-2.5 w-2.5 shrink-0 rounded-pill ${categoryColorClasses(selected.color).dot}`} />
          )}
          <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'text-text-subtle'}`}>
            {selected ? selected.name : 'No category'}
          </span>
          <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            // Radix exposes the trigger's width as a CSS var, so the
            // popover matches the control exactly — like a native Select.
            className="z-[90] w-[var(--radix-popover-trigger-width)] rounded-control border border-border bg-card p-1 shadow-lg animate-fade-in"
          >
            {managing ? (
              <>
                {categories.length === 0 && (
                  <p className="px-2 py-3 text-xs text-text-subtle">
                    No categories yet. Create one first.
                  </p>
                )}
                <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="max-h-64 space-y-0 overflow-y-auto">
                      {categories.map((c) => (
                        <CategoryManageRow
                          key={c.id}
                          category={c}
                          onSave={onUpdate}
                          onDelete={(id) => {
                            if (id === value) onChange(null)
                            onDelete(id)
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="mt-1 border-t border-border pt-1">
                  <Button size="sm" variant="ghost" className="h-7 w-full text-caption" onClick={() => setManaging(false)}>
                    Done
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="max-h-64 space-y-0 overflow-y-auto">
                  <CategoryOption
                    label="No category"
                    dotClass={null}
                    selected={value === null}
                    onSelect={() => {
                      onChange(null)
                      setOpen(false)
                    }}
                  />
                  {categories.map((c) => (
                    <CategoryOption
                      key={c.id}
                      label={c.name}
                      dotClass={categoryColorClasses(c.color).dot}
                      selected={c.id === value}
                      onSelect={() => {
                        onChange(c.id)
                        setOpen(false)
                      }}
                    />
                  ))}
                </div>
                {creating ? (
                  <div className="mt-1 space-y-2 border-t border-border p-2">
                    <Input
                      size="sm"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void addCategory()
                        }
                      }}
                      placeholder="Category name"
                      aria-label="New category name"
                      autoFocus
                    />
                    {/* Stacked: eight swatches + a button don't fit on one
                        row at trigger width, so Add gets its own line. */}
                    <ColorSwatches value={newColor} onChange={setNewColor} />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 w-full text-caption"
                      loading={createPending}
                      onClick={addCategory}
                    >
                      Add
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-1 border-t border-border pt-1">
                    <Button size="sm" variant="ghost" className="h-7 min-w-0 flex-1 justify-start gap-1.5 px-2 text-caption" onClick={() => setCreating(true)}>
                      <Plus size={13} strokeWidth={1.5} />
                      New
                    </Button>
                    {categories.length > 0 && (
                      <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-caption" onClick={() => setManaging(true)}>
                        <Pencil size={12} strokeWidth={1.5} />
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

/** One selectable row in the picker list. */
function CategoryOption({
  label,
  dotClass,
  selected,
  onSelect,
}: {
  label: string
  dotClass: string | null
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-center gap-2 rounded-control px-2 py-1 text-left transition hover:bg-surface-muted"
    >
      {dotClass ? (
        <span className={`h-2 w-2 shrink-0 rounded-pill ${dotClass}`} />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-pill border border-border" />
      )}
      <span className="min-w-0 flex-1 truncate text-caption text-text">{label}</span>
      {selected && <Check size={12} strokeWidth={1.5} className="shrink-0 text-text" />}
    </button>
  )
}
