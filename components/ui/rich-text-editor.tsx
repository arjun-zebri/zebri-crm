'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import {
  Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote,
  Undo, Redo, AtSign,
} from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { CONTRACT_VARIABLES } from '@/lib/contract-variables'

interface RichTextEditorProps {
  value: JSONContent
  onChange: (value: JSONContent) => void
  placeholder?: string
  editable?: boolean
  className?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing your contract…',
  editable = true,
  className = '',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: {
          class:
            'inline-block rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-sm font-medium',
        },
        renderHTML({ options, node }) {
          return [
            'span',
            options.HTMLAttributes,
            `{{${node.attrs.id}}}`,
          ]
        },
      }),
    ],
    content: value && Object.keys(value).length > 0 ? value : { type: 'doc', content: [{ type: 'paragraph' }] },
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  })

  // Sync external value changes (e.g. when a template is applied)
  const lastValueRef = useRef<string>('')
  useEffect(() => {
    if (!editor) return
    const serialized = JSON.stringify(value)
    if (serialized === lastValueRef.current) return
    lastValueRef.current = serialized
    if (serialized !== JSON.stringify(editor.getJSON())) {
      editor.commands.setContent(value && Object.keys(value).length > 0 ? value : { type: 'doc', content: [{ type: 'paragraph' }] }, { emitUpdate: false })
    }
  }, [value, editor])

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable)
    }
  }, [editable, editor])

  if (!editor) return null

  const insertVariable = (id: string) => {
    editor.chain().focus().insertContent({
      type: 'mention',
      attrs: { id },
    }).insertContent(' ').run()
  }

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden bg-white ${className}`}>
      {editable && (
        <ToolbarRow editor={editor} onInsertVariable={insertVariable} />
      )}
      <EditorContent
        editor={editor}
        className="contract-content p-4 min-h-[320px] text-sm text-gray-900 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[280px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition cursor-pointer ${
        active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function ToolbarRow({
  editor,
  onInsertVariable,
}: {
  editor: ReturnType<typeof useEditor>
  onInsertVariable: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  if (!editor) return null
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/50">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 size={16} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 size={16} strokeWidth={1.5} />
      </ToolbarButton>
      <div className="w-px h-5 bg-gray-200 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold size={16} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic size={16} strokeWidth={1.5} />
      </ToolbarButton>
      <div className="w-px h-5 bg-gray-200 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List size={16} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered list"
      >
        <ListOrdered size={16} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Quote"
      >
        <Quote size={16} strokeWidth={1.5} />
      </ToolbarButton>
      <div className="w-px h-5 bg-gray-200 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo"
      >
        <Undo size={16} strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo"
      >
        <Redo size={16} strokeWidth={1.5} />
      </ToolbarButton>
      <div className="flex-1" />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition rounded-md px-2.5 py-1 cursor-pointer"
          >
            <AtSign size={13} strokeWidth={1.5} />
            Insert variable
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-[90] w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 animate-fade-in"
          >
            <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
              Auto-filled from the couple, quote and settings
            </div>
            <div className="max-h-72 overflow-y-auto">
              {CONTRACT_VARIABLES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    onInsertVariable(v.id)
                    setOpen(false)
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  <p className="text-sm text-gray-900">{v.label}</p>
                  <p className="text-xs text-gray-500">{v.description}</p>
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
