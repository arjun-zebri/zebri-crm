'use client'

/**
 * An in-card dollar field for the packages editor: a package's fixed price
 * and each line's amount, typed straight into the card where the sent
 * proposal shows the figure. Buffers the keystrokes locally and commits
 * one parsed number on blur or Enter, so a half-typed "12" never lands
 * in the layout as a $12 package, and the layout history gets one entry
 * per edit rather than one per keystroke.
 *
 * A bare `<input>` on purpose, like the add-on checkbox in
 * `lib/branding/public-blocks/proposal/package-addons.tsx`: the app's
 * `Input` primitive carries Zebri's own tokens (32px, border, app font),
 * which would sit inside the MC-branded card as a foreign control. This
 * one inherits the card's type and colour and draws nothing of its own,
 * focused or not (no ring, no fill, just the caret), the same rule
 * `InlineField` follows for text; a boxed "$0" on a branded card read as
 * a foreign control (2026-09-20 feedback).
 *
 * @module features/proposals/editor/data/inline-number
 */
import { useState, type KeyboardEvent } from 'react'

import type { PackagePriceDecimals } from '@/lib/proposals/types'

/** Props for {@link InlineNumber}. */
export interface InlineNumberProps {
  /** Dollars. */
  value: number
  /** Accessible name, e.g. "Price" or "Amount for Extra hour". */
  label: string
  /** Called with the parsed value on blur/Enter when it differs from `value`. */
  onCommit: (value: number) => void
  /** Upper bound; anything above is clamped. */
  max: number
  /**
   * The card's price format (2026-09-20 feedback). `whole` rests without
   * cents, refuses a typed decimal point and rounds whatever is committed
   * (a pasted "1,999.5" lands as 2000); `cents` (the default) allows two
   * decimal places, matching what `fmt` shows on the sent card.
   */
  decimals?: PackagePriceDecimals | undefined
  /** Fired on focus so the owning section selects (mirrors `InlineField.onFocus`). */
  onFocus?: (() => void) | undefined
  className?: string
}

/** The resting text: the same `1,650.00` (or `1,650` in whole mode) the sent card shows (`fmt` in `public-blocks/shared.ts`, minus the `$` this field draws itself). */
function format(value: number, decimals: PackagePriceDecimals): string {
  const places = decimals === 'whole' ? 0 : 2
  return value.toLocaleString('en-AU', { minimumFractionDigits: places, maximumFractionDigits: places })
}

/** The editing text: bare digits, so the caret lands in a number rather than between thousands commas. Whole mode edits the rounded figure it rests on. */
function editable(value: number, decimals: PackagePriceDecimals): string {
  if (decimals === 'whole') return String(Math.round(value))
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/** Parses what was typed; `null` when it is not a usable amount. Strips a leading `$` and thousands commas so a pasted "$1,650" works; whole mode rounds to the dollar. */
function parse(text: string, max: number, decimals: PackagePriceDecimals): number | null {
  const n = Number(text.replace(/[$,\s]/g, ''))
  if (text.trim() === '' || !Number.isFinite(n) || n < 0) return null
  const clamped = Math.min(n, max)
  return decimals === 'whole' ? Math.round(clamped) : Math.round(clamped * 100) / 100
}

/** A dollar field that inherits the surrounding card type; commits on blur or Enter. */
export function InlineNumber({ value, label, onCommit, max, decimals = 'cents', onFocus, className = '' }: InlineNumberProps) {
  // The buffer only exists while focused; at rest the field shows `value`
  // itself, so an outside change (undo, a pricing-mode switch) shows up
  // with no effect to sync it.
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const shown = focused ? text : format(value, decimals)

  const commit = () => {
    const parsed = parse(text, max, decimals)
    if (parsed !== null && parsed !== value) onCommit(parsed)
  }

  const onFieldFocus = () => {
    setFocused(true)
    setText(editable(value, decimals))
    onFocus?.()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
    if (event.key === 'Escape') { event.preventDefault(); setText(editable(value, decimals)); event.currentTarget.blur() }
    // Whole mode refuses the decimal point at the keystroke rather than
    // scrubbing it from the buffer: scrubbing would turn a pasted
    // "1,999.5" into 19,995, whereas leaving the paste intact lets
    // `parse` round it to 2,000.
    if (decimals === 'whole' && event.key === '.') event.preventDefault()
  }

  return (
    <span className={`inline-flex items-baseline ${className}`}>
      <span aria-hidden="true">$</span>
      <input
        type="text"
        inputMode={decimals === 'whole' ? 'numeric' : 'decimal'}
        aria-label={label}
        value={shown}
        size={Math.max(2, shown.length)}
        onChange={(e) => setText(e.target.value)}
        onFocus={onFieldFocus}
        onBlur={() => { setFocused(false); commit() }}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="min-w-0 border-0 bg-transparent p-0 outline-none focus:ring-0"
      />
    </span>
  )
}
