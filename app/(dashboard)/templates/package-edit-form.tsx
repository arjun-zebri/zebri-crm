/**
 * Create/edit form for a package (v2 commercial fields).
 *
 * Modal form in the boxed-input style: name, a subtitle + category row
 * (the same Notion-style categories email templates use), description
 * prose, two drag-sortable item sections in bordered cards (base line
 * items + optional add-ons), then the pricing details that pre-fill
 * the builders on apply (booking deposit %, weekend loading %,
 * GST-inclusive flag). The sticky footer carries the live package
 * total beside Cancel / Save.
 *
 * State is local; the manager owns persistence and passes the saved
 * package in / takes the draft out.
 *
 * @module app/(dashboard)/templates/package-edit-form
 */
'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatAUD } from '@/lib/payments/format'
import { packageTotals } from '@/lib/payments/package-math'

import { LineItemsEditor, noArrowsClass, type EditableItem } from './line-items-editor'
import { PackageCategoryPicker } from './package-category-picker'

/** The draft a save hands back to the manager. */
export interface PackageDraft {
  name: string
  notes: string | null
  description: string | null
  category_id: string | null
  gst_inclusive: boolean
  weekend_loading_percent: number | null
  /** Marketing flag: highlights this package as "Most popular". */
  is_popular: boolean
  /** Base items first, then add-ons: index is the save order. */
  items: (EditableItem & { optional: boolean })[]
}

/** The saved shape the form hydrates from (a `packages` row + items). */
export interface PackageFormValue {
  name: string
  notes: string | null
  description: string | null
  category_id: string | null
  gst_inclusive: boolean
  weekend_loading_percent: number | null
  is_popular: boolean
  items: (EditableItem & { optional: boolean })[]
}

interface PackageEditFormProps {
  /** Modal heading — "New Package" / "Edit Package". */
  title: string
  value: PackageFormValue
  onSave: (draft: PackageDraft) => void
  onClose: () => void
  isSaving: boolean
}

/** Parse an optional percent field: '' → null, clamped to 0–100. */
function parsePercent(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, 100)
}

/** Bold section label with an inline muted hint, per the modal design. */
function SectionLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <p className="mb-2">
      <span className="text-sm font-medium text-text">{label}</span>
      <span className="ml-2 text-xs text-text-muted">{hint}</span>
    </p>
  )
}

export function PackageEditForm({ title, value, onSave, onClose, isSaving }: PackageEditFormProps) {
  const [name, setName] = useState(value.name)
  const [notes, setNotes] = useState(value.notes ?? '')
  const [description, setDescription] = useState(value.description ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(value.category_id)
  const [baseItems, setBaseItems] = useState<EditableItem[]>(value.items.filter((i) => !i.optional))
  const [addOns, setAddOns] = useState<EditableItem[]>(value.items.filter((i) => i.optional))
  const [weekendLoading, setWeekendLoading] = useState(value.weekend_loading_percent?.toString() ?? '')
  const [gstInclusive, setGstInclusive] = useState(value.gst_inclusive)
  const [isPopular, setIsPopular] = useState(value.is_popular)

  const totals = packageTotals([
    ...baseItems.map((i) => ({ ...i, optional: false })),
    ...addOns.map((i) => ({ ...i, optional: true })),
  ])

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      notes: notes.trim() || null,
      description: description.trim() || null,
      category_id: categoryId,
      gst_inclusive: gstInclusive,
      weekend_loading_percent: parsePercent(weekendLoading),
      is_popular: isPopular,
      items: [
        ...baseItems.map((i) => ({ ...i, optional: false })),
        ...addOns.map((i) => ({ ...i, optional: true })),
      ],
    })
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={
        <div className="min-w-0">
          <p className="text-xl font-semibold text-text">{title}</p>
          <p className="mt-0.5 text-sm font-normal text-text-muted">
            Build a reusable package you can drop into any quote.
          </p>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Package total
            </p>
            <p className="truncate text-xl font-semibold tabular-nums text-text">
              {formatAUD(totals.base)}
              {totals.addOns > 0 && (
                <span className="ml-2 text-xs font-normal tabular-nums text-text-muted">
                  {formatAUD(totals.full)} with all add-ons
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose} disabled={isSaving} variant="outline" size="sm">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !name.trim()} loading={isSaving} size="sm">
              Save package
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Input
          label="Package name"
          size="sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Gold Package"
          disabled={isSaving}
          autoFocus
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Subtitle"
            size="sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Short description shown on the list"
            disabled={isSaving}
          />
          <PackageCategoryPicker value={categoryId} onChange={setCategoryId} />
        </div>

        <div className="space-y-1">
          <label htmlFor="package-description" className="block text-caption font-medium text-text">
            Description
          </label>
          <textarea
            id="package-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="The details couples read before the prices."
            disabled={isSaving}
            rows={3}
            className="block w-full resize-none rounded-control border border-border bg-surface px-2.5 py-2 text-caption text-text placeholder:text-text-subtle transition-colors focus:border-brand-fg focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div>
          <SectionLabel label="Line items" hint="What's included in the base price" />
          <div className="rounded-control border border-border px-4 pt-2 pb-1.5">
            <LineItemsEditor
              items={baseItems}
              onChange={setBaseItems}
              disabled={isSaving}
              descriptionPlaceholder="e.g., MC Ceremony"
              addLabel="Add line item"
              showQuantity
              amountHeader="Unit price"
              compact
            />
          </div>
        </div>

        <div>
          <SectionLabel label="Optional add-ons" hint="Extras you pick per quote" />
          <div className="rounded-control border border-border px-4 pt-2 pb-1.5">
            <LineItemsEditor
              items={addOns}
              onChange={setAddOns}
              disabled={isSaving}
              descriptionPlaceholder="e.g., Rehearsal attendance"
              addLabel="Add add-on"
              showQuantity
              amountHeader="Unit price"
              compact
            />
          </div>
        </div>

        <div>
          <SectionLabel label="Pricing details" hint="Pre-fills the builders when applied" />
          <div className="grid grid-cols-1 gap-4">
            <PercentField
              label="Weekend loading"
              value={weekendLoading}
              onChange={setWeekendLoading}
              disabled={isSaving}
            />
          </div>
          <Checkbox
            className="mt-3"
            checked={gstInclusive}
            onChange={setGstInclusive}
            disabled={isSaving}
            label="Prices include GST"
          />
        </div>

        <div>
          <SectionLabel
            label="Highlight"
            hint="Marks this package as your most popular option"
          />
          <Checkbox
            checked={isPopular}
            onChange={setIsPopular}
            disabled={isSaving}
            label="Mark as most popular"
          />
        </div>
      </div>
    </Modal>
  )
}

/** Boxed percent input with a trailing "%", matching the Input primitive. */
function PercentField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="block text-caption font-medium text-text">{label}</label>
      <div className="flex h-8 items-center rounded-control border border-border bg-surface px-2.5 transition-colors focus-within:border-brand-fg">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="None"
          min="0"
          max="100"
          step="1"
          aria-label={`${label} percent`}
          className={`w-full bg-transparent text-caption tabular-nums text-text placeholder:text-text-subtle focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${noArrowsClass}`}
          disabled={disabled}
        />
        <span className="pl-1 text-caption text-text-muted">%</span>
      </div>
    </div>
  )
}
