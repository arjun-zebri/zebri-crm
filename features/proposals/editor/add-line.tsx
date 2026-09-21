'use client'

/**
 * The insert affordance between two canvas sections: a hover-only "+" line,
 * or, as the trailing element after the last section, a persistent "Add
 * section" button. Both only report where a new section goes and (for the
 * hover line) which element to anchor the add palette to; `SectionCanvas`
 * mounts the palette itself (`add-palette.tsx`, Task 8) and passes down
 * `onRequestAdd`.
 *
 * Task 15: once the layout already holds `LAYOUT_LIMITS.maxSections`
 * sections, both forms disable rather than opening a palette whose every
 * choice the reducer's own `addSection` cap would silently refuse -
 * `SectionCanvas` computes `atCap` once, from the live section count, and
 * passes it to every `AddLine` (this one and the one `editable-section.tsx`
 * renders after each section).
 *
 * @module features/proposals/editor/add-line
 */
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

/** Shown on every disabled add control once the layout is at `LAYOUT_LIMITS.maxSections`. */
export const SECTION_CAP_MESSAGE = 'Templates hold up to 40 sections'

/** Props for {@link AddLine}. */
export interface AddLineProps {
  /** Layout index a new section would be inserted at. */
  index: number
  /**
   * `anchor` is the clicked element, passed through so the caller can pop
   * the add palette from that exact spot (a Radix Popover). The trailing
   * button never passes one, so the palette opens as a full `Modal` there
   * instead, since "anchored to the button at the bottom of the page"
   * reads as a popover floating in empty space below the fold.
   */
  onRequestAdd: (at: number, anchor?: HTMLElement) => void
  /** Renders the persistent trailing "Add section" button instead of the hover-only line. */
  trailing?: boolean
  /** Disables the control and swaps its tooltip for `SECTION_CAP_MESSAGE` once the layout is at the section cap. Defaults to `false`. */
  atCap?: boolean
}

/** One insert point in the section canvas: a hover "+" line between two sections, or the trailing "Add section" button. */
export function AddLine({ index, onRequestAdd, trailing, atCap = false }: AddLineProps) {
  if (trailing) {
    return (
      <div className="flex justify-center py-6">
        <Tooltip label={atCap ? SECTION_CAP_MESSAGE : 'Add section'}>
          <Button variant="outline" disabled={atCap} onClick={() => onRequestAdd(index)}>
            <Plus size={14} strokeWidth={1.5} />
            Add section
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    // Zero-height row so it never opens a visible gap between two sections;
    // the wider invisible hover target below is what actually reveals it.
    <div className="group relative z-10 h-0">
      <Tooltip label={atCap ? SECTION_CAP_MESSAGE : 'Add section here'}>
        <button
          type="button"
          onClick={(e) => onRequestAdd(index, e.currentTarget)}
          aria-label="Add section here"
          disabled={atCap}
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-pill border border-border bg-surface text-text-subtle opacity-0 shadow-sm transition hover:text-text group-hover:opacity-100 disabled:cursor-not-allowed disabled:hover:text-text-subtle"
        >
          <Plus size={12} strokeWidth={1.5} />
        </button>
      </Tooltip>
      <div aria-hidden className="absolute inset-x-0 -top-3 h-6" />
    </div>
  )
}
