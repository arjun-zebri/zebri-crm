'use client'

/**
 * A plain-string label input with an `@` button beside it that drops a
 * `{{ id }}` token at the caret: the accept button and the packages CTA
 * keep their label as a plain string (no TipTap doc to hold a `variable`
 * chip), so variables reach them as `lib/branding/template-string.ts`
 * text instead, resolved on the public page by the same values map the
 * chips use. A fallback is typed by hand inside the token
 * (`{{couple_name | you two}}`); the popover's hint says so. The
 * rich-text `button` node's own label is a plain `Input` instead
 * (`node-bar-button.tsx`, 2026-09-19 feedback) - no variable insertion.
 *
 * @module features/proposals/editor/data/label-with-variables
 */
import * as Popover from '@radix-ui/react-popover'
import { AtSign } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuItem, MenuPanel } from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'
import { insertTemplateToken } from '@/lib/branding/template-string'

import { PROPOSAL_VARIABLES } from '../../model/variables'

/** Props for {@link LabelWithVariables}. */
export interface LabelWithVariablesProps {
  /** Visible label above the input, or (with `hideLabel`) its accessible name only. */
  label: string
  /** Renders the input without its visible label, for a toolbar row (`aria-label` carries the name). */
  hideLabel?: boolean
  value: string
  onChange: (value: string) => void
  /** The host commits its buffered value here (every label field buffers and commits on blur). */
  onBlur: () => void
  className?: string
}

/** A label `Input` plus the `@` variable picker. */
export function LabelWithVariables({ label, hideLabel = false, value, onChange, onBlur, className }: LabelWithVariablesProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Where the caret was when the field last lost focus: clicking the `@`
  // button blurs the input first, and an unfocused input reports
  // `selectionStart` 0 (live check: the token landed at the front). Null
  // until the field has been focused once, meaning "append".
  const caretRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)

  const pick = (id: string) => {
    const input = inputRef.current
    const next = insertTemplateToken(value, caretRef.current ?? value.length, id)
    onChange(next.value)
    setOpen(false)
    // Put the caret back after the token once the new value has rendered;
    // the popover just took focus, so the field has to be refocused too.
    caretRef.current = next.caret
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(next.caret, next.caret)
    })
  }

  return (
    <div className={`flex items-end gap-1${className ? ` ${className}` : ''}`}>
      <Input
        ref={inputRef}
        {...(hideLabel ? { 'aria-label': label } : { label })}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          caretRef.current = e.target.selectionStart
          onBlur()
        }}
        className="min-w-0 flex-1"
      />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Tooltip label="Insert variable">
          <Popover.Trigger asChild>
            <Button variant="ghost" iconOnly aria-label="Insert variable">
              <AtSign size={14} strokeWidth={1.5} />
            </Button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={6} className="z-[70] animate-modal-in">
            <MenuPanel width="sm" className="max-h-[320px] overflow-y-auto">
              {PROPOSAL_VARIABLES.map((v) => (
                <MenuItem key={v.id} onClick={() => pick(v.id)}>{v.label}</MenuItem>
              ))}
              <p className="px-2 py-1.5 text-body text-text-subtle">Add a fallback inside the braces: {'{{couple_name | you two}}'}</p>
            </MenuPanel>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
