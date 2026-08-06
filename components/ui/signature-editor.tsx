'use client'

import Placeholder from '@tiptap/extension-placeholder'
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import { useEffect, useMemo, useRef } from 'react'

import { SignatureImageView } from '@/components/ui/signature-image-view'
import { SignatureToolbar } from '@/components/ui/signature-toolbar'
import { SIGNATURE_BASE_EXTENSIONS, SignatureImage } from '@/lib/email/signature-extensions'

/** Props for {@link SignatureEditor}. */
export interface SignatureEditorProps {
  /** The current signature content (TipTap JSONContent). */
  value: JSONContent
  /** Called with the new content on every edit. */
  onChange: (value: JSONContent) => void
  /** Placeholder shown when the signature is empty. */
  placeholder?: string
}

/** An empty TipTap doc, the fallback when no signature is set. */
const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

/**
 * A Gmail/Outlook-style rich text editor for email signatures.
 *
 * Builds from the shared signature extension set the server-side renderer
 * also uses, so the stored JSON round-trips identically between editing
 * and sending. Emits JSONContent on every update. To avoid fighting the
 * user's typing, it ignores parent re-renders that merely echo back the
 * value it just emitted, and only re-syncs on a genuinely external change
 * (e.g. the saved signature loading in). The content uses the shared
 * `.contract-content` styles so lists, links, and headings render the
 * same as the contract / template editors.
 */
export function SignatureEditor({ value, onChange, placeholder = 'Warm regards, your name...' }: SignatureEditorProps) {
  // The editor image uses the same node as the server render, plus a
  // React NodeView for the resize handle and delete button.
  const extensions = useMemo(
    () => [
      ...SIGNATURE_BASE_EXTENSIONS,
      SignatureImage.configure({ inline: false }).extend({
        addNodeView: () => ReactNodeViewRenderer(SignatureImageView),
      }),
      Placeholder.configure({ placeholder }),
    ],
    [placeholder],
  )

  // Tracks the JSON we last emitted so a parent echo doesn't re-set the
  // editor mid-edit (which would jump the cursor / flick back content).
  const lastEmittedRef = useRef(JSON.stringify(value && Object.keys(value).length > 0 ? value : EMPTY_DOC))

  const editor = useEditor({
    extensions,
    content: value && Object.keys(value).length > 0 ? value : EMPTY_DOC,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON()
      lastEmittedRef.current = JSON.stringify(json)
      onChange(json)
    },
  })

  useEffect(() => {
    if (!editor) return
    const incoming = JSON.stringify(value)
    // Our own echo, or already in sync: leave the editor alone.
    if (incoming === lastEmittedRef.current) return
    if (incoming === JSON.stringify(editor.getJSON())) return
    lastEmittedRef.current = incoming
    editor.commands.setContent(value && Object.keys(value).length > 0 ? value : EMPTY_DOC, { emitUpdate: false })
  }, [value, editor])

  if (!editor) return null

  return (
    <div className="border border-border rounded-control overflow-hidden bg-surface">
      <SignatureToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="p-4 min-h-[200px] text-body text-text focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-text-subtle [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 [&_a]:text-blue-600 [&_a]:underline [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-section [&_h2]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3"
      />
    </div>
  )
}
