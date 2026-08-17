'use client'

import * as Popover from '@radix-ui/react-popover'
import { Check, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

import type { Block, FormFieldBlock, FormFieldInputType, FormFieldRole, FormSubmitBlock } from './types'

/** Friendly labels for each field role, in the order the MC most often adds them. */
const ROLE_OPTIONS: { value: FormFieldRole; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'partnerName', label: 'Partner name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'weddingDate', label: 'Wedding date' },
  { value: 'venue', label: 'Venue' },
  { value: 'message', label: 'Message' },
  { value: 'referral', label: 'How they found you' },
  { value: 'custom', label: 'Custom' },
]

/** Friendly labels for each rendered input control. */
const TYPE_OPTIONS: { value: FormFieldInputType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Paragraph' },
  { value: 'select', label: 'Dropdown' },
]

type UpdateBlock = <B extends Block>(id: string, patch: Partial<B>) => void

/**
 * A toolbar control with a small caption above it saying what it edits,
 * mirroring the toolbar's existing label style. The form controls need
 * these: three unlabelled inputs in a row don't explain themselves.
 */
function LabelledControl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-text-subtle uppercase tracking-[0.08em]">{label}</span>
      {children}
    </div>
  )
}

/**
 * Toolbar controls for a selected {@link FormFieldBlock}. Lets the MC set the
 * field's role (how the answer maps to a couple), the rendered input type, its
 * label and placeholder, whether it is required, and, for a dropdown, the list
 * of options. Every change is emitted through {@link UpdateBlock}.
 */
export function FormFieldControls({ block, updateBlock }: { block: FormFieldBlock; updateBlock: UpdateBlock }) {
  const patch = (p: Partial<FormFieldBlock>) => updateBlock<FormFieldBlock>(block.id, p)
  return (
    <div className="flex flex-wrap items-end gap-2">
      <LabelledControl label="Maps to">
        <div className="w-36">
          <Select options={ROLE_OPTIONS} value={block.role} onValueChange={(v) => patch({ role: v as FormFieldRole })} />
        </div>
      </LabelledControl>
      <LabelledControl label="Input type">
        <div className="w-32">
          <Select
            options={TYPE_OPTIONS}
            value={block.inputType}
            onValueChange={(v) => patch({ inputType: v as FormFieldInputType })}
          />
        </div>
      </LabelledControl>
      <LabelledControl label="Question">
        <div className="w-36">
          <Input aria-label="Field label" value={block.label} placeholder="Label" onChange={(e) => patch({ label: e.target.value })} />
        </div>
      </LabelledControl>
      <LabelledControl label="Placeholder">
        <div className="w-36">
          <Input
            aria-label="Placeholder"
            value={block.placeholder ?? ''}
            placeholder="Placeholder"
            onChange={(e) => patch({ placeholder: e.target.value })}
          />
        </div>
      </LabelledControl>
      <RequiredToggle active={block.required} onChange={(v) => patch({ required: v })} />
      {block.inputType === 'select' && <OptionsControl block={block} onChange={(options) => patch({ options })} />}
    </div>
  )
}

/**
 * Toolbar controls for the selected {@link FormSubmitBlock}: the button label,
 * the after-submit behaviour (show a message or redirect to the MC's own
 * thank-you page), and the message or URL that behaviour uses.
 */
export function FormSubmitControls({ block, updateBlock }: { block: FormSubmitBlock; updateBlock: UpdateBlock }) {
  const patch = (p: Partial<FormSubmitBlock>) => updateBlock<FormSubmitBlock>(block.id, p)
  const mode = block.successMode ?? 'message'
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap items-end gap-2">
        <LabelledControl label="Button label">
          <div className="w-40">
            <Input aria-label="Button label" value={block.label} placeholder="Button label" onChange={(e) => patch({ label: e.target.value })} />
          </div>
        </LabelledControl>
        <LabelledControl label="After sending">
          <div className="w-40">
            <Select
              options={[
                { value: 'message', label: 'Show a message' },
                { value: 'redirect', label: 'Redirect to a URL' },
              ]}
              value={mode}
              onValueChange={(v) => patch({ successMode: v as 'message' | 'redirect' })}
            />
          </div>
        </LabelledControl>
      </div>
      {/* The message / URL gets its own full-width row: it is a sentence, not a
          setting, and cramming it beside the selects truncated it. */}
      {mode === 'message' ? (
        <LabelledControl label="Success message">
          <Input
            aria-label="Success message"
            value={block.successMessage}
            placeholder="Message shown after sending"
            onChange={(e) => patch({ successMessage: e.target.value })}
          />
        </LabelledControl>
      ) : (
        <LabelledControl label="Redirect URL">
          <Input
            aria-label="Redirect URL"
            type="url"
            value={block.redirectUrl ?? ''}
            placeholder="https://yoursite.com/thank-you"
            onChange={(e) => patch({ redirectUrl: e.target.value })}
          />
        </LabelledControl>
      )}
    </div>
  )
}

/** A required on/off pill, mirroring the toolbar's shared Toggle look. */
function RequiredToggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2 h-8 rounded-control text-body cursor-pointer border ${
        active ? 'bg-gray-900 text-white border-gray-900' : 'bg-surface text-gray-600 border-border hover:text-text'
      }`}
    >
      {active && <Check size={11} strokeWidth={2.5} />}
      Required
    </button>
  )
}

/** Popover editor for a dropdown field's options: add, edit, and remove strings. */
function OptionsControl({ block, onChange }: { block: FormFieldBlock; onChange: (options: string[]) => void }) {
  const options = block.options ?? []
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 h-8 rounded-control text-body border cursor-pointer bg-surface text-gray-600 border-border hover:text-text"
        >
          Options
          {options.length > 0 && <span className="font-mono text-[10px]">{options.length}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="bg-surface border border-border rounded-control shadow-xl p-3 z-[60] w-[240px] animate-modal-in"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] text-text-subtle uppercase tracking-[0.08em] mb-2">Dropdown options</p>
          <div className="space-y-1.5">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex-1">
                  <Input
                    aria-label={`Option ${i + 1}`}
                    value={opt}
                    placeholder={`Option ${i + 1}`}
                    onChange={(e) => onChange(options.map((o, idx) => (idx === i ? e.target.value : o)))}
                  />
                </div>
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={`Remove option ${i + 1}`}
                  onClick={() => onChange(options.filter((_, idx) => idx !== i))}
                >
                  <X size={14} strokeWidth={1.5} />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-2 w-full gap-1.5" onClick={() => onChange([...options, ''])}>
            <Plus size={14} strokeWidth={1.5} />
            Add option
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
