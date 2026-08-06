'use client'

import * as Popover from '@radix-ui/react-popover'
import { type Editor } from '@tiptap/react'
import { Bold, ChevronDown, Highlighter, Italic, Plus, Underline } from 'lucide-react'

import { ColorPopover } from '@/components/ui/color-popover'
import { VARIABLES_BY_SURFACE } from '@/lib/branding/document-variables'
import { RICH_TEXT_FONT_SIZES } from '@/lib/branding/rich-text-extensions'
import type { SurfaceTab } from '@/types/branding-preview'

const TEXT_COLOURS = ['#111827', '#6B7280', '#DC2626', '#EA580C', '#059669', '#0284C7', '#7C3AED', '#DB2777']
const HIGHLIGHTS = ['#FEF08A', '#FBBF24', '#FCA5A5', '#A7F3D0', '#93C5FD', '#D8B4FE']

/**
 * The floating (bubble) toolbar shown over a text selection in a {@link RichText}
 * field: bold / italic / underline, font size, text colour, highlight, and an
 * insert-variable menu scoped to the current surface. All edits route through the
 * passed TipTap editor; colour pickers avoid `.focus()` so the selection is
 * preserved while the popover is open (mirrors the signature toolbar).
 */
export function RichTextBubble({ editor, surface }: { editor: Editor; surface: SurfaceTab }) {
  return (
    <div className="flex items-center gap-0.5 rounded-control border border-border bg-surface px-1 py-1 shadow-lg">
      <Toggle active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold size={15} strokeWidth={1.75} /></Toggle>
      <Toggle active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic size={15} strokeWidth={1.75} /></Toggle>
      <Toggle active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><Underline size={15} strokeWidth={1.75} /></Toggle>
      <Divider />
      <SizeMenu editor={editor} />
      <ColorPopover
        value={editor.getAttributes('textStyle').color || '#111827'}
        onChange={(c) => editor.chain().setColor(c).run()}
        swatches={TEXT_COLOURS}
        trigger={
          <button type="button" title="Text colour" className="flex items-center gap-1 px-1.5 h-7 rounded-control text-gray-700 hover:bg-surface-emphasis cursor-pointer">
            <span className="text-body font-semibold leading-none">A</span>
            <span className="w-3.5 h-1.5 rounded-control" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#111827' }} />
          </button>
        }
      />
      <ColorPopover
        value={editor.getAttributes('highlight').color || '#FEF08A'}
        onChange={(c) => editor.chain().setHighlight({ color: c }).run()}
        swatches={HIGHLIGHTS}
        trigger={
          <button type="button" title="Highlight" className="flex items-center gap-1 px-1.5 h-7 rounded-control text-gray-700 hover:bg-surface-emphasis cursor-pointer">
            <Highlighter size={15} strokeWidth={1.75} />
          </button>
        }
      />
      <Divider />
      <VariableMenu editor={editor} surface={surface} />
    </div>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />
}

function Toggle({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-control cursor-pointer transition ${active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-surface-emphasis'}`}
    >
      {children}
    </button>
  )
}

/** Font-size dropdown; unset returns to the field's baseline role size. */
function SizeMenu({ editor }: { editor: Editor }) {
  const current = editor.getAttributes('textStyle').fontSize as string | undefined
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" title="Font size" className="flex items-center gap-1 px-1.5 h-7 rounded-control text-caption font-medium text-gray-700 hover:bg-surface-emphasis cursor-pointer">
          {current ? current.replace('px', '') : 'Size'}
          <ChevronDown size={12} strokeWidth={2} className="text-text-subtle" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-[80] bg-surface border border-border rounded-control shadow-lg py-1 min-w-[5rem]">
          {RICH_TEXT_FONT_SIZES.map((s) => (
            <Popover.Close asChild key={s}>
              <button type="button" onClick={() => editor.chain().focus().setFontSize(`${s}px`).run()} className="w-full text-left px-3 py-1.5 text-body text-gray-700 hover:bg-gray-50 cursor-pointer">{s}</button>
            </Popover.Close>
          ))}
          <Popover.Close asChild>
            <button type="button" onClick={() => editor.chain().focus().unsetFontSize().run()} className="w-full text-left px-3 py-1.5 text-body text-text-muted border-t border-gray-100 hover:bg-gray-50 cursor-pointer">Default</button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Insert-variable menu, grouped, scoped to the current surface's variables. */
function VariableMenu({ editor, surface }: { editor: Editor; surface: SurfaceTab }) {
  const vars = VARIABLES_BY_SURFACE[surface] ?? []
  const groups = [...new Set(vars.map((v) => v.group))]
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" title="Insert variable" className="flex items-center gap-1 px-2 h-7 rounded-control text-caption font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer">
          <Plus size={13} strokeWidth={2} />
          Variable
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-[80] bg-surface border border-border rounded-control shadow-xl p-2 w-[220px] max-h-[300px] overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={group} className={gi > 0 ? 'mt-2 pt-2 border-t border-gray-100' : ''}>
              <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.08em] text-text-subtle">{group}</div>
              {vars.filter((v) => v.group === group).map((v) => (
                <Popover.Close asChild key={v.id}>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().insertContent({ type: 'variable', attrs: { id: v.id } }).run()}
                    className="w-full text-left px-2 py-1.5 rounded-control text-body text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    {v.label}
                  </button>
                </Popover.Close>
              ))}
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
