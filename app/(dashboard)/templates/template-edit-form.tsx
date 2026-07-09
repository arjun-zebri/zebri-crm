/**
 * Shared create/edit form for a Quote or Invoice template.
 *
 * Both tabs edit the same shape — name, subtitle, applied notes, and a
 * list of priced line items — so they share this one form. It matches
 * the Packages modal: calm underline inputs, black section headers, the
 * shared {@link LineItemsEditor} grid, and a sticky Cancel / Save
 * footer. It owns its `Modal` (the manager mounts it only while open).
 *
 * Column semantics match packages: the "Subtitle" field binds to
 * `notes` (internal, shown in the template list) and the "Notes" field
 * binds to `description` (customer-facing, appended to the quote or
 * invoice notes when the template is applied).
 *
 * `sources` (when provided) surfaces the "Add from…" picker, which
 * snapshots a package's or quote template's line items in.
 *
 * @module app/(dashboard)/templates/template-edit-form
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Loader2, Package as PackageIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
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
  /** Customer-facing text applied to the quote/invoice notes. */
  description: string | null
  items: TemplateItem[]
}

/** A package or quote template whose items can be pulled into a template. */
export interface TemplateSource {
  id: string
  kind: 'package' | 'quote'
  name: string
  items: { description: string; amount: number }[]
}

interface TemplateEditFormProps {
  /** Modal heading — e.g. "New Quote Template". */
  title: string
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

const labelClass = 'mb-1 block text-sm font-medium text-text'
const inputClass =
  'w-full border-0 border-b border-border bg-transparent px-0 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong transition'

export function TemplateEditForm({
  title,
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
      title={title}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-danger">{hint ?? ''}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose} disabled={isSaving} variant="outline" size="sm">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !name.trim() || blocked} size="sm">
              {isSaving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className={labelClass}>
            Template name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
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
            placeholder="Shown in your template list, not to couples"
            disabled={isSaving}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Added to the quote or invoice notes when this template is applied."
            disabled={isSaving}
            rows={3}
            className="w-full resize-none border-0 border-b border-border bg-transparent px-0 py-1 text-sm text-text placeholder:text-text-subtle focus:border-border-strong focus:outline-none transition"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={labelClass}>Line items</label>
            {sources && sources.length > 0 ? <SourcePicker sources={sources} onPick={addFromSource} /> : null}
          </div>
          <LineItemsEditor
            items={items}
            onChange={setItems}
            disabled={isSaving}
            descriptionPlaceholder="e.g., Reception MC"
            addLabel="Add line item"
          />
          {items.length > 0 && (
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-sm text-text-muted">Total</span>
              <span className="text-sm font-semibold tabular-nums text-text">{formatAUD(total)}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ─── "Add from package or quote" picker ────────────────────────── */

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
  const quotes = sources.filter((s) => s.kind === 'quote')
  const pick = (s: TemplateSource) => {
    onPick(s)
    setOpen(false)
  }

  const triggerLabel = quotes.length > 0 ? 'Add from package or quote' : 'Add from package'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 py-1 text-sm text-text-muted transition hover:text-text cursor-pointer"
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
            <SourceGroup label="Quote templates" items={quotes} onPick={pick} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
