'use client'

/**
 * One TipTap editor bound to one content section's rich doc. A controlled
 * component: `content` flows in from the layout editor's reducer state
 * (Task 3, `state.ts`) on every edit, and `onChange` streams normalised
 * JSON back out; this component never owns the document, only a live
 * copy of it. Content flows layout -> editor only on history navigation
 * (undo, redo) and `replaceLayout`, signalled by the `externalVersion`
 * prop bumping (see the re-hydration effect below) - never on a plain
 * `content` change on its own, because `content` can be stale
 * mid-transaction: a `useSyncExternalStore` subscriber elsewhere in the
 * tree (e.g. a node bar reading `editor-registry.ts`) can force a
 * synchronous re-render before a batched edit lands, and re-hydrating
 * from a stale prop there silently discarded the edit in flight (a
 * live-reproduced bug; see the Phase 2 fix report). Registers itself in
 * `editor-registry.ts` for the lifetime of the mount, so a toolbar
 * rendered elsewhere in the tree can reach this exact `Editor` instance
 * by section id.
 *
 * @module features/proposals/editor/content-section-editor
 */
import type { JSONContent } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { useEffect, useMemo, useRef } from 'react'

import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ProposalTheme } from '../model/theme'

import { getEditor, registerEditor, unregisterEditor } from './editor-registry'
import { docTypeVars, EDITOR_PROSE_CLASS } from './editor-styles'
import { buildRichDocExtensions, normaliseEditorJSON } from './extensions'
import { LinkHoverTooltip } from './link-hover-tooltip'
import { nodeSelectionFor } from './node-selection-for'
import { ProposalEditorBrandingProvider } from './node-views/branding-context'
import { useRehydrateEditor } from './use-rehydrate-editor'

/** A node picked out of a section's doc by clicking an atom (image, button, spacer, ...), or `null` for any other selection. */
export interface EditorNodeSelection {
  sectionId: string
  nodeType: string
  pos: number
}

/**
 * Shown (via TipTap's `Placeholder` extension + the `data-placeholder` CSS
 * in `editor-styles.ts`) on the empty block holding the caret - so an
 * empty content section (the "Start from scratch" starter, a fresh "Text"
 * section from the add palette) and any blank line the caret lands on
 * both say what `/` does, the way Qwilr's editor does.
 */
export const CONTENT_PLACEHOLDER = 'Type / to add content'

/** Props for {@link ContentSectionEditor}. */
export interface ContentSectionEditorProps {
  /** The owning section's id: the registry key (`editor-registry.ts`) and every callback's identifying argument. */
  sectionId: string
  /** The section's current rich-doc JSON. Streams into the reducer on every edit; see `externalVersion` below for when a change here actually re-hydrates the live editor. */
  content: JSONContent
  /** Bumped by `useLayoutEditor` on a layout change from outside `dispatch` - undo, redo, `replaceLayout` (`state.ts`'s `LayoutEditorState.externalVersion`) - and only then does the effect below re-hydrate the live editor from `content`; unaffected by an ordinary edit dispatch, so it can never reset the editor mid-transaction. */
  externalVersion: number
  /** Resolved branding, for the doc's heading/body type roles (`editor-styles.ts`). */
  branding: PublicBranding
  /** The layout's canvas theme: Heading 1/2/3 and Paragraph come from here (`editor-styles.ts`'s `docTypeVars`). */
  theme: ProposalTheme
  /** Section-level colour override for every text node (mirrors `RichDocContext.textColor`). */
  textColor?: string | undefined
  /** Section-level default alignment (mirrors `RichDocContext.align`). */
  align?: 'left' | 'center' | 'right' | undefined
  /** Fired on every document change with normalised JSON (already `toPlainJSON`ed, null attrs dropped). */
  onChange: (sectionId: string, content: JSONContent) => void
  /** Fired when this editor gains focus, so the layout editor can select its owning section. */
  onFocusSection: (sectionId: string) => void
  /** Fired when the selection becomes a `NodeSelection` on an atom node, or on the `columns` container (the one non-atom node view: a click on its own gutter/box, not on a child's text, still selects the row, see `node-views/select-node.ts`), or when the caret is inside a `table` (reported at the table's position); fired with `null` for any other selection. Only called when the reported value actually changes. */
  onNodeSelect: (node: EditorNodeSelection | null) => void
}

/**
 * One section's rich-text editor. Renders `content` into a live TipTap
 * instance, streams normalised edits back through `onChange`, and keeps
 * the DOM's brand type roles in sync with `branding`/`textColor` via the
 * CSS custom properties `editor-styles.ts` defines, since ProseMirror's
 * headings and paragraphs are plain DOM nodes TipTap owns, not React
 * elements this component can style per node.
 */
export function ContentSectionEditor(props: ContentSectionEditorProps) {
  const { sectionId, content, externalVersion, branding, theme, textColor, align, onChange, onFocusSection, onNodeSelect } = props

  // The last node-selection value reported, keyed by node type + position
  // (not object identity: a fresh `{ sectionId, nodeType, pos }` literal
  // is built on every selection event), so a selection change that keeps
  // landing on "nothing selected" - e.g. moving the caret between two
  // paragraphs - does not re-fire the callback on every keystroke.
  const lastReportedRef = useRef<string | null>(null)

  /** Reports the node the selection is on (`nodeSelectionFor`), deduped by the key above. */
  const reportSelection = (ed: Editor) => {
    const report = nodeSelectionFor(ed.state)
    const node = report ? { sectionId, ...report } : null
    const key = node ? `${node.nodeType}@${node.pos}` : null
    if (key === lastReportedRef.current) return
    lastReportedRef.current = key
    onNodeSelect(node)
  }

  // Built once, not on every render (matches the Branding editor's
  // `rich-text.tsx`): a fresh array of freshly-`.configure()`d extension
  // instances on every keystroke is needless allocation, even though
  // `useEditor`'s default `deps: []` would otherwise ignore the change.
  const extensions = useMemo(() => buildRichDocExtensions({ nodeViews: true, placeholder: CONTENT_PLACEHOLDER }), [])

  const editor = useEditor({
    extensions,
    content,
    // Matches the Branding editor's `rich-text.tsx`: TipTap's SSR HTML
    // would not match the client's first paint of a doc built from JSON
    // (attrs order, whitespace), so rendering is deferred to the client.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: EDITOR_PROSE_CLASS },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(sectionId, normaliseEditorJSON(ed.getJSON()))
    },
    onFocus: ({ editor: ed }) => {
      // A focus that lands while a node is already selected is the tail of
      // a programmatic `focus()` (an insert from the slash menu or the
      // insert-media host, a grip click) and arrives after the node
      // selection was reported. Promoting it to a section-level `select`
      // would clear that node selection, so it is left alone: `selectNode`
      // already set the section id.
      if (ed.state.selection instanceof NodeSelection) return
      onFocusSection(sectionId)
      // `select` just cleared the layout's node selection, so the last
      // reported value is now "nothing", and the caret may already be
      // inside a table without any `selectionUpdate` to follow: a click
      // back onto the very spot the caret left (after a click on the
      // workbench blurred the editor) changes nothing in ProseMirror's
      // selection, so it emits no event. Re-reporting from here is what
      // brings the table bar back in that case.
      lastReportedRef.current = null
      reportSelection(ed)
    },
    onSelectionUpdate: ({ editor: ed }) => reportSelection(ed),
  })

  // Node views (Task 7) render through the shared renderer components,
  // which take branding via a `RichDocContext`, not a TipTap prop.
  // `ProposalEditorBrandingProvider` below is the reactive channel (a
  // node view mounted inside `EditorContent` re-renders when `branding`
  // changes); this also seeds `editor.storage.proposalEditor` through a
  // command (not a direct `editor.storage.x = …` write, which the
  // `react-hooks/immutability` lint forbids on a hook's return value: see
  // `extensions/proposal-editor-storage.ts`) as the non-reactive fallback
  // for a node view that reads storage before its first paint, or one
  // rendered outside this provider entirely (a bare test harness).
  useEffect(() => {
    if (!editor) return
    editor.commands.setProposalBranding(branding)
  }, [editor, branding])

  // Registers this editor for the lifetime of the mounted instance. A
  // fresh `editor` from `useEditor` (extensions never change identity
  // after mount, so this only really re-runs on `sectionId` changing, or
  // once when `editor` first exists) re-registers under the same key;
  // only the unmount cleanup removes it, closing the gap between one
  // section editor unmounting and its replacement mounting.
  useEffect(() => {
    if (!editor) return
    registerEditor(sectionId, editor)
    return () => {
      // Guards a StrictMode double-invoke / fast remount: only clear the
      // slot if it still holds *this* editor, not one a newer effect run
      // already registered in its place.
      if (getEditor(sectionId) === editor) unregisterEditor(sectionId)
    }
  }, [sectionId, editor])

  // See `use-rehydrate-editor.ts`'s module doc for why this is keyed on
  // `externalVersion`, not on `content` itself.
  useRehydrateEditor(editor, content, externalVersion)

  if (!editor) return null

  return (
    <ProposalEditorBrandingProvider branding={branding}>
      <EditorContent
        editor={editor}
        style={{ ...docTypeVars(branding, theme, textColor, align), ...(align ? { textAlign: align } : {}) }}
      />
      <LinkHoverTooltip editor={editor} />
    </ProposalEditorBrandingProvider>
  )
}
