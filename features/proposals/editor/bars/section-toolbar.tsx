'use client'

/**
 * The section's own anchored toolbar (UX audit §3.2/3.5, a major): Style,
 * move up/down, duplicate and delete, shown pinned to the section's own
 * top-right corner while it is selected - replacing the old `SectionBar`,
 * which lived in a detached strip at the top of the canvas
 * (`template-editor-body.tsx`'s old overlay slot; the section bar no
 * longer mounts there, see that file). The heavier style controls move
 * behind the Style button's popover (`section-style-popover.tsx`), which
 * already carries this bar's trailing `...` menu had (Hide on phone,
 * Reset style) - so that menu was pure duplication and was removed
 * rather than kept as a second way to reach the same two controls.
 * A data section's own settings (packages layout/inclusions, gallery
 * layout) live in the Style popover, not a second button here - see that
 * module's doc.
 *
 * @module features/proposals/editor/bars/section-toolbar
 */
import { ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react'
import { useRef, type RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

import type { Section } from '../../model/layout'
import type { ProposalTheme } from '../../model/theme'
import type { SectionCanvasProps } from '../section-canvas'
import { useDeleteSection } from '../use-canvas-keys'

import { SectionStylePopover } from './section-style-popover'

/** Props for {@link SectionToolbar}. */
export interface SectionToolbarProps {
  section: Section
  /** This section's position in the layout, for Move up/down's bounds and target index. */
  index: number
  /** Total section count, so Move down disables at the last position. */
  total: number
  /** The layout's canvas theme, for the Style popover's inherited padding/alignment baselines. */
  theme: ProposalTheme
  dispatch: SectionCanvasProps['dispatch']
  /** The canvas scroll element; every popover opened from this bar collides against it, never the page chrome. */
  boundsRef: RefObject<HTMLElement | null>
  /** Brand swatches offered by the Style popover's colour pickers. Defaults to none. */
  swatches?: readonly string[]
  /** `branding.corner_radius`: what a video section's Corner rounding control shows until the section sets its own. Defaults to 0 in a bare harness. */
  brandCornerRadius?: number
  /** Threaded to the Style popover's Background control: starts the on-canvas image drag. */
  onReposition?: (() => void) | undefined
}

/** The section's anchored toolbar. See the module doc for what it holds and why. */
export function SectionToolbar({ section, index, total, theme, dispatch, boundsRef, swatches = [], brandCornerRadius = 0, onReposition }: SectionToolbarProps) {
  const { requestDelete, dialog } = useDeleteSection(dispatch)
  // The Style popover anchors here, not to its own (leftmost) trigger
  // button, so its right edge always lines up with the toolbar's - the
  // toolbar sits flush against the section's own right edge, but the
  // popover is wider than the toolbar itself, so anchoring off the first
  // button alone left it lining up on the right only by coincidence,
  // wildly misaligned on a narrow section (2026-09-19 live-found bug).
  const toolbarRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={toolbarRef} role="toolbar" aria-label="Section" className="flex h-10 items-center gap-0.5 rounded-control border border-border bg-surface px-1 shadow-lg">
      <SectionStylePopover
        section={section} theme={theme} dispatch={dispatch} boundsRef={boundsRef} swatches={swatches} brandCornerRadius={brandCornerRadius} onReposition={onReposition}
        toolbarRef={toolbarRef}
      />

      <Tooltip side="top" label="Move up">
        <Button
          variant="ghost"
          iconOnly
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => dispatch({ type: 'moveSection', from: index, to: index - 1 }, { commit: true })}
        >
          <ChevronUp size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Tooltip side="top" label="Move down">
        <Button
          variant="ghost"
          iconOnly
          aria-label="Move down"
          disabled={index >= total - 1}
          onClick={() => dispatch({ type: 'moveSection', from: index, to: index + 1 }, { commit: true })}
        >
          <ChevronDown size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Tooltip side="top" label="Duplicate">
        <Button
          variant="ghost"
          iconOnly
          aria-label="Duplicate"
          onClick={() => dispatch({ type: 'duplicateSection', id: section.id }, { commit: true })}
        >
          <Copy size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Tooltip side="top" label="Delete">
        <Button variant="ghost" iconOnly aria-label="Delete" onClick={() => requestDelete(section)}>
          <Trash2 size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>

      {dialog}
    </div>
  )
}
