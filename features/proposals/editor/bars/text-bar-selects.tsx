'use client'

/**
 * The text bar's Style, Font and Size selects: the row's three plain
 * value pickers, grouped into one file since none needs more than a
 * few lines around the shared `Select` primitive.
 *
 * @module features/proposals/editor/bars/text-bar-selects
 */
import type { Editor } from '@tiptap/react'

import { Select, type SelectOption } from '@/components/editor'
import { FONT_LABELS } from '@/lib/branding/fonts'
import { RICH_TEXT_FONT_SIZES } from '@/lib/branding/rich-text-extensions'

import { FONT_NONE, FONT_OPTIONS, fontIdFromStack } from './text-bar-fonts'
import { applyTextStyle, type StyleValue, type TextState } from './text-bar-style'

/** The Style select's options, in the order the bar shows them. */
const STYLE_OPTIONS: SelectOption<StyleValue>[] = [
  { value: 'heading1', label: 'Heading 1' },
  { value: 'heading2', label: 'Heading 2' },
  { value: 'heading3', label: 'Heading 3' },
  { value: 'paragraph', label: 'Paragraph' },
]

/** Style select: Heading 1 / Heading 2 / Heading 3 / Paragraph. */
export function TextBarStyleSelect({ editor, state }: { editor: Editor; state: TextState }) {
  return (
    <div className="w-[108px] shrink-0">
      <Select<StyleValue> size="xs" value={state.style} options={STYLE_OPTIONS} onChange={(v) => applyTextStyle(editor, { style: v })} />
    </div>
  )
}

const FONT_OPTION_LIST: SelectOption<string>[] = [
  { value: FONT_NONE, label: 'Font' },
  ...FONT_OPTIONS.map((f) => ({ value: f.value, label: FONT_LABELS[f.value], fontFamily: f.stack })),
]

/** Font select: every branding `FontId`, rendered in its own typeface, plus a "Font" (no override) sentinel. */
export function TextBarFontSelect({ editor, state }: { editor: Editor; state: TextState }) {
  const value = fontIdFromStack(state.fontFamily) ?? FONT_NONE
  return (
    <div className="w-[130px] shrink-0">
      <Select<string>
        size="xs"
        value={value}
        options={FONT_OPTION_LIST}
        onChange={(v) => applyTextStyle(editor, { fontFamily: v === FONT_NONE ? null : (FONT_OPTIONS.find((f) => f.value === v)?.stack ?? null) })}
      />
    </div>
  )
}

const SIZE_NONE = 'size-none'
const SIZE_OPTION_LIST: SelectOption<string>[] = [
  { value: SIZE_NONE, label: 'Size' },
  ...RICH_TEXT_FONT_SIZES.map((s) => ({ value: `${s}px`, label: String(s) })),
]

/** Size select: every `RICH_TEXT_FONT_SIZES` stop, plus a "Size" (no override) sentinel. */
export function TextBarSizeSelect({ editor, state }: { editor: Editor; state: TextState }) {
  return (
    // `w-16` (64px) truncated the "Size" placeholder to "Si…" behind the
    // chevron (final review Finding 5, `px-2.5` padding + the chevron left
    // only ~26px for text); `w-[72px]` gives it room without disturbing
    // the shared `h-8` control height.
    <div className="w-[72px] shrink-0">
      <Select<string>
        size="xs"
        value={state.fontSize ?? SIZE_NONE}
        options={SIZE_OPTION_LIST}
        onChange={(v) => applyTextStyle(editor, { fontSize: v === SIZE_NONE ? null : v })}
      />
    </div>
  )
}
