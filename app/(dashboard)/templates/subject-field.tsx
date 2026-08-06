/**
 * Subject input with variable insertion.
 *
 * The subject is a mustache string, so variables land as
 * `{{ expression }}` tokens. Two ways in, mirroring the body editor:
 * the "Insert variable" popover (appends at the end), and typing `@`
 * at the start of a word, which opens the same keyboard-navigable
 * floating list the body uses and splices the token at the caret.
 *
 * @module app/(dashboard)/templates/subject-field
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import type { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { AtSign } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { VariableSuggestionList, type ListHandle } from '@/components/ui/variable-suggestion'
import { EMAIL_TEMPLATE_VARIABLES } from '@/lib/email/template-variables'

interface SubjectFieldProps {
  value: string
  onChange: (value: string) => void
}

/** An active `@` trigger: where it starts and what's typed after it. */
interface AtTrigger {
  start: number
  query: string
}

export function SubjectField({ value, onChange }: SubjectFieldProps) {
  const [open, setOpen] = useState(false)
  const [trigger, setTrigger] = useState<AtTrigger | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<ListHandle>(null)

  const items = useMemo(() => {
    const q = (trigger?.query ?? '').toLowerCase()
    return EMAIL_TEMPLATE_VARIABLES.filter(
      (v) => !q || v.label.toLowerCase().includes(q) || v.id.toLowerCase().includes(q),
    )
  }, [trigger?.query])

  // Toolbar-popover path: append the token at the end.
  const insertAtEnd = (id: string) => {
    const sep = value && !value.endsWith(' ') ? ' ' : ''
    onChange(`${value}${sep}{{${id}}}`)
    setOpen(false)
  }

  /**
   * Find an active `@` trigger at the caret: an `@` at the start of a
   * word (line start or after whitespace) with no whitespace between it
   * and the caret — the same rule the body editor's suggestion uses, so
   * typed email addresses never false-trigger.
   */
  const detectTrigger = () => {
    const el = inputRef.current
    if (!el) return setTrigger(null)
    const caret = el.selectionStart ?? 0
    const upto = el.value.slice(0, caret)
    const at = upto.lastIndexOf('@')
    if (at < 0) return setTrigger(null)
    if (at > 0 && !/\s/.test(upto[at - 1]!)) return setTrigger(null)
    const query = upto.slice(at + 1)
    if (/\s/.test(query)) return setTrigger(null)
    setTrigger({ start: at, query })
  }

  // Trigger path: replace `@query` with the token, caret placed after it.
  const insertAtTrigger = (id: string) => {
    const el = inputRef.current
    if (!el || !trigger) return
    const caret = el.selectionStart ?? el.value.length
    const token = `{{${id}}} `
    onChange(el.value.slice(0, trigger.start) + token + el.value.slice(caret))
    setTrigger(null)
    const pos = trigger.start + token.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!trigger) return
    if (e.key === 'Escape') {
      setTrigger(null)
      return
    }
    // Route navigation into the shared list; it returns true when handled.
    const handled = listRef.current?.onKeyDown({ event: e.nativeEvent } as SuggestionKeyDownProps)
    if (handled) e.preventDefault()
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-caption font-medium text-text" htmlFor="template-subject">
          Subject
        </label>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1.5 rounded-control border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-caption font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              <AtSign size={13} strokeWidth={1.5} />
              Insert variable
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={6}
              className="z-[90] w-56 rounded-control border border-border bg-card p-1 shadow-lg"
            >
              <div className="max-h-72 overflow-y-auto">
                {EMAIL_TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => insertAtEnd(v.id)}
                    className="w-full cursor-pointer rounded-control px-2 py-1 text-left hover:bg-surface-muted"
                  >
                    <p className="truncate text-caption text-text">{v.label}</p>
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {/* Relative wrapper anchors the @-suggestion float to the input. */}
      <div className="relative">
        <Input
          id="template-subject"
          ref={inputRef}
          size="sm"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            detectTrigger()
          }}
          onSelect={detectTrigger}
          onKeyDown={onKeyDown}
          onBlur={() => setTrigger(null)}
          placeholder="e.g. Your invoice from {{mc.business_name}}"
        />
        {trigger && (
          // onMouseDown preventDefault keeps the input focused so a
          // click on an option lands before the blur-close.
          <div className="absolute left-0 top-full z-[90] mt-1" onMouseDown={(e) => e.preventDefault()}>
            <VariableSuggestionList ref={listRef} items={items} command={({ id }) => insertAtTrigger(id)} />
          </div>
        )}
      </div>
    </div>
  )
}
