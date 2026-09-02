'use client'

import type { Editor } from '@tiptap/react'
import { Bold, Highlighter, Italic, Minus, Plus, Underline } from 'lucide-react'

import { ColorPopover } from '@/components/ui/color-popover'
import { Select } from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import { SCRIPT_FONT_SIZES } from '@/lib/documents/script-extensions'
import {
  SCRIPT_FONT_FAMILIES,
  SCRIPT_FONT_IDS,
  SCRIPT_FONT_LABELS,
  scriptFontIdFromFamily,
  scriptFontStack,
} from '@/lib/documents/script-fonts'

const TEXT_COLOURS = ['#111827', '#6B7280', '#DC2626', '#EA580C', '#059669', '#0284C7', '#7C3AED', '#DB2777']
const HIGHLIGHTS = ['#FEF08A', '#FBBF24', '#FCA5A5', '#A7F3D0', '#93C5FD', '#D8B4FE']
/** Size of text carrying no size mark: the editor's base (`.script-document .ProseMirror`). */
const BASE_SIZE = 16

/** Sentinel for "the script's base face" (the Select cannot take an empty value). */
const INHERIT = '__inherit'

/** Each face is listed in itself, so the writer can see what they are picking. */
const FONT_OPTIONS = [
  { value: INHERIT, label: 'Script font' },
  ...SCRIPT_FONT_IDS.map((id) => ({
    value: id,
    label: <span style={{ fontFamily: scriptFontStack(id) }}>{SCRIPT_FONT_LABELS[id]}</span>,
  })),
]

/** One toolbar toggle with a tooltip. A real `<button>`, so no cursor class is needed. */
export function ToolbarToggle({ active, disabled, onClick, title, children }: { active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <Tooltip label={title}>
      <button
        type="button"
        aria-label={title}
        aria-pressed={active ?? false}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-control transition disabled:opacity-40 ${
          active ? 'bg-surface-emphasis text-text' : 'text-text-muted hover:bg-surface-muted hover:text-text'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  )
}

/** Thin vertical rule between toolbar groups. */
export function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px bg-border" />
}

/**
 * A colour-pick trigger: the glyph with a bar underneath showing the current
 * colour, as Word draws it. `ColorPopover` mounts it with `asChild`, so the
 * trigger props and ref it injects must reach the real button; the tooltip
 * wraps around the outside.
 */
function ColourTrigger({ title, colour, children, ref, ...rest }: { title: string; colour: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <Tooltip label={title}>
      <button
        type="button"
        aria-label={title}
        {...rest}
        ref={ref}
        onMouseDown={(e) => e.preventDefault()}
        className="inline-flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-control text-text-muted hover:bg-surface-muted hover:text-text"
      >
        {children}
        <span className="h-1 w-4 rounded-control" style={{ backgroundColor: colour }} />
      </button>
    </Tooltip>
  )
}

/** Font size at the cursor, and the ladder neighbours for the A- / A+ steps. */
function sizeAt(editor: Editor): { current: number; smaller: number | null; larger: number | null } {
  const raw = editor.getAttributes('textStyle').fontSize as string | undefined
  const current = raw ? Number.parseInt(raw, 10) || BASE_SIZE : BASE_SIZE
  const smaller = [...SCRIPT_FONT_SIZES].reverse().find((s) => s < current) ?? null
  const larger = SCRIPT_FONT_SIZES.find((s) => s > current) ?? null
  return { current, smaller, larger }
}

/**
 * Text-level controls of the script toolbar: font family, the size readout
 * with A- / A+ steps through the size ladder (as Word's grow / shrink font),
 * bold / italic / underline, text colour and highlight. There is no block
 * style menu: a heading is just bigger, bolder text, which these controls
 * already make. Every control routes through the editor's chain.
 *
 * The font select is mounted with `restoreFocus={false}` and focuses the
 * editor itself: Radix's close-time focus restore would otherwise leave the
 * closed trigger focused for a tick, and the next keystrokes typeahead-picked
 * another option instead of landing in the document.
 */
export function ScriptToolbarText({ editor }: { editor: Editor }) {
  const fontId = scriptFontIdFromFamily(editor.getAttributes('textStyle').fontFamily as string | undefined)
  const size = sizeAt(editor)
  const textColour = (editor.getAttributes('textStyle').color as string | undefined) || '#111827'
  const highlight = (editor.getAttributes('highlight').color as string | undefined) || '#FEF08A'

  return (
    <>
      <div className="w-40">
        <Select
          ariaLabel="Font"
          restoreFocus={false}
          options={FONT_OPTIONS}
          value={fontId ?? INHERIT}
          onValueChange={(v) => {
            const chain = editor.chain().focus()
            if (v === INHERIT) chain.unsetFontFamily().run()
            else chain.setFontFamily(SCRIPT_FONT_FAMILIES[v as keyof typeof SCRIPT_FONT_FAMILIES]).run()
            // Once more after the menu has unmounted: its focus trap is torn
            // down a frame later and can leave focus on the body in Chrome.
            setTimeout(() => editor.commands.focus(), 0)
          }}
        />
      </div>
      <ToolbarToggle title="Smaller text" disabled={size.smaller === null} onClick={() => size.smaller && editor.chain().focus().setFontSize(`${size.smaller}px`).run()}>
        <Minus size={16} strokeWidth={1.5} />
      </ToolbarToggle>
      <span className="w-7 text-center text-body tabular-nums text-text-muted" aria-label="Font size">{size.current}</span>
      <ToolbarToggle title="Larger text" disabled={size.larger === null} onClick={() => size.larger && editor.chain().focus().setFontSize(`${size.larger}px`).run()}>
        <Plus size={16} strokeWidth={1.5} />
      </ToolbarToggle>
      <ToolbarDivider />
      <ToolbarToggle active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold size={16} strokeWidth={1.5} /></ToolbarToggle>
      <ToolbarToggle active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic size={16} strokeWidth={1.5} /></ToolbarToggle>
      <ToolbarToggle active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><Underline size={16} strokeWidth={1.5} /></ToolbarToggle>
      <ColorPopover
        value={textColour}
        onChange={(c) => editor.chain().setColor(c).run()}
        swatches={TEXT_COLOURS}
        trigger={<ColourTrigger title="Text colour" colour={textColour}><span className="text-body font-semibold leading-none">A</span></ColourTrigger>}
      />
      <ColorPopover
        value={highlight}
        onChange={(c) => editor.chain().setHighlight({ color: c }).run()}
        swatches={HIGHLIGHTS}
        trigger={<ColourTrigger title="Highlight" colour={highlight}><Highlighter size={15} strokeWidth={1.5} /></ColourTrigger>}
      />
    </>
  )
}
