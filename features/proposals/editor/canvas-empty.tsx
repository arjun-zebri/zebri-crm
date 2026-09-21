'use client'

/**
 * What the page sheet shows when the layout has no sections yet: a short
 * nudge towards the two ways to fill it (a section, or a preset) and the
 * same "Add section" entry point the trailing `AddLine` renders. A blank
 * sheet holding one lonely outline button read as broken rather than
 * empty, so `SectionCanvas` swaps in this instead of the trailing line
 * while `sections.length === 0`; the moment a section lands the normal
 * per-section edge `+` controls and trailing line take over.
 *
 * @module features/proposals/editor/canvas-empty
 */
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'

/** Props for {@link CanvasEmpty}. */
export interface CanvasEmptyProps {
  /** Opens the add palette at index 0; the same callback the trailing `AddLine` gets. */
  onRequestAdd: (at: number) => void
}

/** The blank-page nudge: one line of copy and the "Add section" button that opens the palette. */
export function CanvasEmpty({ onRequestAdd }: CanvasEmptyProps) {
  return (
    <div data-canvas-empty className="px-6 py-10">
      <Empty
        // No icon on purpose: every glyph tried read as clip-art on the
        // otherwise blank sheet; the copy and the button carry it.
        title="A blank page, all yours"
        description="Add a section to start building, or pick a preset for a head start."
        action={
          <Button variant="outline" onClick={() => onRequestAdd(0)}>
            <Plus size={14} strokeWidth={1.5} />
            Add section
          </Button>
        }
      />
    </div>
  )
}
