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
  /** The `textStyle` mark's `fontWeight` (e.g. `'300'`), or `null` when unset. Independent of `bold`: a presentational weight override, not the semantic emphasis mark. */
  fontWeight: string | null
  /** The `textStyle` mark's `letterSpacing` (e.g. `'0.5px'`), or `null` when unset. */
  letterSpacing: string | null
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
  /** The active paragraph/heading's `lineHeight` (e.g. `'1.4'`), or `null` when unset. A block attribute, not a `textStyle` one - see `extensions/line-height.ts`. */
  lineHeight: string | null
  /** The active paragraph/heading's `topSpacing` (e.g. `'0.5em'`), or `null` when unset. See `extensions/top-spacing.ts`. */
  topSpacing: string | null
}

/** Reads every value the text bar's controls need from `editor`'s current selection. */
export function readTextState(editor: Editor): TextState {
  const textStyle = editor.getAttributes('textStyle') as { color?: string; fontFamily?: string; fontSize?: string; fontWeight?: string; letterSpacing?: string }
  const link = editor.getAttributes('link') as { href?: string }
  const textCase = editor.getAttributes('textCase') as { value?: TextCaseValue }
  const isHeading = editor.isActive('heading')
  // `lineHeight`/`topSpacing` live on whichever block node the selection is
  // actually inside (paragraph or heading), not on both - `getAttributes`
  // for the other one would just return `{}` here, but this is the same
  // "ask the active node" shape `style` above already uses.
  const block = editor.getAttributes(isHeading ? 'heading' : 'paragraph') as { lineHeight?: string; topSpacing?: string }

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
    fontWeight: textStyle.fontWeight ?? null,
    letterSpacing: textStyle.letterSpacing ?? null,
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
    lineHeight: block.lineHeight ?? null,
    topSpacing: block.topSpacing ?? null,
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
  /** `null` unsets the override, matching `fontFamily`/`fontSize` above. */
  fontWeight?: string | null
  /** `null` unsets the override, matching `fontFamily`/`fontSize` above. */
  letterSpacing?: string | null
  /** `null` unsets the override. Written to whichever of `paragraph`/`heading` the selection is in - see {@link applyTextStyle}. */
  lineHeight?: string | null
  /** `null` unsets the override. Written the same way as `lineHeight`. */
  topSpacing?: string | null
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
  // `textAlign` is a hand-rolled node attribute (`extensions/text-align.ts`),
  // not the stock extension's own mark/command - written the same way
  // `lineHeight`/`topSpacing` are below: to whichever of `paragraph`/
  // `heading` the selection is in, the other call a no-op.
  if (patch.align !== undefined) {
    chain.updateAttributes('paragraph', { textAlign: patch.align }).updateAttributes('heading', { textAlign: patch.align })
  }
  if (patch.bulletList !== undefined && editor.isActive('bulletList') !== patch.bulletList) chain.toggleBulletList()
  if (patch.orderedList !== undefined && editor.isActive('orderedList') !== patch.orderedList) chain.toggleOrderedList()
  if (patch.textCase !== undefined) {
    if (patch.textCase === 'none') chain.unsetMark('textCase')
    else chain.setMark('textCase', { value: patch.textCase })
  }
  // `.removeEmptyTextStyle()` after each: unsetting the one `textStyle`
  // attr a run had left behind an empty `<span>` with no styling on it
  // (harmless visually, since `renderHTML` drops falsy attrs, but the
  // same untidy-mark case `unsetFontSize`/`unsetFontFamily`'s own
  // `removeEmptyTextStyle` call exists to avoid). A no-op when the run
  // still carries other `textStyle` attrs (colour, font, size).
  if (patch.fontWeight !== undefined) chain.setMark('textStyle', { fontWeight: patch.fontWeight }).removeEmptyTextStyle()
  if (patch.letterSpacing !== undefined) chain.setMark('textStyle', { letterSpacing: patch.letterSpacing }).removeEmptyTextStyle()
  // `lineHeight`/`topSpacing` are block attributes, not `textStyle` mark
  // attributes: `updateAttributes` only touches a node that's actually of
  // the given type within the selection, so calling it for both
  // `paragraph` and `heading` is safe even though only one is ever active
  // at once - the other call is simply a no-op.
  if (patch.lineHeight !== undefined) {
    chain.updateAttributes('paragraph', { lineHeight: patch.lineHeight }).updateAttributes('heading', { lineHeight: patch.lineHeight })
  }
  if (patch.topSpacing !== undefined) {
    chain.updateAttributes('paragraph', { topSpacing: patch.topSpacing }).updateAttributes('heading', { topSpacing: patch.topSpacing })
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
