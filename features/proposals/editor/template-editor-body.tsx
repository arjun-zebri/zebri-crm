'use client'

/**
 * The loaded template editor (Proposal Layout v2 Phase 2 Task 14): header,
 * canvas, and whichever control bar the current selection calls for.
 * Mounted by `template-editor.tsx` once the template and branding have
 * both loaded.
 *
 * The active bar's sticky-top placement uses `CanvasFrame`'s `overlay`
 * slot rather than a literal CSS `position: sticky` element inside the
 * scrolling canvas content: `overlay` already renders as a sibling of the
 * scroll viewport (see `components/editor/canvas-frame.tsx`), so it stays
 * put while the canvas scrolls and never rides along with the `zoom` CSS
 * property that scales the document - a real `position: sticky` node
 * living inside that zoomed subtree would visually scale the bar itself
 * with the canvas zoom, which is wrong for a 32px control row. The header
 * above `CanvasFrame` is a separate flex row, so the bar can never cover it.
 *
 * @module features/proposals/editor/template-editor-body
 */
import { useCallback, useRef, useState } from 'react'

import { CanvasFrame, type CanvasDevice } from '@/components/editor'
import type { PublicBranding } from '@/lib/branding/public-branding'

import { renameTemplateAction } from '../data/templates'
import type { ProposalLayout } from '../model/layout'

import { NodeBar } from './bars/node-bar'
import type { NodeBarSection } from './bars/node-bar-shared'
import { SectionBar } from './bars/section-bar'
import { TextBar, type TextBarHandle } from './bars/text-bar'
import { EditorHeader } from './editor-header'
import { useRegisteredEditor } from './editor-registry'
import { InsertMediaHost, type InsertMediaHandle } from './insert-media-host'
import { SectionCanvas } from './section-canvas'
import { useEditorShortcuts } from './use-editor-shortcuts'
import { useInsertMedia } from './use-insert-media'
import { useLayoutEditor } from './use-layout-editor'
import { useTemplateAutosave } from './use-template-autosave'

/** The account's own palette, deduplicated, offered by every colour picker in the editor. */
function swatchesFor(branding: PublicBranding): readonly string[] {
  const colors = [branding.brand_color, branding.accent_color, branding.heading_color, branding.text_color, branding.secondary_color]
  return Array.from(new Set(colors.filter((c): c is string => Boolean(c))))
}

/** Props for {@link TemplateEditorBody}. */
export interface TemplateEditorBodyProps {
  templateId: string
  name: string
  initial: ProposalLayout
  branding: PublicBranding
  /** Refetches the template row once a rename lands, so the header shows the server-confirmed name. */
  onRenamed: () => void
}

/** The loaded editor: header, canvas, and the active control bar. */
export function TemplateEditorBody({ templateId, name, initial, branding, onRenamed }: TemplateEditorBodyProps) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useLayoutEditor(initial)
  const { status, lastSavedAt, retry } = useTemplateAutosave(templateId, state.layout)
  const [device, setDevice] = useState<CanvasDevice>('desktop')
  const [zoom, setZoom] = useState(1)
  // The canvas's real scroll viewport (see `CanvasFrame`'s `scrollRef`
  // prop): the section bar's popovers collide against it, never the page
  // chrome above the header.
  const scrollRef = useRef<HTMLDivElement>(null)
  const swatches = swatchesFor(branding)
  // `textBarRef` also goes to the mounted `TextBar` below; see `use-editor-shortcuts.ts` for what this wires up.
  const textBarRef = useRef<TextBarHandle>(null)
  useEditorShortcuts({ state, dispatch, undo, redo, textBarRef })
  // `insertMediaRef` also goes to the mounted `InsertMediaHost` below; see `use-insert-media.ts`.
  const insertMediaRef = useRef<InsertMediaHandle>(null)
  useInsertMedia({ hostRef: insertMediaRef })

  const handleRename = useCallback(async (nextName: string) => {
    try {
      const result = await renameTemplateAction({ id: templateId, name: nextName })
      if (result.ok) onRenamed()
      return result.ok
    } catch {
      // A thrown rejection (network failure, ...) must still resolve to
      // `false`: `NameField.commit` awaits this inside a blur handler and
      // only reverts its optimistic display on a resolved `false`, never
      // on a rejection.
      return false
    }
  }, [templateId, onRenamed])

  const sectionEditor = useRegisteredEditor(state.selection.sectionId)
  const selectedIndex = state.selection.sectionId ? state.layout.sections.findIndex((s) => s.id === state.selection.sectionId) : -1
  const selectedSection = selectedIndex >= 0 ? state.layout.sections[selectedIndex] : null
  // Spread `name` only when set: under `exactOptionalPropertyTypes`, an explicit `name: undefined` does not satisfy `name?: string`.
  const sectionOptions: readonly NodeBarSection[] = state.layout.sections.map((s) => ({ id: s.id, kind: s.kind, ...(s.name !== undefined ? { name: s.name } : {}) }))

  const barContent = state.selection.node && sectionEditor ? (
    <NodeBar
      key={`${state.selection.node.nodeType}@${state.selection.node.pos}`}
      node={state.selection.node}
      editor={sectionEditor}
      sections={sectionOptions}
      swatches={swatches}
    />
  ) : selectedSection ? (
    // SectionBar carries no surface/border/shadow of its own (unlike
    // NodeBar and TextBar, which do) - it is meant to be hosted, and this
    // is that host, so the chrome is supplied here.
    <div className="rounded-control border border-border bg-surface px-1 shadow-lg">
      <SectionBar section={selectedSection} isFirst={selectedIndex === 0} dispatch={dispatch} boundsRef={scrollRef} swatches={swatches} />
    </div>
  ) : null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <EditorHeader
        name={name}
        onRename={handleRename}
        status={status}
        lastSavedAt={lastSavedAt}
        onRetry={retry}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        device={device}
        onDeviceChange={setDevice}
      />
      {/* `flex flex-col`, not a plain block box: `CanvasFrame`'s root is
          `relative flex-1 min-h-0 overflow-hidden` with no `h-full` of its
          own - it only gets a real height when its parent is a flex
          container with `align-items: stretch` (the Branding editor mounts
          it the same way, `branding-editor.tsx`'s `flex flex-1 min-h-0`).
          A block-box wrapper here let the frame fall back to content
          height instead, so the canvas never scrolled and the zoom widget
          landed off-screen below the fold (verified in headless Chromium
          with a replica of this exact class stack). */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <CanvasFrame
          device={device}
          zoom={zoom}
          setZoom={setZoom}
          page
          wide
          scrollRef={scrollRef}
          overlay={barContent ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
              <div className="pointer-events-auto w-full max-w-[720px]">{barContent}</div>
            </div>
          ) : null}
        >
          <SectionCanvas
            state={state}
            dispatch={dispatch}
            branding={branding}
            device={device}
            // No role field is stored on a template's layout (only the
            // starter it was built from picks one, once, at creation
            // time); 'mc' just flavours the add palette's Presets tab, so
            // a fixed fallback here is harmless.
            role="mc"
          />
        </CanvasFrame>
        {/* TipTap's own bubble menu: positions itself over the real text
            selection inside the registered editor, independent of where
            it sits in the tree. */}
        {sectionEditor ? <TextBar editor={sectionEditor} swatches={swatches} ref={textBarRef} /> : null}
        {/* No chrome of its own until Image/Audio/Embed requests it; unlike `TextBar`, mounts unconditionally. */}
        <InsertMediaHost ref={insertMediaRef} />
      </div>
    </div>
  )
}
