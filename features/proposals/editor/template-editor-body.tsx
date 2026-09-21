'use client'

/**
 * The loaded template editor (Proposal Layout v2 Phase 2 Task 14): header,
 * canvas, and the node bar when a node inside a section is selected.
 * Mounted by `template-editor.tsx` once the template and branding have
 * both loaded.
 *
 * A selected *section*'s own toolbar is not hosted here (UX audit
 * §3.2/3.5): it is anchored directly to the section on the canvas
 * (`editable-section.tsx`'s `SectionToolbar`), not a detached strip at the
 * top of the canvas - that was the "section bar 400px away from the click"
 * gap the audit flagged. `NodeBar` (an atom/container node selected inside
 * a section's rich-text content) gets the same treatment via
 * `bars/node-bar-anchor.tsx`'s `NodeBarAnchor`, which places it directly
 * above (or, flipped, below) the selected node's own rendered position -
 * UX audit §3.6/§7.3 replaced this file's former fixed top-of-canvas strip
 * with that anchored placement.
 *
 * `NodeBarAnchor` is still mounted through `CanvasFrame`'s `overlay` slot
 * rather than a node living inside the scrolling canvas content: `overlay`
 * renders as a sibling of the scroll viewport (see
 * `components/editor/canvas-frame.tsx`), so it stays put while the canvas
 * scrolls and never rides along with the `zoom` CSS property that scales
 * the document - `NodeBarAnchor` measures screen coordinates directly and
 * would double-scale itself if it were inside that zoomed subtree. The
 * header above `CanvasFrame` is a separate flex row, so the bar can never
 * cover it.
 *
 * @module features/proposals/editor/template-editor-body
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { CanvasDevice } from '@/components/editor'
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-branding'

import { renameTemplateAction } from '../data/templates'
import type { ProposalLayout } from '../model/layout'
import { withTheme } from '../model/theme'

import type { TextBarHandle } from './bars/text-bar'
import { useNodeBarContent } from './bars/use-node-bar-content'
import { FieldShortcutsProvider } from './data/field-shortcuts'
import { EditorCanvasRegion } from './editor-canvas-region'
import { EditorHeader } from './editor-header'
import type { InsertMediaHandle } from './insert-media-host'
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
  /** Scopes the local draft (`use-template-autosave.ts`); `null` disables it. */
  userId: string | null
  name: string
  initial: ProposalLayout
  /** True when `initial` is a restored local draft the server does not hold yet. */
  initialDirty: boolean
  /** The template's `revision` as loaded: every autosave carries it back. */
  revision: number
  branding: PublicBranding
  /** Refetches the template row once a rename lands, so the header shows the server-confirmed name. */
  onRenamed: () => void
}

/** The loaded editor: header, canvas, and the active control bar. */
export function TemplateEditorBody({ templateId, userId, name, initial, initialDirty, revision, branding, onRenamed }: TemplateEditorBodyProps) {
  // A template saved before canvas themes existed gets one seeded from
  // Branding here, once, so the Page style panel always has a full theme
  // to edit and the first autosave writes it back.
  const themed = useMemo(() => withTheme(initial, branding), [initial, branding])
  const { state, dispatch, undo, redo } = useLayoutEditor(themed)
  const { status, lastSavedAt, retry } = useTemplateAutosave(templateId, state.layout, { revision, userId, initialDirty })
  const [device, setDevice] = useState<CanvasDevice>('desktop')
  const [zoom, setZoom] = useState(1)
  // Every branding face, not just the account's two: the text bar's Font
  // list previews each option in its own typeface, and a per-run font
  // override can be any of them.
  useEffect(() => {
    ensureBrandFontsStylesheet()
  }, [])
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

  const { sectionEditor, barContent } = useNodeBarContent({ state, scrollRef, zoom, swatches })
  // One stable object per undo/redo pair, so every `InlineField`'s effect re-runs only when they change (`data/field-shortcuts.tsx`).
  const fieldShortcuts = useMemo(() => ({ undo, redo }), [undo, redo])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <EditorHeader
        name={name}
        onRename={handleRename}
        status={status}
        lastSavedAt={lastSavedAt}
        onRetry={retry}
        device={device}
        onDeviceChange={setDevice}
        layout={state.layout}
        branding={branding}
      />
      <FieldShortcutsProvider value={fieldShortcuts}>
        <EditorCanvasRegion
          state={state}
          dispatch={dispatch}
          branding={branding}
          device={device}
          zoom={zoom}
          setZoom={setZoom}
          scrollRef={scrollRef}
          barContent={barContent}
          sectionEditor={sectionEditor}
          swatches={swatches}
          textBarRef={textBarRef}
          insertMediaRef={insertMediaRef}
        />
      </FieldShortcutsProvider>
    </div>
  )
}
