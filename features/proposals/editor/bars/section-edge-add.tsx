'use client'

/**
 * A section's top/bottom edge "+" button (UX audit §3.2/3.3, a blocker):
 * replaces the old invisible-until-hovered line between two sections with
 * a button anchored directly to the section boundary the way Qwilr's own
 * block edges work, shown on hover or while the section is selected.
 * `editable-section.tsx` renders one on each edge; the top edge of the
 * first section is what now covers "insert before everything" - there is
 * no separate leading insert line any more (see `section-canvas.tsx`).
 *
 * @module features/proposals/editor/bars/section-edge-add
 */
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

import { SECTION_CAP_MESSAGE } from '../add-line'

/** Props for {@link SectionEdgeAdd}. */
export interface SectionEdgeAddProps {
  /** Which edge of the section this button sits on. */
  edge: 'top' | 'bottom'
  /** Opens the add palette anchored to this button, at this edge's insert index. */
  onRequestAdd: (anchor: HTMLElement) => void
  /** Always shown (selected), rather than only on hover. */
  visible: boolean
  atCap: boolean
}

/** One "+" button on a section's top or bottom edge. */
export function SectionEdgeAdd({ edge, onRequestAdd, visible, atCap }: SectionEdgeAddProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center ${edge === 'top' ? '-top-4' : '-bottom-4'}`}
    >
      <Tooltip side="top" label={atCap ? SECTION_CAP_MESSAGE : 'Add section'}>
        <Button
          type="button"
          variant="outline"
          iconOnly
          shape="pill"
          disabled={atCap}
          onClick={(e) => onRequestAdd(e.currentTarget)}
          aria-label="Add section"
          className={`pointer-events-auto bg-surface shadow-sm transition ${visible ? '!opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <Plus size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
    </div>
  )
}
