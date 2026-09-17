'use client'

/**
 * The section-level control bar (Proposal Layout v2 Phase 2, spec §4):
 * mounted in a sticky strip above the canvas whenever a section is the
 * current selection (Task 12 wires the mount point; this task only builds
 * the bar itself, and its own tests render it directly). Every style
 * control writes through `dispatch({ type: 'updateStyle', id, patch })`;
 * the `...` menu covers the section-level actions that are not a style
 * field (hide on phone, duplicate, reset, delete), reusing
 * `useDeleteSection` so this bar's Delete agrees with the canvas
 * keyboard's.
 *
 * @module features/proposals/editor/bars/section-bar
 */
import * as Popover from '@radix-ui/react-popover'
import { MoreHorizontal } from 'lucide-react'
import { useState, type RefObject } from 'react'

import { MenuItem, MenuPanel, MenuSeparator } from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'

import type { Section, SectionStyle } from '../../model/layout'
import type { SectionCanvasProps } from '../section-canvas'
import { newSectionFor } from '../state'
import { useDeleteSection } from '../use-canvas-keys'

import { BarShell } from './bar-shell'
import { SectionBackgroundControl } from './section-background'
import { SectionNameField } from './section-name-field'
import { SectionPaddingControl } from './section-padding'
import { SectionStylePills } from './section-style-pills'
import { SectionTextColorControl } from './section-text-color'

/** Props for {@link SectionBar}. */
export interface SectionBarProps {
  section: Section
  /**
   * Whether this is the layout's first section. No control in this bar
   * branches on it; stamped on the root as `data-first-section` for
   * Task 12 (the sticky-strip host), the one place that knows whether
   * there is a section above to weigh sticky positioning against.
   */
  isFirst: boolean
  dispatch: SectionCanvasProps['dispatch']
  /** The canvas scroll element; every popover opened from this bar collides against it, never the page chrome. */
  boundsRef: RefObject<HTMLElement | null>
  /** Brand swatches offered by the colour pickers. Defaults to none. */
  swatches?: readonly string[]
}

/** The section-level control bar. See the module doc for what mounts it. */
export function SectionBar({ section, isFirst, dispatch, boundsRef, swatches = [] }: SectionBarProps) {
  const { style } = section
  const baseline = newSectionFor(section.kind).style
  const { requestDelete, dialog } = useDeleteSection(dispatch)

  const update = (patch: Partial<SectionStyle>, opts?: { commit?: boolean }) =>
    dispatch({ type: 'updateStyle', id: section.id, patch }, opts)

  return (
    <div role="toolbar" aria-label="Section" data-first-section={isFirst || undefined} className="w-full">
      <BarShell overflow={<OverflowMenu section={section} dispatch={dispatch} requestDelete={requestDelete} boundsRef={boundsRef} />}>
        <SectionNameField section={section} dispatch={dispatch} />

        <SectionBackgroundControl
          background={style.background}
          onChange={(background, opts) => update({ background }, opts)}
          overridden={JSON.stringify(style.background ?? null) !== JSON.stringify(baseline.background ?? null)}
          swatches={swatches}
          boundsRef={boundsRef}
        />

        <SectionStylePills style={style} baseline={baseline} onChange={(patch) => update(patch, { commit: true })} />

        <SectionPaddingControl
          padding={style.padding}
          baseline={baseline.padding}
          onChange={(padding, opts) => update({ padding }, opts)}
          boundsRef={boundsRef}
        />

        <SectionTextColorControl
          color={style.textColor}
          baseline={baseline.textColor}
          onChange={(color) => update({ textColor: color }, { commit: true })}
          swatches={swatches}
        />
      </BarShell>
      {dialog}
    </div>
  )
}

/** The trailing `...` menu: Hide on phone, Duplicate, Reset style, Delete. */
function OverflowMenu({
  section, dispatch, requestDelete, boundsRef,
}: {
  section: Section
  dispatch: SectionCanvasProps['dispatch']
  requestDelete: (section: Section) => void
  boundsRef: RefObject<HTMLElement | null>
}) {
  const [open, setOpen] = useState(false)
  // Captured on open, not read during render: see `section-padding.tsx`'s
  // matching comment for why (`react-hooks/refs`).
  const [bounds, setBounds] = useState<HTMLElement | null>(null)
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setBounds(boundsRef.current)
      }}
    >
      <Tooltip label="More">
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="More section actions"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-text-muted hover:bg-surface-emphasis hover:text-text"
          >
            <MoreHorizontal size={14} strokeWidth={1.5} />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionBoundary={bounds} className="z-[60] animate-modal-in">
          <MenuPanel width="sm">
            <MenuItem
              checked={Boolean(section.hideOnMobile)}
              onClick={() => dispatch({ type: 'toggleHideOnMobile', id: section.id }, { commit: true })}
            >
              Hide on phone
            </MenuItem>
            <MenuItem
              onClick={() => {
                setOpen(false)
                dispatch({ type: 'duplicateSection', id: section.id }, { commit: true })
              }}
            >
              Duplicate
            </MenuItem>
            <MenuItem
              onClick={() => {
                setOpen(false)
                dispatch({ type: 'resetStyle', id: section.id }, { commit: true })
              }}
            >
              Reset style
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              destructive
              onClick={() => {
                setOpen(false)
                requestDelete(section)
              }}
            >
              Delete
            </MenuItem>
          </MenuPanel>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
