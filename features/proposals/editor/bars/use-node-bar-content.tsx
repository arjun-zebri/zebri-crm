'use client'

/**
 * Builds the node bar's content for `template-editor-body.tsx`'s `overlay`
 * slot: the registered TipTap editor for the selected section (also gates
 * whether `TextBar` mounts), the section-name options the button bar's
 * "Jump to section" control offers, and `NodeBar` itself pre-wrapped in
 * `NodeBarAnchor` so it only ever renders already anchored to the node's
 * on-canvas position. Split out of `template-editor-body.tsx` to keep that
 * file near its line budget once the header/Preview wiring landed (UX
 * audit slice D).
 *
 * A selected *section*'s own toolbar is not built here: it is anchored to
 * the section itself (`editable-section.tsx`'s `SectionToolbar`, UX audit
 * §3.2/3.5). Only a node selection still uses the canvas `overlay` slot,
 * via `NodeBarAnchor` (UX audit §3.6/§7.3) - keyed on node type + position
 * so a different node selection remounts it fresh rather than reusing a
 * stale measured position.
 *
 * @module features/proposals/editor/bars/use-node-bar-content
 */
import type { Editor } from '@tiptap/react'
import type { ReactNode, RefObject } from 'react'

import { useRegisteredEditor } from '../editor-registry'
import type { LayoutEditorState } from '../state'

import { NodeBar } from './node-bar'
import { NodeBarAnchor } from './node-bar-anchor'
import type { NodeBarSection } from './node-bar-shared'
import { TableResizeOverlay } from './table-resize-overlay'

/** Options for {@link useNodeBarContent}. */
export interface UseNodeBarContentOptions {
  state: LayoutEditorState
  /** The canvas's scroll viewport, forwarded to `NodeBarAnchor` for measuring. */
  scrollRef: RefObject<HTMLDivElement | null>
  zoom: number
  swatches: readonly string[]
}

/** What {@link useNodeBarContent} returns. */
export interface UseNodeBarContentReturn {
  /** The registered TipTap editor for the selected section, or `null` when none is selected. */
  sectionEditor: Editor | null
  /** The node bar, pre-anchored to the selected node's on-canvas position - `null` when nothing is selected. Render straight into `CanvasFrame`'s `overlay` slot. */
  barContent: ReactNode
}

/** See the module doc. */
export function useNodeBarContent({ state, scrollRef, zoom, swatches }: UseNodeBarContentOptions): UseNodeBarContentReturn {
  const sectionEditor = useRegisteredEditor(state.selection.sectionId)
  // Spread `name` only when set: under `exactOptionalPropertyTypes`, an explicit `name: undefined` does not satisfy `name?: string`.
  const sectionOptions: readonly NodeBarSection[] = state.layout.sections.map((s) => ({ id: s.id, kind: s.kind, ...(s.name !== undefined ? { name: s.name } : {}) }))

  const barContent = state.selection.node && sectionEditor ? (
    <>
      <NodeBarAnchor
        key={`${state.selection.node.nodeType}@${state.selection.node.pos}`}
        editor={sectionEditor}
        pos={state.selection.node.pos}
        scrollRef={scrollRef}
        zoom={zoom}
      >
        <NodeBar
          node={state.selection.node}
          editor={sectionEditor}
          sections={sectionOptions}
          swatches={swatches}
        />
      </NodeBarAnchor>
      {/* A table's grips ride in the same overlay slot: its node view is not
          a React one, so they cannot mount inside it like `ImageGrips`. */}
      {state.selection.node.nodeType === 'table' && (
        <TableResizeOverlay key={`grips@${state.selection.node.pos}`} editor={sectionEditor} pos={state.selection.node.pos} scrollRef={scrollRef} zoom={zoom} />
      )}
    </>
  ) : null

  return { sectionEditor, barContent }
}
