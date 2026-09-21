'use client'

/**
 * One section in the template canvas (UX audit §3.1-3.5 rebuild of
 * Proposal Layout v2 Phase 2, spec 5.3): the sortable wrapper, the gutter
 * drag handle, click-anywhere-to-select, the hover/selection chrome (name
 * tag, edge `+` buttons, anchored toolbar), and the content/data editing
 * switch. A content section mounts a live `ContentSectionEditor` inside
 * the section's own background/padding frame (`sectionCss`, `mode: 'edit'`)
 * so the canvas reads as the real page; a data section is read-only here
 * (Phase 3 gives it its own editors) and only selectable.
 *
 * @module features/proposals/editor/editable-section
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EyeOff, GripVertical } from 'lucide-react'
import { useRef, useState, type MouseEvent, type RefObject } from 'react'

import type { CanvasDevice } from '@/components/editor'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { Section } from '../model/layout'
import type { ProposalTheme } from '../model/theme'
import { resolveProposalVariables } from '../model/variables'

import { BackgroundReposition } from './background-reposition'
import { SectionEdgeAdd } from './bars/section-edge-add'
import { SectionToolbar } from './bars/section-toolbar'
import { ContentSectionFrame } from './content-section-frame'
import { EditableDataSection } from './data/editable-data-section'
import { SectionResizeOverlay } from './resize/section-resize-overlay'
import type { LayoutAction } from './state'

/** A click landing on any of these never selects the section: its own control already owns the click. */
const CLICK_THROUGH_SELECTOR = '.ProseMirror, button, a, input, [role="toolbar"], [role="slider"]'

/** A stable "nowhere" bounds ref for a caller that has no real canvas scroll element to collide popovers against (e.g. a bare unit-test harness). */
const NULL_BOUNDS_REF: RefObject<HTMLElement | null> = { current: null }

/** Props for {@link EditableSection}. */
export interface EditableSectionProps {
  section: Section
  index: number
  /** Total section count, threaded to the toolbar's Move down bound. */
  total: number
  /** Step flow: true for the first section on a page, which carries no section gap above it (`canvas-pages.tsx`, mirroring `render/section.tsx`). Defaults to false. */
  pageStart?: boolean
  /** True when this section, or a node inside it, is the current selection. */
  selected: boolean
  /** True when the selection is a node inside this section rather than the section itself. */
  nodeSelected: boolean
  branding: PublicBranding
  /** The layout's canvas theme (`model/theme.ts`), threaded to the frame, the data section, the resize overlay and the toolbar. */
  theme: ProposalTheme
  /** Sample document data data sections render against while editing; never sent anywhere (see `lib/proposals/sample-proposal`). */
  doc: PublicDocData
  device: CanvasDevice
  /** `LayoutEditorState.externalVersion` (`./state.ts`), threaded through to a content section's `ContentSectionEditor` - see its module doc for what it gates. */
  externalVersion: number
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  /** Opens the add palette at `at`, anchored to whatever element the edge button passes through. */
  onRequestAdd: (at: number, anchor?: HTMLElement) => void
  /** True once the layout is at `LAYOUT_LIMITS.maxSections`: disables this section's own edge add buttons (Task 15). */
  atCap: boolean
  /** The canvas scroll element, for the toolbar's popovers to collide against. Defaults to no real bounds (a bare test harness). */
  boundsRef?: RefObject<HTMLElement | null>
  /** Brand swatches offered by the toolbar's colour pickers. Defaults to none. */
  swatches?: readonly string[]
}

/** One editable section: sortable, click-anywhere-selectable, with hover/selection chrome. */
export function EditableSection({
  section, index, total, selected, nodeSelected, branding, theme, doc, device, externalVersion, dispatch,
  onRequestAdd, atCap, boundsRef = NULL_BOUNDS_REF, swatches = [], pageStart = false,
}: EditableSectionProps) {
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
  // Background-image drag mode (`background-reposition.tsx`), entered from
  // the Style popover's Reposition button. Local to the section: nothing
  // else needs to know, and deselecting the section ends it (see below).
  const [repositioning, setRepositioning] = useState(false)
  const select = () => dispatch({ type: 'select', sectionId: section.id })
  const values = resolveProposalVariables(branding, doc)
  const hidden = Boolean(section.hideOnMobile) && device === 'mobile'
  // A node selected inside the section gets its own ring from the node view
  // (Task 7); the section outline goes to a single-width ring rather than
  // doubling up with it. Unselected, a thin brand-coloured ring fades in on
  // hover (UX audit §3.2: "nothing is visible until you click on text").
  const ringClass = selected
    ? nodeSelected ? 'ring-1 ring-brand-fg ring-inset' : 'ring-2 ring-brand-fg ring-inset'
    : 'ring-1 ring-transparent ring-inset hover:ring-brand-fg/40'

  // Click-anywhere-selects (UX audit §3.2, a blocker): a click landing
  // inside the ProseMirror editor, on a real control, or inside the
  // toolbar/a resize slider is left alone - its own handler (or TipTap's
  // own focus path) owns it. Everything else in the section - padding,
  // background, a data section's non-interactive content - selects it,
  // replacing the old invisible full-size "Select section" overlay.
  const onWrapperClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest(CLICK_THROUGH_SELECTOR)) return
    select()
  }

  return (
    <div
      ref={(el) => { setNodeRef(el); wrapperRef.current = el }}
      // Not `data-section-id`: a data-kind section nests `SectionView`,
      // which already stamps its own `<section data-section-id>` one
      // level down, and reusing the name here would put two elements
      // carrying the same id in the DOM.
      data-canvas-section-id={section.id}
      data-section-kind={section.kind}
      onClick={onWrapperClick}
      // Step flow: a `full` section's row grows to fill its page, and is
      // itself a column so the frame inside (which also grows) fills it -
      // the same rule `render/section.tsx` applies on the public page.
      className={`group relative ${theme.flow === 'step' && section.style.height === 'full' ? 'flex grow flex-col' : ''} ${hidden ? 'opacity-40' : ''} ${ringClass}`}
      // `marginTop` is the theme's section gap, the same rule `render/section.tsx`
      // applies on the public page (never before the first section, nor
      // before a page's first section).
      // `CSS.Translate`, not `CSS.Transform`: dnd-kit's transform for the
      // item being dragged also carries the scaleX/scaleY of the item it is
      // over divided by its own size, and `Transform.toString` applies it -
      // a tall text section dragged over a thin page-break row squashed to
      // a sliver, and the rows it passed stretched into tall ellipses
      // (2026-09-19, "deforms over other sections as you are moving it").
      // Sections are never the same size, so only the translation is wanted.
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 30 : undefined, marginTop: index > 0 && !pageStart ? theme.sectionGap : undefined }}
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
        <ContentSectionFrame section={section} index={index} branding={branding} theme={theme} externalVersion={externalVersion} dispatch={dispatch} />
      ) : (
        <EditableDataSection
          section={section}
          index={index}
          branding={branding}
          theme={theme}
          doc={doc}
          values={values}
          dispatch={dispatch}
          externalVersion={externalVersion}
          swatches={swatches}
        />
      )}
      <SectionResizeOverlay section={section} selected={selected} nodeSelected={nodeSelected} device={device} wrapperRef={wrapperRef} theme={theme} dispatch={dispatch} />
      <SectionEdgeAdd edge="top" visible={selected} atCap={atCap} onRequestAdd={(anchor) => onRequestAdd(index, anchor)} />
      <SectionEdgeAdd edge="bottom" visible={selected} atCap={atCap} onRequestAdd={(anchor) => onRequestAdd(index + 1, anchor)} />
      {selected && repositioning && section.style.background?.image ? (
        <BackgroundReposition section={section} wrapperRef={wrapperRef} dispatch={dispatch} onDone={() => setRepositioning(false)} />
      ) : selected ? (
        <div className="absolute right-3 top-3 z-20">
          <SectionToolbar
            section={section} index={index} total={total} theme={theme} dispatch={dispatch} boundsRef={boundsRef} swatches={swatches}
            brandCornerRadius={branding.corner_radius}
            onReposition={() => setRepositioning(true)}
          />
        </div>
      ) : null}
    </div>
  )
}
