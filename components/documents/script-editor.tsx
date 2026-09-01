'use client'

import type { JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, ReactNodeViewRenderer, useEditor, type Editor } from '@tiptap/react'
import { useEffect, useMemo, useRef } from 'react'

import { EMPTY_SCRIPT_DOC, PageBreak, SCRIPT_EXTENSIONS, scriptDocEquals } from '@/lib/documents/script-extensions'
import { scriptFontStack, type ScriptFontId } from '@/lib/documents/script-fonts'

import { ScriptPageBreakView } from './script-page-break'

export interface ScriptEditorProps {
  /**
   * The document to edit. Read when the editor mounts and again only if a
   * structurally different document arrives (a restore, not an echo of the
   * editor's own save coming back from the database with keys reordered).
   */
  value: JSONContent | null | undefined
  /** Called with plain (JSON-safe) content on every edit. */
  onChange: (value: JSONContent) => void
  /** Base face for the whole document; per-selection marks override it. */
  font: ScriptFontId
  /** Hands the editor instance up so the toolbar can drive it. */
  onEditorReady?: (editor: Editor | null) => void
  placeholder?: string
  editable?: boolean
}

/** Coerce a stored value to a doc; an empty object becomes the empty doc. */
function toDoc(value: JSONContent | null | undefined): JSONContent {
  return value && Object.keys(value).length > 0 ? value : EMPTY_SCRIPT_DOC
}

/**
 * The script writing surface: TipTap with the script schema (headings,
 * lists, colour, font family / size, highlight, alignment, page breaks).
 * Owns no toolbar; `ScriptToolbar` drives the editor instance handed up
 * through `onEditorReady`.
 *
 * Content is compared structurally, never as a JSON string: the saved row
 * comes back from Postgres with keys reordered, and a string comparison read
 * that as a new document and reset the editor after every autosave (cursor
 * to the end, selection lost, redo stack gone).
 */
export function ScriptEditor({ value, onChange, font, onEditorReady, placeholder, editable = true }: ScriptEditorProps) {
  const extensions = useMemo(
    () => [
      ...SCRIPT_EXTENSIONS.filter((e) => e.name !== 'pageBreak'),
      PageBreak.extend({ addNodeView: () => ReactNodeViewRenderer(ScriptPageBreakView) }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing your script…' }),
    ],
    [placeholder],
  )

  const lastEmittedRef = useRef<JSONContent>(toDoc(value))

  const editor = useEditor({
    extensions,
    content: toDoc(value),
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      // Plain object: a server action drops null-prototype attrs otherwise.
      const json = JSON.parse(JSON.stringify(ed.getJSON())) as JSONContent
      lastEmittedRef.current = json
      onChange(json)
    },
  })

  useEffect(() => {
    onEditorReady?.(editor)
    return () => onEditorReady?.(null)
  }, [editor, onEditorReady])

  useEffect(() => {
    if (!editor) return
    const incoming = toDoc(value)
    if (scriptDocEquals(incoming, lastEmittedRef.current)) return
    if (scriptDocEquals(incoming, editor.getJSON())) return
    lastEmittedRef.current = incoming
    editor.commands.setContent(incoming, { emitUpdate: false })
  }, [value, editor])

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  if (!editor) return null

  return (
    <div className="script-document flex-1 min-h-0" style={{ fontFamily: scriptFontStack(font) }}>
      <EditorContent
        editor={editor}
        className="h-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:px-1 [&_.ProseMirror]:py-2 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-text-subtle [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  )
}
