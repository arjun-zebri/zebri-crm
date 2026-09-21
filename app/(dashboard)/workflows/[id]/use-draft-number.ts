/**
 * Hold a typed number as a local draft until the MC leaves the field.
 *
 * A controlled number input that snaps on every keystroke cannot be typed
 * into: with minutes on a 15-step grid, "3" snaps to 15 and the next "0"
 * makes 150, so 30 is unreachable, and on a phone there are no arrow keys
 * to fall back on. The draft absorbs the keystrokes; the parent only ever
 * sees the committed, snapped value, on blur or Enter.
 *
 * @module app/(dashboard)/workflows/[id]/use-draft-number
 */
import { useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

/** Props to spread onto a number `Input`. */
export interface DraftNumberField {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
}

/**
 * @param committed The value the parent holds; shown whenever no draft is open.
 * @param resetKey Changes here (unit, mode) discard an open draft, so a
 *   number typed for "minutes" is never committed against "days".
 * @param commit Receives the parsed draft; the caller snaps it to the grid.
 */
export function useDraftNumber(
  committed: number,
  resetKey: string,
  commit: (n: number) => void,
): DraftNumberField {
  const [draft, setDraft] = useState<string | null>(null)
  // Render-phase reset keyed on the shape the number belongs to (the React
  // docs pattern for state derived from a prop), rather than an effect that
  // would flash the stale draft for one frame.
  const [seenKey, setSeenKey] = useState(resetKey)
  if (seenKey !== resetKey) {
    setSeenKey(resetKey)
    setDraft(null)
  }

  function flush() {
    if (draft === null) return
    commit(Number(draft) || 0)
    setDraft(null)
  }

  return {
    value: draft ?? String(committed),
    onChange: (e) => setDraft(e.currentTarget.value),
    onBlur: flush,
    onKeyDown: (e) => {
      if (e.key === 'Enter') flush()
    },
  }
}
