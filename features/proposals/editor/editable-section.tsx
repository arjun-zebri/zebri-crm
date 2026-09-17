'use client'

/**
 * One section in the template canvas (Proposal Layout v2 Phase 2, spec
 * 5.3): the sortable wrapper, the gutter drag handle, the selection
 * outline, the `hideOnMobile` badge, and the content/data editing switch.
 * A content section mounts a live `ContentSectionEditor` inside the
 * section's own background/padding frame (`sectionCss`, `mode: 'edit'`) so
 * the canvas reads as the real page; a data section is read-only here
 * (Phase 3 gives it its own editors) and only selectable, through a
 * transparent overlay over `SectionView`.
 *
 * @module features/proposals/editor/editable-section
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EyeOff, GripVertical } from 'lucide-react'
import { useRef } from 'react'

import type { CanvasDevice } from '@/components/editor'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { Section } from '../model/layout'
import { resolveProposalVariables } from '../model/variables'
import { SectionView } from '../render/section'

import { AddLine } from './add-line'
import { ContentSectionFrame } from './content-section-frame'
import { SectionResizeOverlay } from './resize/section-resize-overlay'
import type { LayoutAction } from './state'

/** Props for {@link EditableSection}. */
export interface EditableSectionProps {
  section: Section
  index: number
  /** True when this section, or a node inside it, is the current selection. */
  selected: boolean
  /** True when the selection is a node inside this section rather than the section itself. */
  nodeSelected: boolean
  branding: PublicBranding
  /** Sample document data data sections render against while editing; never sent anywhere (see `lib/proposals/sample-proposal`). */
  doc: PublicDocData
  device: CanvasDevice
  /** `LayoutEditorState.externalVersion` (`./state.ts`), threaded through to a content section's `ContentSectionEditor` - see its module doc for what it gates. */
  externalVersion: number
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  /** Opens the add palette below this section, anchored to whatever element the add line passes through. */
  onRequestAdd: (at: number, anchor?: HTMLElement) => void
  /** True once the layout is at `LAYOUT_LIMITS.maxSections`: disables this section's own trailing add line (Task 15). */
  atCap: boolean
}

/** One editable section, plus its own trailing "add section here" line. */
export function EditableSection({ section, index, selected, nodeSelected, branding, doc, device, externalVersion, dispatch, onRequestAdd, atCap }: EditableSectionProps) {
  // `animateLayoutChanges: () => false` matches `block-frame.tsx`: without
  // it, dnd-kit's default FLIP animation also fires on non-drag reorders
  // (Alt+Arrow, delete, duplicate, add), not just on an actual drag.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    animateLayoutChanges: () => false,
  })
  // `SectionResizeOverlay` measures off this section's own DOM box (its
  // height, and its content column's rect), so it needs the real element,
  // not just dnd-kit's own `setNodeRef` callback.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const select = () => dispatch({ type: 'select', sectionId: section.id })
  const values = resolveProposalVariables(branding, doc)
  const hidden = Boolean(section.hideOnMobile) && device === 'mobile'
  // A node selected inside the section gets its own ring from the node view
  // (Task 7); the section outline goes to a single-width ring rather than
  // doubling up with it.
  const ringClass = selected ? (nodeSelected ? 'ring-1 ring-brand-fg ring-inset' : 'ring-2 ring-brand-fg ring-inset') : ''

  return (
    <>
      <div
        ref={(el) => { setNodeRef(el); wrapperRef.current = el }}
        // Not `data-section-id`: a data-kind section nests `SectionView`,
        // which already stamps its own `<section data-section-id>` one
        // level down, and reusing the name here would put two elements
        // carrying the same id in the DOM.
        data-canvas-section-id={section.id}
        data-section-kind={section.kind}
        className={`group relative ${hidden ? 'opacity-40' : ''} ${ringClass}`}
        style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 30 : undefined }}
      >
        {hidden ? (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-body text-text-muted shadow-sm">
            <EyeOff size={14} strokeWidth={1.5} />
            Hidden on phones
          </div>
        ) : null}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => {
            e.stopPropagation()
            select()
          }}
          aria-label="Move section"
          className={`absolute left-1 top-1/2 z-10 -translate-y-1/2 inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-control text-text-subtle transition hover:text-text active:cursor-grabbing ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </button>
        {section.kind === 'content' ? (
          <ContentSectionFrame section={section} index={index} branding={branding} externalVersion={externalVersion} dispatch={dispatch} />
        ) : (
          <div className="relative">
            <SectionView section={section} index={index} branding={branding} doc={doc} mode="edit" values={values} />
            {/* Captures the click instead of the live packages/accept
                controls underneath: while editing, clicking a data section
                should select it, not fire its public-page buttons. */}
            <button type="button" onClick={select} aria-label="Select section" className="absolute inset-0 bg-transparent" />
          </div>
        )}
        <SectionResizeOverlay section={section} selected={selected} nodeSelected={nodeSelected} device={device} wrapperRef={wrapperRef} dispatch={dispatch} />
      </div>
      <AddLine index={index + 1} onRequestAdd={onRequestAdd} atCap={atCap} />
    </>
  )
}
