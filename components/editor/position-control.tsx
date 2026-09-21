'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown } from 'lucide-react'

import { Tooltip } from '@/components/ui/tooltip'

/**
 * Where a block's text sits, as one 3x3-grid control. Moved from the
 * Branding editor's hero block (Proposal Layout v2 Phase 2, spec 5.3) so
 * the proposal section editor can reuse it.
 *
 * @module components/editor/position-control
 */

// The source of truth for these two unions is `HeroBlock['textAlign']` /
// `HeroBlock['verticalAlign']` in app/(dashboard)/branding/blocks/types.ts.
// They are copied here, not imported, because the layering rule for this
// migration (Proposal Layout v2 Phase 2, spec 5.3) forbids components/editor/
// from importing app/ or features/: if HeroBlock's alignment values ever
// change, update both definitions by hand.
type H = 'left' | 'center' | 'right'
type V = 'top' | 'middle' | 'bottom'

const ROWS: readonly V[] = ['top', 'middle', 'bottom']
const COLS: readonly H[] = ['left', 'center', 'right']
const ROW_LABEL: Record<V, string> = { top: 'Top', middle: 'Middle', bottom: 'Bottom' }
const COL_LABEL: Record<H, string> = { left: 'left', center: 'centre', right: 'right' }

/** A 3x3 glyph with the cell at (v, h) filled: the button's face and each grid cell. */
function PositionGlyph({ h, v, size = 14 }: { h: H; v: V; size?: number }) {
  const cx = { left: 3, center: 6, right: 9 }[h]
  const cy = { top: 3, middle: 6, bottom: 9 }[v]
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <rect x={cx - 1} y={cy - 1} width="4" height="4" rx="1" fill="currentColor" />
    </svg>
  )
}

/**
 * Where the hero's text sits, as one control: a button showing the current
 * cell that opens a 3x3 grid (top/middle/bottom x left/centre/right), the
 * way Canva places text in a frame. One button instead of two segmented
 * toggles keeps the toolbar row the same width as every other block's.
 */
export function PositionControl({ h, v, onChange }: { h: H; v: V; onChange: (h: H, v: V) => void }) {
  return (
    <Popover.Root>
      <Tooltip label="Text position">
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Position"
            className="inline-flex items-center gap-1 px-2 h-8 rounded-control text-body hover:bg-surface-emphasis cursor-pointer text-gray-700 border border-border shrink-0"
          >
            <PositionGlyph h={h} v={v} />
            <ChevronDown size={10} strokeWidth={2} className="text-text-subtle" />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="bg-surface border border-border rounded-control shadow-xl p-1.5 z-[60] animate-modal-in"
        >
          <div role="radiogroup" aria-label="Text position" className="grid grid-cols-3 gap-0.5">
            {ROWS.map((row) =>
              COLS.map((col) => {
                const active = row === v && col === h
                return (
                  <Popover.Close key={`${row}-${col}`} asChild>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${ROW_LABEL[row]} ${COL_LABEL[col]}`}
                      onClick={() => onChange(col, row)}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-control cursor-pointer transition ${
                        active ? 'bg-surface-emphasis text-text' : 'text-text-muted hover:text-text hover:bg-surface-emphasis'
                      }`}
                    >
                      <PositionGlyph h={col} v={row} size={16} />
                    </button>
                  </Popover.Close>
                )
              }),
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
