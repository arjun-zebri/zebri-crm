'use client'

import * as Popover from '@radix-ui/react-popover'
import type { Editor } from '@tiptap/react'
import { AlignCenter, AlignLeft, AlignRight, List, ListOrdered, Omega, Redo2, SeparatorHorizontal, Undo2 } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'

import { Tooltip } from '@/components/ui/tooltip'
import { SCRIPT_CHARACTER_GROUPS } from '@/lib/documents/script-characters'

import { ScriptToolbarText, ToolbarDivider, ToolbarToggle } from './script-toolbar-text'

/** Insert-character menu: accented letters the writer's keyboard may not have, for names spelt exactly. */
function CharacterMenu({ editor }: { editor: Editor }) {
  const [upper, setUpper] = useState(false)
  return (
    <Popover.Root>
      <Tooltip label="Insert accented character">
        <Popover.Trigger asChild>
          <button type="button" aria-label="Insert accented character" onMouseDown={(e) => e.preventDefault()} className="inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text">
            <Omega size={16} strokeWidth={1.5} />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-[90] w-[300px] rounded-control border border-border bg-surface p-2 shadow-xl">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-body text-text-subtle">Click a letter to insert it</span>
            <button type="button" aria-pressed={upper} onClick={() => setUpper((u) => !u)} className={`rounded-control px-1.5 py-0.5 text-body ${upper ? 'bg-surface-emphasis text-text' : 'text-text-muted hover:bg-surface-muted'}`}>
              {upper ? 'ABC' : 'abc'}
            </button>
          </div>
          {SCRIPT_CHARACTER_GROUPS.map((g) => (
            <div key={g.label} className="mt-1">
              <div className="px-1 text-body text-text-subtle">{g.label}</div>
              {/* In the script's own face so stacked marks (ắ, ệ) draw as they will in the document. */}
              <div className="script-document flex flex-wrap text-body">
                {[...g.chars].map((ch) => {
                  const c = upper ? ch.toUpperCase() : ch
                  return (
                    <button key={ch} type="button" onClick={() => editor.chain().focus().insertContent(c).run()} className="h-7 w-7 rounded-control leading-none text-text hover:bg-surface-muted">
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * The fixed script toolbar (Word-style, always visible). Re-renders on every
 * editor transaction so active states track the selection. Wraps onto a
 * second row on narrow screens. Every control carries a tooltip.
 */
export function ScriptToolbar({ editor }: { editor: Editor }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    editor.on('transaction', rerender)
    editor.on('selectionUpdate', rerender)
    return () => {
      editor.off('transaction', rerender)
      editor.off('selectionUpdate', rerender)
    }
  }, [editor])

  const align = (a: 'left' | 'center' | 'right') => editor.chain().focus().setTextAlign(a).run()

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 rounded-control border border-border bg-surface px-2 py-1.5">
      <ScriptToolbarText editor={editor} />
      <ToolbarDivider />
      <ToolbarToggle active={editor.isActive({ textAlign: 'left' })} onClick={() => align('left')} title="Align left"><AlignLeft size={16} strokeWidth={1.5} /></ToolbarToggle>
      <ToolbarToggle active={editor.isActive({ textAlign: 'center' })} onClick={() => align('center')} title="Align centre"><AlignCenter size={16} strokeWidth={1.5} /></ToolbarToggle>
      <ToolbarToggle active={editor.isActive({ textAlign: 'right' })} onClick={() => align('right')} title="Align right"><AlignRight size={16} strokeWidth={1.5} /></ToolbarToggle>
      <ToolbarDivider />
      <ToolbarToggle active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List size={16} strokeWidth={1.5} /></ToolbarToggle>
      <ToolbarToggle active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered size={16} strokeWidth={1.5} /></ToolbarToggle>
      <ToolbarToggle onClick={() => editor.chain().focus().setPageBreak().run()} title="Page break"><SeparatorHorizontal size={16} strokeWidth={1.5} /></ToolbarToggle>
      <CharacterMenu editor={editor} />
      <ToolbarDivider />
      <ToolbarToggle disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo2 size={16} strokeWidth={1.5} /></ToolbarToggle>
      <ToolbarToggle disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo2 size={16} strokeWidth={1.5} /></ToolbarToggle>
    </div>
  )
}
