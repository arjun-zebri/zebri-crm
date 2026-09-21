'use client'

/**
 * The canvas column under `EditorHeader`: the zoomable `CanvasFrame`
 * holding `SectionCanvas`, plus the text bar and insert-media host that
 * float over it. Split out of `template-editor-body.tsx` so that file
 * stays the orchestrator: state, shortcuts, autosave, rename, with the
 * actual region markup delegated here.
 *
 * There is deliberately no library panel beside the canvas any more: the
 * one the UX audit (§3.3) added duplicated the add palette block for
 * block, and its only unique content, the image library, now lives in
 * the Image insert flow (`image-insert-modal.tsx`). Every insert goes
 * through a section edge `+` or the trailing "Add section" button, so
 * the user always chooses where a section lands.
 *
 * @module features/proposals/editor/editor-canvas-region
 */
import type { Editor } from '@tiptap/react'
import type { ReactNode, RefObject } from 'react'

import { CanvasFrame, type CanvasDevice } from '@/components/editor'
import type { PublicBranding } from '@/lib/branding/public-branding'

import { resolveTheme } from '../model/theme'

import type { TextBarHandle } from './bars/text-bar'
import { TextBar } from './bars/text-bar'
import { GlobalStylePopover } from './global-style/global-style-popover'
import type { InsertMediaHandle } from './insert-media-host'
import { InsertMediaHost } from './insert-media-host'
import { SectionCanvas } from './section-canvas'
import type { LayoutAction, LayoutEditorState } from './state'

/** Props for {@link EditorCanvasRegion}. */
export interface EditorCanvasRegionProps {
  state: LayoutEditorState
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  branding: PublicBranding
  device: CanvasDevice
  zoom: number
  setZoom: (v: number) => void
  scrollRef: RefObject<HTMLDivElement | null>
  /**
   * The node bar (only a node selection uses it), already wrapped in
   * `NodeBarAnchor` - which positions itself absolutely, so this renders
   * straight into `CanvasFrame`'s `overlay` slot with no extra
   * positioning wrapper here. `null` when nothing selected.
   */
  barContent: ReactNode
  /** The registered TipTap editor for the selected section, or `null` when none is selected - gates whether `TextBar` mounts. */
  sectionEditor: Editor | null
  swatches: readonly string[]
  textBarRef: RefObject<TextBarHandle | null>
  insertMediaRef: RefObject<InsertMediaHandle | null>
}

/** The zoomable canvas column, filling the header's remaining height. */
export function EditorCanvasRegion({
  state, dispatch, branding, device, zoom, setZoom, scrollRef,
  barContent, sectionEditor, swatches, textBarRef, insertMediaRef,
}: EditorCanvasRegionProps) {
  // Shared with `TextBar` (so its own controls seed from and track this
  // same theme) and `GlobalStylePopover` (the thing that edits it).
  const theme = resolveTheme(state.layout, branding)

  return (
    <div className="relative flex min-h-0 flex-1">
      {/* `flex flex-col`, not a plain block box: `CanvasFrame`'s root is
          `relative flex-1 min-h-0 overflow-hidden` with no `h-full` of its
          own - it only gets a real height when its parent is a flex
          container with `align-items: stretch` (the Branding editor mounts
          it the same way, `branding-editor.tsx`'s `flex flex-1 min-h-0`).
          A block-box wrapper here let the frame fall back to content
          height instead, so the canvas never scrolled and the zoom widget
          landed off-screen below the fold (verified in headless Chromium
          with a replica of this exact class stack). `min-w-0` keeps this
          column shrinkable so a wide canvas scrolls inside it rather than
          pushing the row wider. */}
      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        // Click the grey workbench around the page to deselect, the way
        // every canvas editor behaves; a click that landed on the sheet,
        // a section, a bar, a popover or a resize grip (`role="slider"`:
        // the table grips ride in the overlay slot, outside the sheet) is
        // someone else's (audit pass 2).
        onClick={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('[data-page-sheet], [data-canvas-section-id], [role="toolbar"], [role="dialog"], [role="slider"], button, input')) return
          if (state.selection.sectionId) dispatch({ type: 'select', sectionId: null })
        }}
      >
        <CanvasFrame
          device={device}
          zoom={zoom}
          setZoom={setZoom}
          page
          wide
          scrollRef={scrollRef}
          overlay={barContent}
        >
          <SectionCanvas
            state={state}
            dispatch={dispatch}
            branding={branding}
            device={device}
            // No role field is stored on a template's layout (only the
            // starter it was built from picks one, once, at creation
            // time); 'mc' just flavours preset/section copy, so a fixed
            // fallback here is harmless.
            role="mc"
            boundsRef={scrollRef}
            swatches={swatches}
          />
        </CanvasFrame>
        {/* TipTap's own bubble menu: positions itself over the real text
            selection inside the registered editor, independent of where
            it sits in the tree. */}
        {sectionEditor ? <TextBar editor={sectionEditor} swatches={swatches} theme={theme} ref={textBarRef} /> : null}
        {/* No chrome of its own until Image/Audio/Embed requests it; unlike `TextBar`, mounts unconditionally. */}
        <InsertMediaHost ref={insertMediaRef} />
        {/* Global style (the whole-page theme) sits at the workbench's
            top-left, over the canvas rather than in the header: it styles
            what is on the canvas, so it lives with the canvas, the way the
            section toolbar lives on its section. `absolute` inside this
            column, so it stays put while the canvas scrolls. */}
        <div className="absolute left-3 top-3 z-20">
          <GlobalStylePopover
            theme={theme}
            branding={branding}
            dispatch={dispatch}
            boundsRef={scrollRef}
            swatches={swatches}
          />
        </div>
      </div>
    </div>
  )
}
