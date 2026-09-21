'use client'

import type { JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import type { EditorView } from '@tiptap/pm/view'
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

/**
 * What Enter does in a field. `paragraph` starts a new paragraph (body copy);
 * `lineBreak` inserts a soft break inside the one paragraph (a heading that
 * wraps onto a chosen line, rendered as `<br>`); `blur` commits and leaves
 * (single-line labels). Escape leaves the field in every mode.
 */
export type EnterKeyMode = 'paragraph' | 'lineBreak' | 'blur'

export interface RichTextProps {
  /** Current field content (TipTap JSON, or a legacy string during migration). */
  value: JSONContent | string | null | undefined
  /** Called with new JSON on every edit. */
  onChange: (value: JSONContent) => void
  /** Surface whose variable set the insert menu offers. */
  surface: SurfaceTab
  /** Placeholder shown when empty. */
  placeholder?: string
  /** Shorthand for `enterKey="blur"`, kept for the document fields that use it. */
  singleLine?: boolean
  /** See {@link EnterKeyMode}. Defaults to `paragraph`, or `blur` when `singleLine` is set. */
  enterKey?: EnterKeyMode
  className?: string
  style?: React.CSSProperties
}

/**
 * Whether the floating toolbar should be visible. It shows for a selection of
 * real text only, like the inline bar in a document editor, and stays up while
 * one of its own menus (size / colour / variable) has focus so a pick doesn't
 * dismiss it.
 *
 * It deliberately does NOT show on a bare caret, nor when the selection holds
 * only a variable chip (e.g. selecting the whole `{{ couple_name }}` heading):
 * the bar floats over the text, so a bar with nothing to format sat on top of
 * the very words you were trying to click into, and read as a second toolbar
 * beside the block toolbar. Whole-field styling lives in the block toolbar;
 * this bar marks a selected range of characters.
 */
export function bubbleShouldShow(o: { menuFocused: boolean; hasTextSelection: boolean }): boolean {
  return o.hasTextSelection || o.menuFocused
}

/** Inserts a hard line break at the selection (the same node Shift+Enter makes). */
function insertLineBreak(view: EditorView): boolean {
  const br = view.state.schema.nodes.hardBreak
  if (!br) return false
  view.dispatch(view.state.tr.replaceSelectionWith(br.create()).scrollIntoView())
  return true
}

/**
 * Rich-text field for branding blocks: TipTap with per-range marks (bold,
 * italic, underline, colour, font size, highlight) and inline variable chips,
 * edited via a floating toolbar on selection. Stores TipTap JSON that the server
 * renders and resolves (see `render-rich-text.ts`). Ignores parent echoes of the
 * value it just emitted so it never fights the caret mid-edit (same guard as the
 * signature editor).
 */
export function RichText({ value, onChange, surface, placeholder, singleLine = false, enterKey, className = '', style }: RichTextProps) {
  const enterMode: EnterKeyMode = enterKey ?? (singleLine ? 'blur' : 'paragraph')
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
      // Expose the contenteditable as a textbox for assistive tech (TipTap
      // sets neither role nor a name on its own), named from the placeholder,
      // the same as the InlineText fields these replaced.
      attributes: {
        role: 'textbox',
        'aria-multiline': enterMode === 'blur' ? 'false' : 'true',
        ...(placeholder ? { 'aria-label': placeholder } : {}),
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          view.dom.blur()
          return true
        }
        // Shift+Enter keeps StarterKit's own hard break in every mode.
        if (event.key !== 'Enter' || event.shiftKey) return false
        if (enterMode === 'blur') {
          event.preventDefault()
          view.dom.blur()
          return true
        }
        if (enterMode === 'lineBreak') {
          event.preventDefault()
          return insertLineBreak(view)
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Normalise to a plain object so a server action never drops null-proto
      // mention attrs (see the toPlainJSON memo).
      const json = JSON.parse(JSON.stringify(ed.getJSON())) as JSONContent
      lastEmittedRef.current = JSON.stringify(json)
      onChange(json)
    },
    onFocus: ({ editor: ed }) => {
      // Select the block that owns this field, the same signal InlineText
      // sends, so clicking any rich-text field opens that block's toolbar.
      const block = ed.view.dom.closest('[data-block-id]')
      if (block && !block.hasAttribute('data-selected')) {
        block.dispatchEvent(new CustomEvent('zebri:text-focus', { bubbles: true, detail: { blockId: block.getAttribute('data-block-id') } }))
      }
    },
  })

  useEffect(() => {
    if (!editor) return
    const incoming = JSON.stringify(toDoc(value))
    if (incoming === lastEmittedRef.current) return
    if (incoming === JSON.stringify(editor.getJSON())) return
    lastEmittedRef.current = incoming
    // Deferred out of the commit phase: variable chips are React node views,
    // which TipTap mounts with flushSync, and React refuses to flush from
    // inside an effect ("flushSync was called from inside a lifecycle
    // method"). A microtask runs before the next paint, so the canvas never
    // shows the stale text.
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || editor.isDestroyed) return
      editor.commands.setContent(toDoc(value), { emitUpdate: false })
    })
    return () => {
      cancelled = true
    }
  }, [value, editor])

  if (!editor) return null

  return (
    <>
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: ed }) => {
          const { from, to, empty } = ed.state.selection
          // textBetween with an empty leaf-text arg counts characters only:
          // a selection of just a variable atom yields '' and stays hidden.
          const hasTextSelection = !empty && ed.state.doc.textBetween(from, to, '', '').length > 0
          return bubbleShouldShow({
            // The bubble's own menus (size, colour, variable) are portalled, so
            // they are found by attribute rather than by DOM containment.
            menuFocused: !!document.activeElement?.closest('[data-rich-text-bubble]'),
            hasTextSelection,
          })
        }}
      >
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
