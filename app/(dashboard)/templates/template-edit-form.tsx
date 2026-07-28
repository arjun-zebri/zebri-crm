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
 * `sources` (when provided) surfaces the "Add from…" picker, which
 * snapshots a package's line items in.
 *
 * @module app/(dashboard)/templates/template-edit-form
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Package as PackageIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatAUD } from '@/lib/payments/format'
import { cleanLineItems } from '@/lib/payments/line-item-draft'

import { LineItemsEditor, type EditableItem } from './line-items-editor'

/** A line item as the managers persist it (no quantity). */
export interface TemplateItem {
  id: string
  description: string
  amount: number
}

/** The template fields the form edits and hands back on save. */
export interface TemplateFormValue {
  name: string
  /** Internal subtitle shown in the template list. */
  notes: string | null
  /** Customer-facing text applied to the invoice notes. */
  description: string | null
  items: TemplateItem[]
}

/** A package whose items can be pulled into a template. */
export interface TemplateSource {
  id: string
  kind: 'package'
  name: string
  items: { description: string; amount: number }[]
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

  const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)

  const cleaned = cleanLineItems(items)
  const nameTaken = !!takenNames?.has(name.trim().toLowerCase())
  const blocked = nameTaken || cleaned.blankPriced > 0
  const hint = nameTaken
    ? 'You already have a template with this name.'
    : cleaned.blankPriced > 0
      ? 'Give every priced line item a description.'
      : null

  const addFromSource = (s: TemplateSource) =>
    setItems((prev) => [
      ...prev,
      ...s.items.map((it) => ({ id: `new-${crypto.randomUUID()}`, description: it.description, amount: it.amount, quantity: 1 })),
    ])

  const handleSave = () => {
    if (!name.trim() || blocked) return
    onSave({
      name: name.trim(),
      notes: notes.trim() || null,
      description: description.trim() || null,
      items: cleaned.items.map(({ id, description: desc, amount }) => ({ id, description: desc, amount })),
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
          {subtitle ? <p className="mt-0.5 text-sm font-normal text-text-muted">{subtitle}</p> : null}
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Template total
            </p>
            <p className="truncate text-xl font-semibold tabular-nums text-text">
              {formatAUD(total)}
            </p>
            {hint ? <p className="text-xs text-danger">{hint}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose} disabled={isSaving} variant="outline" size="sm">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !name.trim() || blocked} loading={isSaving} size="sm">
              Save template
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Input
          label="Template name"
          size="sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={namePlaceholder}
          disabled={isSaving}
          autoFocus
          required
        />

        <Input
          label="Subtitle"
          size="sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Shown in your template list, not to couples"
          disabled={isSaving}
        />

        <div className="space-y-1">
          <label htmlFor="template-notes" className="block text-caption font-medium text-text">
            Notes
          </label>
          <textarea
            id="template-notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Added to the invoice notes when this template is applied."
            disabled={isSaving}
            rows={3}
            className="block w-full resize-none rounded-control border border-border bg-surface px-2.5 py-2 text-caption text-text placeholder:text-text-subtle transition-colors focus:border-brand-fg focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p>
              <span className="text-sm font-medium text-text">Line items</span>
              <span className="ml-2 text-xs text-text-muted">Applied to the document as-is</span>
            </p>
            {sources && sources.length > 0 ? <SourcePicker sources={sources} onPick={addFromSource} /> : null}
          </div>
          <div className="rounded-xl border border-border px-4 pt-2 pb-1.5">
            <LineItemsEditor
              items={items}
              onChange={setItems}
              disabled={isSaving}
              descriptionPlaceholder="e.g., Reception MC"
              addLabel="Add line item"
              compact
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ─── "Add from package" picker ─────────────────────────────────── */

function SourceGroup({
  label,
  items,
  onPick,
}: {
  label: string
  items: TemplateSource[]
  onPick: (s: TemplateSource) => void
}) {
  if (items.length === 0) return null
  return (
    <>
      <p className="px-2 pt-2 pb-1 text-xs font-medium text-text-subtle">{label}</p>
      {items.map((s) => (
        <button
          key={`${s.kind}-${s.id}`}
          type="button"
          onClick={() => onPick(s)}
          className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-surface-muted cursor-pointer"
        >
          <span className="truncate text-sm text-text">{s.name}</span>
          <span className="shrink-0 text-xs text-text-subtle">
            {s.items.length} item{s.items.length !== 1 ? 's' : ''}
          </span>
        </button>
      ))}
    </>
  )
}

function SourcePicker({ sources, onPick }: { sources: TemplateSource[]; onPick: (s: TemplateSource) => void }) {
  const [open, setOpen] = useState(false)
  const packages = sources.filter((s) => s.kind === 'package')
  const pick = (s: TemplateSource) => {
    onPick(s)
    setOpen(false)
  }

  const triggerLabel = 'Add from package'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 py-1 text-caption text-text-muted transition hover:text-text cursor-pointer"
        >
          <PackageIcon size={14} strokeWidth={1.5} />
          {triggerLabel}
          <ChevronDown size={13} strokeWidth={1.5} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[90] w-64 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          <div className="max-h-64 overflow-y-auto">
            <SourceGroup label="Packages" items={packages} onPick={pick} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
