'use client'

/**
 * The template canvas: the page sheet (`page-sheet.tsx`, UX audit §3.1)
 * holding one sortable, selectable, editable row per layout section, plus
 * the canvas-level keyboard shortcuts (Proposal Layout v2 Phase 2, spec
 * 5.3). `useLayoutEditor` (Task 3) is the single source of truth; this
 * component only reads `state` and dispatches actions into it.
 *
 * Every insert point but the trailing "Add section" button (still an
 * `AddLine` at the very end) is a `+` button anchored to a section's own
 * top/bottom edge (`bars/section-edge-add.tsx`, UX audit §3.2/3.3) rather
 * than a hover line between sections, so there is no separate leading
 * `AddLine` here: the first section's own top edge covers "insert before
 * everything".
 *
 * Rows are laid out by `CanvasPages`: flat in stack flow, grouped into
 * screen-tall pages around each `pageBreak` row in step flow.
 *
 * Also mounts the add palette (Task 8): `useAddPalette` owns which index
 * is pending and whether the palette is anchored to a hover "+" edge or
 * opened from the trailing button, and turns a chosen section straight
 * into an `addSection` dispatch, so an edge button's `onRequestAdd` never
 * leaves this component.
 *
 * @module features/proposals/editor/section-canvas
 */
import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { RefObject } from 'react'

import type { CanvasDevice } from '@/components/editor'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'
import type { ProposalRole } from '@/lib/proposals/types'

import { LAYOUT_LIMITS } from '../model/rich-doc-spec'
import { resolveTheme } from '../model/theme'

import { AddLine } from './add-line'
import { AddPalette } from './add-palette'
import { CanvasEmpty } from './canvas-empty'
import { CanvasPages } from './canvas-pages'
import { EditablePageBreak } from './editable-page-break'
import { EditableSection } from './editable-section'
import { PageSheet } from './page-sheet'
import type { LayoutAction, LayoutEditorState } from './state'
import { useAddPalette } from './use-add-palette'
import { useCanvasKeys, useDeleteSection } from './use-canvas-keys'

/** Props for {@link SectionCanvas}. */
export interface SectionCanvasProps {
  state: LayoutEditorState
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  branding: PublicBranding
  device: CanvasDevice
  /** Flavours the add palette's about/how-it-works section starters. */
  role: ProposalRole
  /** The canvas scroll element (`CanvasFrame`'s own `scrollRef`), so a selected section's toolbar popovers collide against it, never the page chrome. Defaults to no real bounds. */
  boundsRef?: RefObject<HTMLElement | null>
  /** Brand swatches offered by a selected section's toolbar colour pickers. Defaults to none. */
  swatches?: readonly string[]
}

/**
 * The sortable, selectable section canvas: renders `state.layout.sections`
 * in order and wires reordering (drag or `Alt+Arrow`), selection, section
 * deletion, and inserting a new section from the add palette.
 */
export function SectionCanvas({ state, dispatch, branding, device, role, boundsRef, swatches }: SectionCanvasProps) {
  const sections = state.layout.sections
  const theme = resolveTheme(state.layout, branding)
  // Task 15: every add control (the leading/trailing hover lines and each
  // section's own trailing one) disables once the reducer's own
  // `addSection` cap would refuse the insert anyway - computed once here
  // rather than read from `LAYOUT_LIMITS` at each of the three call sites.
  const atCap = sections.length >= LAYOUT_LIMITS.maxSections
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { requestDelete, dialog } = useDeleteSection(dispatch)
  // No `undo`/`redo` here: `useCanvasKeys` doesn't bind Cmd+Z itself
  // (`useHistory` inside `useLayoutEditor` already does, outside an
  // editor's focus; Task 15 wires the editor-focus case separately).
  useCanvasKeys({ state, dispatch, requestDelete })
  const palette = useAddPalette(dispatch)

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = sections.findIndex((s) => s.id === active.id)
    const to = sections.findIndex((s) => s.id === over.id)
    if (from === -1 || to === -1) return
    dispatch({ type: 'moveSection', from, to }, { commit: true })
  }

  return (
    // `data-canvas` is the mobile canvas's single source of truth (Task
    // 13, spec 3.6): `EDITOR_PROSE_CLASS`'s stacking rules and the
    // content column's width override both key off this attribute on an
    // ancestor rather than a real viewport resize, since `CanvasFrame`
    // narrows the canvas with a fixed-width wrapper, not the browser
    // window. `w-[380px]` on mobile mirrors `CanvasFrame`'s own 380px
    // wrapper; it is redundant there today (the frame already constrains
    // the width) but keeps this root's own width assertable and correct
    // if `SectionCanvas` is ever rendered outside that frame.
    <div data-canvas={device} className={`mx-auto ${device === 'mobile' ? 'w-[380px]' : 'w-full'}`}>
      <PageSheet branding={branding} theme={theme} device={device}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <CanvasPages
              sections={sections}
              theme={theme}
              renderSection={(section, index, pageStart) => section.kind === 'pageBreak' ? (
                <EditablePageBreak key={section.id} section={section} selected={state.selection.sectionId === section.id} theme={theme} dispatch={dispatch} />
              ) : (
                <EditableSection
                  key={section.id}
                  section={section}
                  index={index}
                  total={sections.length}
                  pageStart={pageStart}
                  selected={state.selection.sectionId === section.id}
                  nodeSelected={state.selection.node?.sectionId === section.id}
                  branding={branding}
                  theme={theme}
                  doc={SAMPLE_PROPOSAL_DOC}
                  device={device}
                  externalVersion={state.externalVersion}
                  dispatch={dispatch}
                  onRequestAdd={palette.requestAdd}
                  atCap={atCap}
                  {...(boundsRef ? { boundsRef } : {})}
                  {...(swatches ? { swatches } : {})}
                />
              )}
            />
          </SortableContext>
        </DndContext>
        {sections.length === 0 ? (
          // A lone outline button on an otherwise blank sheet read as
          // broken; the empty state says what the page is waiting for.
          <CanvasEmpty onRequestAdd={palette.requestAdd} />
        ) : (
          <AddLine index={sections.length} onRequestAdd={palette.requestAdd} trailing atCap={atCap} />
        )}
      </PageSheet>
      {dialog}
      <AddPalette
        open={palette.open}
        at={palette.at}
        anchor={palette.anchor}
        onOpenChange={palette.onOpenChange}
        onAdd={palette.onAdd}
        role={role}
        branding={branding}
        atCap={atCap}
      />
    </div>
  )
}
