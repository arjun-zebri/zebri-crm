/**
 * Pure read/write helpers for the text bar (Proposal Layout v2 Phase 2,
 * spec §4): reading the active TipTap marks/attrs into one plain object
 * a row of controls can render from ({@link readTextState}), writing a
 * control's choice back through TipTap commands in one call
 * ({@link applyTextStyle}), the link href allowlist shared with
 * `model/schema.ts`'s own validator, the font-select sentinel + id/stack
 * round-trip, and the bubble's own keep-open-while-a-popover-has-focus
 * rule.
 *
 * `bubbleShouldShow` is copied rather than imported from the Branding
 * `rich-text.tsx`: `features/proposals/` may only import `@/lib/*`,
 * `@/components/ui/*`, `@/components/editor/*` and `@/types/*` (see
 * `constraints.md`), never `app/`. The two copies are the same one-line
 * rule; if it ever needs to change, both call sites change together.
 *
 * The font-id/stack round-trip lives in `./text-bar-fonts` and the link
 * href allowlist in `./link-popover`, both split out to keep this file
 * near the ~150-line guideline.
 *
 * @module features/proposals/editor/bars/text-bar-style
 */
import type { Editor } from '@tiptap/react'

import type { TextCaseValue } from '../extensions/text-case'

/** The Style select's four choices: a heading level, or the paragraph baseline. */
export type StyleValue = 'paragraph' | 'heading1' | 'heading2' | 'heading3'

/** The `Aa` case select's choices: `'none'` unsets the `textCase` mark entirely. */
export type CaseValue = 'none' | TextCaseValue

/** Every value the text bar's controls need to show their current state, read fresh from `editor` on each render. */
export interface TextState {
  style: StyleValue
  /** The `textStyle` mark's `fontFamily` (a CSS font-stack string, see {@link fontIdFromStack}), or `null` when unset. */
  fontFamily: string | null
  /** The `textStyle` mark's `fontSize` (e.g. `'16px'`), or `null` when unset. */
  fontSize: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  /** The `textStyle` mark's `color`, or `null` when unset. */
  color: string | null
  align: 'left' | 'center' | 'right'
  bulletList: boolean
  orderedList: boolean
  /** The `link` mark's `href` at the selection, or `null` when the selection is not linked. */
  linkHref: string | null
  textCase: CaseValue
}

/** Reads every value the text bar's controls need from `editor`'s current selection. */
export function readTextState(editor: Editor): TextState {
  const textStyle = editor.getAttributes('textStyle') as { color?: string; fontFamily?: string; fontSize?: string }
  const link = editor.getAttributes('link') as { href?: string }
  const textCase = editor.getAttributes('textCase') as { value?: TextCaseValue }

  return {
    style: editor.isActive('heading', { level: 1 })
      ? 'heading1'
      : editor.isActive('heading', { level: 2 })
        ? 'heading2'
        : editor.isActive('heading', { level: 3 })
          ? 'heading3'
          : 'paragraph',
    fontFamily: textStyle.fontFamily ?? null,
    fontSize: textStyle.fontSize ?? null,
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    color: textStyle.color ?? null,
    align: editor.isActive({ textAlign: 'center' }) ? 'center' : editor.isActive({ textAlign: 'right' }) ? 'right' : 'left',
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    linkHref: link.href ?? null,
    textCase: editor.isActive('textCase') ? (textCase.value ?? 'sentence') : 'none',
  }
}

/**
 * One control's write, in the shape {@link readTextState} reads back.
 * Every field is independent: only the fields present are touched, so a
 * control can patch just its own value without knowing the others.
 * `bulletList`/`orderedList` are the one exception: TipTap's list
 * commands are toggle-only (no `setBulletList`/`unsetBulletList`), so
 * {@link applyTextStyle} only calls the toggle when the current state
 * disagrees with the requested one.
 */
export interface TextStylePatch {
  style?: StyleValue
  fontFamily?: string | null
  fontSize?: string | null
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
  align?: 'left' | 'center' | 'right'
  bulletList?: boolean
  orderedList?: boolean
  textCase?: CaseValue
}

/** The heading level for each non-paragraph {@link StyleValue}. */
const HEADING_LEVEL: Record<Exclude<StyleValue, 'paragraph'>, 1 | 2 | 3> = { heading1: 1, heading2: 2, heading3: 3 }

/**
 * Applies `patch` to `editor`'s current selection in one transaction,
 * focusing it first (mirrors every other bar in this module: a bar
 * click must not require re-clicking into the document first).
 */
export function applyTextStyle(editor: Editor, patch: TextStylePatch): void {
  const chain = editor.chain().focus()

  if (patch.style !== undefined) {
    if (patch.style === 'paragraph') chain.setParagraph()
    else chain.setHeading({ level: HEADING_LEVEL[patch.style] })
  }
  if (patch.fontFamily !== undefined) {
    if (patch.fontFamily) chain.setFontFamily(patch.fontFamily)
    else chain.unsetFontFamily()
  }
  if (patch.fontSize !== undefined) {
    if (patch.fontSize) chain.setFontSize(patch.fontSize)
    else chain.unsetFontSize()
  }
  if (patch.bold !== undefined) { if (patch.bold) chain.setBold(); else chain.unsetBold() }
  if (patch.italic !== undefined) { if (patch.italic) chain.setItalic(); else chain.unsetItalic() }
  if (patch.underline !== undefined) { if (patch.underline) chain.setUnderline(); else chain.unsetUnderline() }
  if (patch.strike !== undefined) { if (patch.strike) chain.setStrike(); else chain.unsetStrike() }
  if (patch.color !== undefined) chain.setColor(patch.color)
  if (patch.align !== undefined) chain.setTextAlign(patch.align)
  if (patch.bulletList !== undefined && editor.isActive('bulletList') !== patch.bulletList) chain.toggleBulletList()
  if (patch.orderedList !== undefined && editor.isActive('orderedList') !== patch.orderedList) chain.toggleOrderedList()
  if (patch.textCase !== undefined) {
    if (patch.textCase === 'none') chain.unsetMark('textCase')
    else chain.setMark('textCase', { value: patch.textCase })
  }

  chain.run()
}

/**
 * Whether the bubble should stay visible: a real text selection (not a
 * bare caret, and not a selection that holds only an atom like a
 * variable chip), or focus currently sitting in one of the bar's own
 * popovers (font, size, colour, link, insert, case) so picking from one
 * doesn't dismiss the bar out from under it. Copied from the Branding
 * `rich-text.tsx`'s `bubbleShouldShow`; see the module doc for why this
 * is a copy, not an import.
 */
export function bubbleShouldShow(o: { menuFocused: boolean; hasTextSelection: boolean }): boolean {
  return o.hasTextSelection || o.menuFocused
}

/** Marks the text bar and each of its portalled popovers so {@link bubbleShouldShow}'s `menuFocused` check can tell "focus is in one of my popovers" from "focus left the field". */
export const TEXT_BAR_MENU_ATTR = { 'data-text-bar': '' } as const

/** `TEXT_BAR_MENU_ATTR` as a CSS attribute selector, for the `closest()` check in {@link bubbleShouldShow}'s caller. */
export const TEXT_BAR_MENU_SELECTOR = '[data-text-bar]'

/** The one 32px icon-button look every plain (non-pill) toggle in this bar shares (Italic, Underline, Strike, Link, More), lit when `active`. */
export function toggleButtonClass(active: boolean): string {
  return `inline-flex h-8 w-8 items-center justify-center rounded-control transition ${
    active ? 'bg-surface-emphasis text-text' : 'text-text-muted hover:bg-surface-emphasis hover:text-text'
  }`
}
