'use client'

import * as Popover from '@radix-ui/react-popover'
import Mention, { type MentionOptions } from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { JSONContent, NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote,
  Undo, Redo, AtSign,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { variableLabel } from '@/lib/automations/variables'
import { CONTRACT_VARIABLES } from '@/lib/contracts/contract-variables'
import { toPlainJSON } from '@/lib/utils'

/** A mergeable variable for the "Insert variable" popover. */
export interface EditorVariable {
  id: string
  label: string
  description: string
}

interface RichTextEditorProps {
  value: JSONContent
  onChange: (value: JSONContent) => void
  placeholder?: string
  editable?: boolean
  className?: string
  /**
   * Variables offered in the "Insert variable" popover. Defaults to the
   * contract variable set; email templates pass their own namespaced
   * list. The mention node stores the chosen `id` verbatim.
   */
  variables?: readonly EditorVariable[]
  /**
   * Show the "Insert variable" toolbar button. Off for surfaces that
   * edit an already-resolved email (the manual send preview), where
   * inserting a fresh `{{variable}}` would never get filled.
   */
  showVariableInserter?: boolean
  /**
   * How a mention node renders. `'token'` (default) shows the raw
   * `{{variable}}` in emerald — the template builder. `'label'` shows the
   * variable's human label in a red "fill me" chip — the manual send
   * preview, where a leftover mention is an unfilled gap to highlight.
   */
  mentionDisplay?: 'token' | 'label'
  /**
   * Pre-rendered, sanitised HTML for the MC's email signature. When
   * provided, a `{{mc.signature}}` mention renders **inline as this rich
   * block** (with a remove button) instead of a chip — so the compose
   * editor shows the finished signature in place and the MC can delete it
   * right there. Other surfaces omit this and signatures stay chips.
   */
  signatureHtml?: string | null
}

/** The variable path that injects the MC's email signature. */
const SIGNATURE_PATH = 'mc.signature'

/**
 * NodeView for mention nodes in the compose editor. The `{{mc.signature}}`
 * mention renders inline as the finished signature (rich HTML); click to
 * select it (a ring shows the selection) and press Delete/Backspace to
 * remove it. Every other mention falls back to the red "fill me" chip.
 * Only used when {@link RichTextEditor} is given `signatureHtml`.
 */
function MentionNodeView({ node, selected, extension }: NodeViewProps) {
  const id = String(node.attrs?.id ?? '')
  const signatureHtml = (extension.options as { signatureHtml?: string | null }).signatureHtml

  if (id === SIGNATURE_PATH) {
    if (!signatureHtml) {
      return (
        <NodeViewWrapper as="span" contentEditable={false} className="text-sm text-text-subtle">
          (no signature set)
        </NodeViewWrapper>
      )
    }
    return (
      <NodeViewWrapper
        as="div"
        contentEditable={false}
        className={`email-preview my-1 rounded-lg text-sm leading-relaxed text-text [&_a]:text-brand [&_p]:my-1 [&_img]:my-1 ${
          selected ? 'ring-2 ring-brand ring-offset-2' : ''
        }`}
        // Sanitised upstream by renderSignatureHtml before being passed in.
        dangerouslySetInnerHTML={{ __html: signatureHtml }}
      />
    )
  }

  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className={`inline-block rounded bg-red-100 px-1.5 py-0.5 text-sm font-medium text-red-700 ${
        selected ? 'ring-2 ring-red-400' : ''
      }`}
    >
      {variableLabel(id)}
    </NodeViewWrapper>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing your contract…',
  editable = true,
  className = '',
  variables = CONTRACT_VARIABLES,
  showVariableInserter = true,
  mentionDisplay = 'token',
  signatureHtml,
}: RichTextEditorProps) {
  // When a signature is supplied (compose editor), the mention extension
  // gets a React NodeView so `{{mc.signature}}` renders inline as the rich
  // signature block. Everywhere else, the lightweight `renderHTML` chip is
  // used — keeping template / contract editors untouched.
  const mentionExtension =
    signatureHtml !== undefined
      ? Mention.extend<MentionOptions & { signatureHtml: string | null }>({
          // Make mentions selectable so the rendered signature (and any
          // fill-me chip) can be clicked and removed with Delete/Backspace.
          selectable: true,
          addOptions() {
            return { ...this.parent?.(), signatureHtml } as MentionOptions & {
              signatureHtml: string | null
            }
          },
          addNodeView() {
            return ReactNodeViewRenderer(MentionNodeView)
          },
        })
      : Mention.configure({
          HTMLAttributes: {
            class:
              mentionDisplay === 'label'
                ? 'inline-block rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-sm font-medium'
                : 'inline-block rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-sm font-medium',
          },
          renderHTML({ options, node }) {
            const id = String(node.attrs.id)
            return [
              'span',
              options.HTMLAttributes,
              mentionDisplay === 'label' ? variableLabel(id) : `{{${id}}}`,
            ]
          },
        })

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      mentionExtension,
    ],
    content: value && Object.keys(value).length > 0 ? value : { type: 'doc', content: [{ type: 'paragraph' }] },
    editable,
    immediatelyRender: false,
    // `getJSON()` returns mention `attrs` as null-prototype objects, which
    // React Server Action serialisation silently drops (the variable id is
    // lost, saving `{{null}}`). Normalise to plain objects on the way out.
    onUpdate: ({ editor }) => onChange(toPlainJSON(editor.getJSON())),
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
        <ToolbarRow
          editor={editor}
          onInsertVariable={insertVariable}
          variables={variables}
          showVariableInserter={showVariableInserter}
        />
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
  variables,
  showVariableInserter,
}: {
  editor: ReturnType<typeof useEditor>
  onInsertVariable: (id: string) => void
  variables: readonly EditorVariable[]
  showVariableInserter: boolean
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
      {showVariableInserter && (
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
              {variables.map((v) => (
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
      )}
    </div>
  )
}
