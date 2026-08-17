/**
 * Controls used inside trigger filter chips.
 *
 * These live in a Radix Popover, so nothing here may open a portal of
 * its own: a nested portal registers as an interaction outside the
 * popover and dismisses it on the first click. That rules out the
 * design-system `Select` (Radix, portalled), which is why the operator
 * choices below are `MenuItem` rows.
 *
 * @module app/(dashboard)/automations/[id]/filter-controls
 */
'use client'

import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { MenuItem } from '@/components/ui/menu'

/**
 * Number field plus, when there is a choice to make, a list of
 * comparison operators. Backs every filter that compares a quantity:
 * "at most 14 days", "at least $2,000", "3 days before the due date".
 *
 * Shape follows the trigger picker: a borderless field in a bordered
 * header, then rows. A bordered input inside the popover would put a
 * box inside a box, and the operators as a wrapping row of pills broke
 * across two ragged lines as soon as there were more than three.
 *
 * The number commits on blur / Enter rather than per keystroke:
 * clearing the box to retype momentarily parses as `NaN`, the parent
 * writes a fallback back in, and the caret jumps.
 *
 * @param ops - Operator choices. One (or none) renders the field
 *   alone, for triggers whose number is a parameter rather than a
 *   comparison.
 * @param prefix - Sits before the number, e.g. `$`.
 * @param unit - Sits after the number, e.g. `days`.
 * @param hint - One line under the field, for a parameter that needs
 *   explaining ("0 fires on the day").
 */
export function ComparisonControl({
  op,
  value,
  ops = [],
  prefix,
  unit,
  hint,
  onChange,
}: {
  op?: string
  value: number
  ops?: { value: string; label: string }[]
  prefix?: string
  unit?: string
  hint?: string
  onChange: (op: string, value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    if (Number(draft) !== value) setDraft(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function commit() {
    // An empty box reverts rather than committing 0: clearing it is
    // how you start retyping, not how you ask for zero. Typing an
    // explicit "0" still does that.
    const next = draft === '' ? value : Number(draft)
    setDraft(String(next))
    if (next !== value) onChange(op ?? '', next)
  }

  // Dismissing the popover — clicking the canvas, pressing Escape —
  // unmounts this field, and React does not deliver a blur to an
  // element that is already gone. Without this the number you just
  // typed is thrown away unless you happen to click an operator row
  // afterwards. Committing again from the cleanup is harmless: by
  // then a blur-committed draft already equals `value`.
  const latest = useRef({ draft, value, op, onChange })
  useEffect(() => {
    latest.current = { draft, value, op, onChange }
  })
  useEffect(
    () => () => {
      const { draft: pending, value: committed, op: operator, onChange: emit } = latest.current
      if (pending === '') return
      const next = Number(pending)
      if (next !== committed) emit(operator ?? '', next)
    },
    [],
  )

  // The field's own rule doubles as the separator above the operator
  // rows, and is dropped entirely when there are none — otherwise it
  // dangles under the last thing in the panel.
  const hasOps = ops.length > 1

  return (
    <>
      <div
        className={`flex items-baseline gap-1.5 px-3 py-2${
          hasOps ? ' border-b border-border' : ''
        }`}
      >
        {prefix ? <span className="shrink-0 text-text-subtle">{prefix}</span> : null}
        <input
          // Text, not number: a text input has no spinner arrows, and
          // `inputMode` still brings up the numeric keypad on mobile.
          // The chip popover prevents Radix's select-all auto-focus
          // and focuses this field itself (see trigger-filter-list).
          type="text"
          inputMode="numeric"
          value={draft}
          // Digits only, dropped as they are typed rather than
          // repaired on blur: a letter should not be able to appear
          // in a field that only ever holds a whole number. Also
          // cleans up a pasted "1,000" or "$1,000".
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          aria-label={unit ? `Number of ${unit}` : 'Amount'}
          className="w-full min-w-0 flex-1 bg-transparent text-body tabular-nums text-text focus:outline-none"
        />
        {unit ? <span className="shrink-0 text-text-subtle">{unit}</span> : null}
      </div>

      {hint ? <div className="px-3 pt-2 text-body text-text-subtle">{hint}</div> : null}

      {hasOps
        ? ops.map((option) => (
            <MenuItem
              key={option.value}
              selected={option.value === op}
              trailing={option.value === op ? <Check size={14} strokeWidth={1.5} /> : null}
              onClick={() => onChange(option.value, value)}
            >
              {option.label}
            </MenuItem>
          ))
        : null}
    </>
  )
}
