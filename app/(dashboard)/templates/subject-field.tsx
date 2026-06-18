/**
 * Subject input with an "Insert variable" popover.
 *
 * The subject is a mustache string, so inserting a variable appends a
 * `{{ expression }}` token. Mirrors the body editor's variable popover
 * for a consistent authoring feel.
 *
 * @module app/(dashboard)/templates/subject-field
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { AtSign } from 'lucide-react'
import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { EMAIL_TEMPLATE_VARIABLES } from '@/lib/email/template-variables'

interface SubjectFieldProps {
  value: string
  onChange: (value: string) => void
}

export function SubjectField({ value, onChange }: SubjectFieldProps) {
  const [open, setOpen] = useState(false)

  const insert = (id: string) => {
    const sep = value && !value.endsWith(' ') ? ' ' : ''
    onChange(`${value}${sep}{{${id}}}`)
    setOpen(false)
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm font-medium text-text" htmlFor="template-subject">
          Subject
        </label>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2 py-1 text-xs font-medium text-text-muted transition hover:bg-surface"
            >
              <AtSign size={13} strokeWidth={1.5} />
              Insert variable
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={6}
              className="z-[90] w-72 rounded-xl border border-border bg-card p-1.5 shadow-lg"
            >
              <div className="max-h-72 overflow-y-auto">
                {EMAIL_TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => insert(v.id)}
                    className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left hover:bg-surface-muted"
                  >
                    <p className="text-sm text-text">{v.label}</p>
                    <p className="text-xs text-text-subtle">{v.description}</p>
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <Input
        id="template-subject"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Your quote from {{mc.business_name}}"
      />
    </div>
  )
}
