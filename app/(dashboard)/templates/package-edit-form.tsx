/**
 * Create/edit form for a package (v2 commercial fields).
 *
 * Single-column modal form: name, subtitle, description prose, two
 * drag-sortable item sections (base line items + optional add-ons),
 * then the pricing details that pre-fill the builders on apply
 * (booking deposit %, weekend loading %, GST-inclusive flag).
 *
 * Uses the same calm underline inputs as the Add Couple / Add Event
 * modals, and owns its `Modal` (mounted only while open by the manager)
 * with the shared sticky footer for Cancel / Save. State is local; the
 * manager owns persistence and passes the saved package in / takes the
 * draft out.
 *
 * @module app/(dashboard)/templates/package-edit-form
 */
'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Modal } from '@/components/ui/modal'
import { formatAUD } from '@/lib/payments/format'
import { packageTotals } from '@/lib/payments/package-math'

import { LineItemsEditor, noArrowsClass, type EditableItem } from './line-items-editor'

/** The draft a save hands back to the manager. */
export interface PackageDraft {
  name: string
  notes: string | null
  description: string | null
  deposit_percent: number | null
  gst_inclusive: boolean
  weekend_loading_percent: number | null
  /** Base items first, then add-ons: index is the save order. */
  items: (EditableItem & { optional: boolean })[]
}

/** The saved shape the form hydrates from (a `packages` row + items). */
export interface PackageFormValue {
  name: string
  notes: string | null
  description: string | null
  deposit_percent: number | null
  gst_inclusive: boolean
  weekend_loading_percent: number | null
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

/** Calm underline inputs, matching the couple/event modals. Section /
 *  field headers are full-strength text; sub-labels stay muted. */
const labelClass = 'mb-1 block text-sm font-medium text-text'
const subLabelClass = 'mb-1 block text-sm text-text-muted'
const inputClass =
  'w-full border-0 border-b border-border bg-transparent px-0 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong transition'

/** Parse an optional percent field: '' → null, clamped to 0–100. */
function parsePercent(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, 100)
}

export function PackageEditForm({ title, value, onSave, onClose, isSaving }: PackageEditFormProps) {
  const [name, setName] = useState(value.name)
  const [notes, setNotes] = useState(value.notes ?? '')
  const [description, setDescription] = useState(value.description ?? '')
  const [baseItems, setBaseItems] = useState<EditableItem[]>(value.items.filter((i) => !i.optional))
  const [addOns, setAddOns] = useState<EditableItem[]>(value.items.filter((i) => i.optional))
  const [depositPercent, setDepositPercent] = useState(value.deposit_percent?.toString() ?? '')
  const [weekendLoading, setWeekendLoading] = useState(value.weekend_loading_percent?.toString() ?? '')
  const [gstInclusive, setGstInclusive] = useState(value.gst_inclusive)

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
      deposit_percent: parsePercent(depositPercent),
      gst_inclusive: gstInclusive,
      weekend_loading_percent: parsePercent(weekendLoading),
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
      title={title}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose} disabled={isSaving} variant="outline" size="sm">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()} size="sm">
            {isSaving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : null}
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className={labelClass}>
            Package name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Gold Package"
            disabled={isSaving}
            autoFocus
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Subtitle</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Short description shown on the package list"
            disabled={isSaving}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="The details couples read before the prices."
            disabled={isSaving}
            rows={4}
            className="w-full resize-none border-0 border-b border-border bg-transparent px-0 py-1 text-sm text-text placeholder:text-text-subtle focus:border-border-strong focus:outline-none transition"
          />
        </div>

        <div>
          <label className={labelClass}>Line items</label>
          <LineItemsEditor
            items={baseItems}
            onChange={setBaseItems}
            disabled={isSaving}
            descriptionPlaceholder="e.g., MC Ceremony"
            addLabel="Add line item"
            showQuantity
            amountHeader="Unit price"
          />
        </div>

        <div>
          <label className={labelClass}>Optional add-ons</label>
          <p className="mt-2 mb-3 text-xs text-text-muted">
            Extras offered alongside the package. You pick which ones to include when quoting.
          </p>
          <LineItemsEditor
            items={addOns}
            onChange={setAddOns}
            disabled={isSaving}
            descriptionPlaceholder="e.g., Rehearsal attendance"
            addLabel="Add add-on"
            showQuantity
            amountHeader="Unit price"
          />
        </div>

        <div>
          <label className={labelClass}>Pricing details</label>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <PercentField
              label="Booking deposit"
              value={depositPercent}
              onChange={setDepositPercent}
              disabled={isSaving}
            />
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

        {(baseItems.length > 0 || addOns.length > 0) && (
          <div className="space-y-1 border-t border-border pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-text-muted">Package total</span>
              <span className="text-sm font-semibold tabular-nums text-text">{formatAUD(totals.base)}</span>
            </div>
            {totals.addOns > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-text-muted">With all add-ons</span>
                <span className="text-xs tabular-nums text-text-muted">{formatAUD(totals.full)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Underline percent input with a trailing "%", matching the form's inputs. */
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
    <div>
      <label className={subLabelClass}>{label}</label>
      <div className="flex items-center border-b border-border transition focus-within:border-border-strong">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="None"
          min="0"
          max="100"
          step="1"
          aria-label={`${label} percent`}
          className={`w-full bg-transparent px-0 py-2 text-left text-sm tabular-nums text-text placeholder:text-text-subtle focus:outline-none ${noArrowsClass}`}
          disabled={disabled}
        />
        <span className="pl-1 text-sm text-text-muted">%</span>
      </div>
    </div>
  )
}
