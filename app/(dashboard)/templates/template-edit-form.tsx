/**
 * Shared create/edit form for an Invoice template.
 *
 * Both tabs edit the same shape — name, subtitle, applied notes, and a
 * list of priced line items — so they share this one form. It matches
 * the Packages modal: boxed sm inputs, section labels with muted
 * hints, the shared {@link LineItemsEditor} in a bordered card, and a
 * sticky footer carrying the live total beside Cancel / Save. It owns
 * its `Modal` (the manager mounts it only while open).
 *
 * Column semantics match packages: the "Subtitle" field binds to
 * `notes` (internal, shown in the template list) and the "Notes" field
 * binds to `description` (customer-facing, appended to the
 * invoice notes when the template is applied).
 *
 * "Price as a single figure" mirrors the package form: the line items
 * become unpriced inclusions and one template price is quoted. Applying a
 * single-price template writes ONE priced invoice line with the
 * inclusions in its note (see `singlePriceLine`).
 *
 * `sources` (when provided) surfaces the "Add from package" picker,
 * which snapshots a package's base items in — carrying its price across
 * whichever way either side is priced (see `mergeSourceIntoTemplate`).
 *
 * @module app/(dashboard)/templates/template-edit-form
 */
'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Toggle } from '@/components/ui/toggle'
import { formatAUD } from '@/lib/payments/format'
import { cleanLineItems } from '@/lib/payments/line-item-draft'
import { roundCents, type PackagePricingMode } from '@/lib/payments/package-math'

import { FixedPriceField } from './fixed-price-field'
import { LineItemsEditor, type EditableItem } from './line-items-editor'
import { mergeSourceIntoTemplate, type TemplateSource } from './template-source-merge'
import { TemplateSourcePicker } from './template-source-picker'

export type { TemplateSource } from './template-source-merge'

/** A line item as the managers persist it (no quantity). */
export interface TemplateItem {
  id: string
  description: string
  /** Optional per-line note carried onto the invoice when applied. */
  note?: string | null
  amount: number
}

/** The template fields the form edits and hands back on save. */
export interface TemplateFormValue {
  name: string
  /** Internal subtitle shown in the template list. */
  notes: string | null
  /** Customer-facing text applied to the invoice notes. */
  description: string | null
  /** 'single' hides per-item prices and quotes {@link fixed_price}. */
  pricing_mode: PackagePricingMode
  /** The whole price in single mode; null when itemised. */
  fixed_price: number | null
  items: TemplateItem[]
}

interface TemplateEditFormProps {
  /** Modal heading — e.g. "New Invoice Template". */
  title: string
  /** Muted line under the heading. */
  subtitle?: string
  value: TemplateFormValue
  onSave: (data: TemplateFormValue) => void
  onClose: () => void
  isSaving: boolean
  /** Placeholder for the name field. */
  namePlaceholder?: string
  /** Sources for the "Add from…" picker (omit to hide it). */
  sources?: TemplateSource[]
  /** Lowercased names already in use (excluding the template under edit). */
  takenNames?: Set<string>
}

export function TemplateEditForm({
  title,
  subtitle,
  value,
  onSave,
  onClose,
  isSaving,
  namePlaceholder = 'e.g., Standard package',
  sources,
  takenNames,
}: TemplateEditFormProps) {
  const [name, setName] = useState(value.name)
  const [notes, setNotes] = useState(value.notes ?? '')
  const [description, setDescription] = useState(value.description ?? '')
  // The editor works in EditableItem (carries a quantity these templates
  // don't use); we hold it at 1 and drop it on save.
  const [items, setItems] = useState<EditableItem[]>(value.items.map((i) => ({ ...i, quantity: 1 })))

  const [singlePrice, setSinglePrice] = useState(value.pricing_mode === 'single')
  const [fixedPrice, setFixedPrice] = useState(value.fixed_price != null ? String(value.fixed_price) : '')

  const parsedFixedPrice = Number.parseFloat(fixedPrice)
  const fixedPriceValue = Number.isFinite(parsedFixedPrice) && parsedFixedPrice >= 0 ? roundCents(parsedFixedPrice) : null
  const itemsSum = roundCents(items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0))
  const total = singlePrice ? (fixedPriceValue ?? 0) : itemsSum

  // Switching to one price seeds it with the current line total, so the
  // template's price doesn't silently drop to $0 the moment it's toggled.
  const toggleSinglePrice = (next: boolean) => {
    if (next && fixedPrice.trim() === '' && itemsSum > 0) setFixedPrice(String(itemsSum))
    setSinglePrice(next)
  }

  const cleaned = cleanLineItems(items)
  const nameTaken = !!takenNames?.has(name.trim().toLowerCase())
  const blocked = nameTaken || cleaned.blankPriced > 0
  const hint = nameTaken
    ? 'You already have a template with this name.'
    : cleaned.blankPriced > 0
      ? 'Give every priced line item a description.'
      : null

  const addFromSource = (s: TemplateSource) => {
    const next = mergeSourceIntoTemplate({ items, singlePrice, fixedPrice }, s)
    setItems(next.items)
    setSinglePrice(next.singlePrice)
    setFixedPrice(next.fixedPrice)
  }

  const handleSave = () => {
    if (!name.trim() || blocked) return
    onSave({
      name: name.trim(),
      notes: notes.trim() || null,
      description: description.trim() || null,
      pricing_mode: singlePrice ? 'single' : 'itemised',
      fixed_price: singlePrice ? fixedPriceValue : null,
      items: cleaned.items.map(({ id, description: desc, note, amount }) => ({
        id,
        description: desc,
        note: note ?? null,
        amount,
      })),
    })
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={
        <div className="min-w-0">
          <p className="text-section font-semibold text-text">{title}</p>
          {subtitle ? <p className="mt-0.5 text-body font-normal text-text-muted">{subtitle}</p> : null}
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-body font-medium uppercase tracking-wide text-text-muted">
              Template total
            </p>
            <p className="truncate text-section font-semibold tabular-nums text-text">
              {formatAUD(total)}
            </p>
            {hint ? <p className="text-body text-danger">{hint}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose} disabled={isSaving} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !name.trim() || blocked} loading={isSaving}>
              Save template
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Input
          label="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={namePlaceholder}
          disabled={isSaving}
          autoFocus
          required
        />

        <Input
          label="Subtitle"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Shown in your template list, not to couples"
          disabled={isSaving}
        />

        <div className="space-y-1">
          <label htmlFor="template-notes" className="block text-body font-medium text-text">
            Notes
          </label>
          <textarea
            id="template-notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Added to the invoice notes when this template is applied."
            disabled={isSaving}
            rows={3}
            className="block w-full resize-none rounded-control border border-border bg-surface px-2.5 py-2 text-body text-text placeholder:text-text-subtle transition-colors focus:border-brand-fg focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p>
              <span className="text-body font-medium text-text">Line items</span>
              <span className="ml-2 text-body text-text-muted">
                {singlePrice ? "What's included, without prices" : 'Applied to the invoice as-is'}
              </span>
            </p>
            {sources && sources.length > 0 ? <TemplateSourcePicker sources={sources} onPick={addFromSource} /> : null}
          </div>
          <div className="rounded-control border border-border px-4 pt-2 pb-1.5">
            <LineItemsEditor
              items={items}
              onChange={setItems}
              disabled={isSaving}
              descriptionPlaceholder="e.g., Reception MC"
              addLabel="Add line item"
              showAmount={!singlePrice}
              compact
              showNote
            />
          </div>
          <Toggle
            className="mt-3"
            checked={singlePrice}
            onChange={toggleSinglePrice}
            disabled={isSaving}
            label="Price as a single figure"
            description={
              singlePrice
                ? 'Applied as one priced line, with these items listed underneath it.'
                : 'The template total is the sum of the line items above.'
            }
          />
          {singlePrice && (
            <FixedPriceField
              id="template-fixed-price"
              label="Template price"
              value={fixedPrice}
              onChange={setFixedPrice}
              disabled={isSaving}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
