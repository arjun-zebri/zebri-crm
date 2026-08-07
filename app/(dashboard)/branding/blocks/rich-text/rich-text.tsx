'use client'

import type { JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { useEffect, useMemo, useRef } from 'react'

import { RICH_TEXT_EXTENSIONS, Variable } from '@/lib/branding/rich-text-extensions'
import type { SurfaceTab } from '@/types/branding-preview'

import { RichTextBubble } from './rich-text-bubble'
import { VariableChip } from './variable-chip'

/** An empty single-paragraph doc, the fallback when a field has no content. */
const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

/**
 * Coerce a field value to a TipTap doc. A legacy plain/HTML string (not yet
 * migrated in the DB) is stripped of tags and wrapped in a paragraph so the
 * editor shows the existing content instead of appearing empty.
 */
function toDoc(value: JSONContent | string | null | undefined): JSONContent {
  if (!value) return EMPTY_DOC
  if (typeof value === 'string') {
    const plain = value.replace(/<[^>]*>/g, '').trim()
    return { type: 'doc', content: [{ type: 'paragraph', ...(plain ? { content: [{ type: 'text', text: plain }] } : {}) }] }
  }
  return Object.keys(value).length > 0 ? value : EMPTY_DOC
}

export interface RichTextProps {
  /** Current field content (TipTap JSON, or a legacy string during migration). */
  value: JSONContent | string | null | undefined
  /** Called with new JSON on every edit. */
  onChange: (value: JSONContent) => void
  /** Surface whose variable set the insert menu offers. */
  surface: SurfaceTab
  /** Placeholder shown when empty. */
  placeholder?: string
  /** Single-line fields (title, labels) suppress Enter/newlines. Default false. */
  singleLine?: boolean
  className?: string
  style?: React.CSSProperties
}

/**
 * Rich-text field for branding blocks: TipTap with per-range marks (bold,
 * italic, underline, colour, font size, highlight) and inline variable chips,
 * edited via a floating toolbar on selection. Stores TipTap JSON that the server
 * renders and resolves (see `render-rich-text.ts`). Ignores parent echoes of the
 * value it just emitted so it never fights the caret mid-edit (same guard as the
 * signature editor).
 */
export function RichText({ value, onChange, surface, placeholder, singleLine = false, className = '', style }: RichTextProps) {
  const extensions = useMemo(
    () => [
      ...RICH_TEXT_EXTENSIONS.filter((e) => e.name !== 'variable'),
      Variable.extend({ addNodeView: () => ReactNodeViewRenderer(VariableChip) }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    [placeholder],
  )

  const lastEmittedRef = useRef(JSON.stringify(toDoc(value)))

  const editor = useEditor({
    extensions,
    content: toDoc(value),
    immediatelyRender: false,
    editorProps: {
      // Single-line fields commit and blur on Enter rather than splitting.
      handleKeyDown: singleLine
        ? (_view, event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              ;(document.activeElement as HTMLElement | null)?.blur()
              return true
            }
            return false
          }
        : undefined,
    },
    onUpdate: ({ editor: ed }) => {
      // Normalise to a plain object so a server action never drops null-proto
      // mention attrs (see the toPlainJSON memo).
      const json = JSON.parse(JSON.stringify(ed.getJSON())) as JSONContent
      lastEmittedRef.current = JSON.stringify(json)
      onChange(json)
    },
  })

  useEffect(() => {
    if (!editor) return
    const incoming = JSON.stringify(toDoc(value))
    if (incoming === lastEmittedRef.current) return
    if (incoming === JSON.stringify(editor.getJSON())) return
    lastEmittedRef.current = incoming
    editor.commands.setContent(toDoc(value), { emitUpdate: false })
  }, [value, editor])

  if (!editor) return null

  return (
    <>
      {/* Only show the toolbar for a non-empty selection (not just a caret). */}
      <BubbleMenu editor={editor} shouldShow={({ editor: ed }) => !ed.state.selection.empty}>
        <RichTextBubble editor={editor} surface={surface} />
      </BubbleMenu>
      <EditorContent
        editor={editor}
        className={`[&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-text-subtle [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 ${className}`}
        style={style}
      />
    </>
  )
}
