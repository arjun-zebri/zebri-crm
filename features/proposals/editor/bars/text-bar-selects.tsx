'use client'

/**
 * The text bar's Style and Font selects and its Size stepper: the row's
 * three value controls, grouped into one file since none needs more
 * than a few lines around the shared `components/editor` primitives.
 *
 * Style and Font both preview their choices in the open list (a heading
 * row is drawn heading-sized, a font row in its own typeface) so the
 * user picks by look rather than by name; the closed trigger stays a
 * plain label so it fits the 32px row. Size is a `NumberStepper`, not a
 * list of stops: the founder ruled that a size is a number you nudge
 * with arrows, and it seeds from the current block's theme default (Global
 * style) so the first click nudges from what is already on screen, and
 * tracks a Global style edit even while the selection stays put.
 *
 * @module features/proposals/editor/bars/text-bar-selects
 */
import type { Editor } from '@tiptap/react'

import { NumberStepper, Select, type SelectOption } from '@/components/editor'
import { FONT_LABELS } from '@/lib/branding/fonts'

import type { ProposalTheme } from '../../model/theme'

import { FONT_NONE, FONT_OPTIONS, fontIdFromStack } from './text-bar-fonts'
import { applyTextStyle, TEXT_BAR_MENU_ATTR, type StyleValue, type TextState } from './text-bar-style'

/** The Style select's options, in the order the bar shows them. */
const STYLE_OPTIONS: SelectOption<StyleValue>[] = [
  { value: 'heading1', label: 'Heading 1' },
  { value: 'heading2', label: 'Heading 2' },
  { value: 'heading3', label: 'Heading 3' },
  { value: 'paragraph', label: 'Paragraph' },
]

/** How each Style row previews itself in the open list: the design system's three type sizes, largest for Heading 1. */
const STYLE_PREVIEW_CLASS: Record<StyleValue, string> = {
  heading1: 'text-display font-semibold',
  heading2: 'text-section font-semibold',
  heading3: 'text-body font-semibold',
  paragraph: 'text-body',
}

/** Style select: Heading 1 / Heading 2 / Heading 3 / Paragraph, each row previewed at its own weight and size. */
export function TextBarStyleSelect({ editor, state }: { editor: Editor; state: TextState }) {
  return (
    <div className="w-[108px] shrink-0">
      <Select<StyleValue>
        size="xs"
        value={state.style}
        options={STYLE_OPTIONS}
        renderOption={(o) => <span className={STYLE_PREVIEW_CLASS[o.value]}>{o.label}</span>}
        onChange={(v) => applyTextStyle(editor, { style: v })}
        contentProps={TEXT_BAR_MENU_ATTR}
      />
    </div>
  )
}

const FONT_OPTION_LIST: SelectOption<string>[] = [
  { value: FONT_NONE, label: 'Font' },
  ...FONT_OPTIONS.map((f) => ({ value: f.value, label: FONT_LABELS[f.value], fontFamily: f.stack })),
]

/** Font select: every branding `FontId`, rendered in its own typeface (`SelectOption.fontFamily`; the faces are loaded by `use-brand-fonts.ts`), seeded from the theme's current font for the selection's role until an override is set. */
export function TextBarFontSelect({ editor, state, theme }: { editor: Editor; state: TextState; theme: ProposalTheme }) {
  const value = fontIdFromStack(state.fontFamily) ?? theme.text[state.style].font
  return (
    <div className="w-[130px] shrink-0">
      <Select<string>
        size="xs"
        value={value}
        options={FONT_OPTION_LIST}
        onChange={(v) => applyTextStyle(editor, { fontFamily: v === FONT_NONE ? null : (FONT_OPTIONS.find((f) => f.value === v)?.stack ?? null) })}
        contentProps={TEXT_BAR_MENU_ATTR}
      />
    </div>
  )
}

/** Font-size bounds for the stepper: below 8px is unreadable, above 120px outgrows every section width the canvas offers. */
const SIZE_MIN = 8
const SIZE_MAX = 120

/** Size stepper: the selection's `fontSize` override in px, seeded from the theme's current style for the selection's role (`StyleValue` and `ThemeTextRole` share the same four values) until one is set. */
export function TextBarSizeStepper({ editor, state, theme }: { editor: Editor; state: TextState; theme: ProposalTheme }) {
  const seed = theme.text[state.style].size
  const value = state.fontSize !== null ? Math.round(parseFloat(state.fontSize)) : Math.round(seed)
  return (
    <NumberStepper
      value={value}
      min={SIZE_MIN}
      max={SIZE_MAX}
      step={1}
      ariaLabel="Size"
      onChange={(v) => applyTextStyle(editor, { fontSize: `${v}px` })}
    />
  )
}
