/**
 * Editor DOM styling: the Tailwind class ProseMirror's contenteditable
 * gets, and the per-role CSS custom properties that back it. TipTap
 * renders headings and paragraphs as plain DOM nodes (no React), so the
 * brand type roles `render/rich-doc.tsx` applies as inline `style` per
 * React node (`render/text-roles.ts`) reach the editor's DOM a different
 * way: `docTypeVars` resolves them once, as CSS custom properties on an
 * ancestor of the ProseMirror element, and `EDITOR_PROSE_CLASS` reads
 * them back with descendant selectors, so the editor's headings and body
 * copy match the public page without a node view per text node.
 *
 * @module features/proposals/editor/editor-styles
 */
import type { CSSProperties } from 'react'

import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ProposalTheme } from '../model/theme'
import { HEADING_ROLE, roleCss } from '../render/text-roles'

/** The `--doc-<prefix>-*` custom properties `EDITOR_PROSE_CLASS` reads, as plain string values. */
type DocVars = Record<string, string>

// One role's resolved CSSProperties (font, size, weight, line-height,
// tracking, transform, colour) flattened into `--doc-<prefix>-*`
// variables. `roleCss` already supplies units (px, em); this only renames
// the keys, it never re-derives a value.
function assignRoleVars(vars: DocVars, prefix: string, css: CSSProperties): void {
  vars[`--doc-${prefix}-font`] = String(css.fontFamily)
  vars[`--doc-${prefix}-size`] = String(css.fontSize)
  vars[`--doc-${prefix}-weight`] = String(css.fontWeight)
  vars[`--doc-${prefix}-line`] = String(css.lineHeight)
  vars[`--doc-${prefix}-tracking`] = String(css.letterSpacing)
  vars[`--doc-${prefix}-transform`] = String(css.textTransform ?? 'none')
  vars[`--doc-${prefix}-align`] = String(css.textAlign ?? 'left')
  if (css.color) vars[`--doc-${prefix}-color`] = String(css.color)
}

/**
 * Resolve `branding` (and an optional section-level `textColor` override,
 * mirroring `RichDocContext.textColor`) to the CSS custom properties
 * `EDITOR_PROSE_CLASS` consumes: one group per doc role (heading levels
 * 1-3 and body for paragraphs/list items/table cells; sizes arrive
 * already fluid from `roleCss`, exactly as `render/rich-doc.tsx` gets
 * them, and the `cqw` inside a var resolves at the element that reads
 * it, so the mobile canvas shrinks them the same way). Spread onto the element that wraps
 * the editor's ProseMirror node so every descendant selector below
 * resolves.
 */
export function docTypeVars(branding: PublicBranding, theme: ProposalTheme, textColor?: string | undefined, align?: string | undefined): CSSProperties {
  const inheritColor = !!textColor
  const vars: DocVars = {}
  assignRoleVars(vars, 'h1', roleCss(branding, HEADING_ROLE[1], { inheritColor, theme }))
  assignRoleVars(vars, 'h2', roleCss(branding, HEADING_ROLE[2], { inheritColor, theme }))
  assignRoleVars(vars, 'h3', roleCss(branding, HEADING_ROLE[3], { inheritColor, theme }))
  assignRoleVars(vars, 'body', roleCss(branding, 'body', { inheritColor, theme }))
  // A truthy check (not `??`), matching `render/rich-doc.tsx`'s own rule:
  // an empty-string override must behave like "unset", not a real colour.
  if (textColor) vars['--doc-text-color'] = textColor
  // Same precedence as `render/rich-doc.tsx`'s `textStyle`: a section's own
  // alignment beats the theme role's, and a node's `textAlign` attr (an
  // inline style TipTap writes) beats both.
  if (align) vars['--doc-text-align'] = align
  return vars as CSSProperties
}

/**
 * Tailwind classes applied directly to ProseMirror's contenteditable
 * (`editorProps.attributes.class`) so its DOM matches
 * `render/rich-doc.tsx`'s output. One exported constant, never composed
 * per call site, so every section editor renders identically; grouped by
 * concern below, each with a why-comment.
 */
const PROSE_RULES = [
  // Bare ProseMirror chrome: no browser focus ring (the section/canvas
  // selection state already shows what is selected).
  'outline-none',

  // Placeholder text: TipTap's Placeholder extension marks the empty
  // block holding the caret with `.is-empty` and a `data-placeholder`
  // attr (and, when the whole doc is empty, `.is-editor-empty` on the
  // first block too). Keyed on `.is-empty`, not `.is-editor-empty`, so
  // the "Type / to add content" hint follows the caret onto any empty
  // line, the way Qwilr's does, not just an empty section. Same float
  // trick `rich-text.tsx` already uses so it never affects layout
  // height. Coloured the same way as real paragraph text below
  // (`--doc-text-color` first, the role default otherwise) rather than a
  // flat muted token: on a dark-filled section (the default hero) a fixed
  // muted grey read as barely-there, disabled text with no contrast
  // against the fill (UX audit §3.10) - this way an empty block's
  // placeholder always sits in the section's own text colour.
  '[&_.is-empty::before]:content-[attr(data-placeholder)] [&_.is-empty::before]:[color:var(--doc-text-color,var(--doc-body-color))] [&_.is-empty::before]:opacity-60 [&_.is-empty::before]:float-left [&_.is-empty::before]:pointer-events-none [&_.is-empty::before]:h-0',
  // A floated placeholder ignores `text-align`, so in a centred or
  // right-aligned section (the content column stamps `data-align`,
  // `render/section.tsx` / `content-section-frame.tsx`) it is rendered
  // inline instead and follows the text. The trade-off is the caret: it
  // then sits after the placeholder text rather than before it, which is
  // the lesser evil against a "centred" field whose hint hugs the left.
  '[[data-align=center]_&_.is-empty::before]:float-none [[data-align=center]_&_.is-empty::before]:h-auto',
  '[[data-align=right]_&_.is-empty::before]:float-none [[data-align=right]_&_.is-empty::before]:h-auto',

  // Headings: role vars from `docTypeVars` above, one CSS property per
  // role axis, so a branding change (a font swap, a resized heading)
  // recomputes on next render with no editor rebuild. `--doc-text-color`
  // (a section override) wins over the role's own colour when set.
  '[&_h1]:m-0 [&_h1]:mb-4 [&_h1]:[font-family:var(--doc-h1-font)] [&_h1]:[font-size:var(--doc-h1-size)] [&_h1]:[font-weight:var(--doc-h1-weight)] [&_h1]:[line-height:var(--doc-h1-line)] [&_h1]:[letter-spacing:var(--doc-h1-tracking)] [&_h1]:[text-transform:var(--doc-h1-transform)] [&_h1]:[color:var(--doc-text-color,var(--doc-h1-color))] [&_h1]:[text-align:var(--doc-text-align,var(--doc-h1-align))]',
  '[&_h2]:m-0 [&_h2]:mb-4 [&_h2]:[font-family:var(--doc-h2-font)] [&_h2]:[font-size:var(--doc-h2-size)] [&_h2]:[font-weight:var(--doc-h2-weight)] [&_h2]:[line-height:var(--doc-h2-line)] [&_h2]:[letter-spacing:var(--doc-h2-tracking)] [&_h2]:[text-transform:var(--doc-h2-transform)] [&_h2]:[color:var(--doc-text-color,var(--doc-h2-color))] [&_h2]:[text-align:var(--doc-text-align,var(--doc-h2-align))]',
  '[&_h3]:m-0 [&_h3]:mb-4 [&_h3]:[font-family:var(--doc-h3-font)] [&_h3]:[font-size:var(--doc-h3-size)] [&_h3]:[font-weight:var(--doc-h3-weight)] [&_h3]:[line-height:var(--doc-h3-line)] [&_h3]:[letter-spacing:var(--doc-h3-tracking)] [&_h3]:[text-transform:var(--doc-h3-transform)] [&_h3]:[color:var(--doc-text-color,var(--doc-h3-color))] [&_h3]:[text-align:var(--doc-text-align,var(--doc-h3-align))]',

  // Body copy: paragraphs, list items and table cells all read the same
  // body-role vars, matching `renderBlock`'s shared
  // `textStyle(ctx, 'body')` call for every one of those node types.
  '[&_p]:m-0 [&_p]:[font-family:var(--doc-body-font)] [&_p]:[font-size:var(--doc-body-size)] [&_p]:[line-height:var(--doc-body-line)] [&_p]:[color:var(--doc-text-color,var(--doc-body-color))] [&_p]:[text-align:var(--doc-text-align,var(--doc-body-align))]',
  '[&_li]:[font-family:var(--doc-body-font)] [&_li]:[font-size:var(--doc-body-size)] [&_li]:[line-height:var(--doc-body-line)] [&_li]:[color:var(--doc-text-color,var(--doc-body-color))]',
  // A bullet/number only ever inherits from its own `<li>`, never from a
  // `<strong>` inside it, so bolding a list item's text left its marker at
  // the regular weight - the two read as mismatched. `:has()` looks at the
  // item's first block's first inline (one level of mark nesting covered,
  // for bold wrapped in a `textStyle` mark's own `<span>`), matching the
  // same fix already shipped for `.contract-content` in `globals.css`.
  '[&_li:has(>p>strong:first-child)]:marker:font-bold [&_li:has(>p>span:first-child>strong:first-child)]:marker:font-bold',
  // `align-top` matches the renderer's `tableCell` class exactly; the
  // renderer's `tableHeader` class does not set it (`th` stays at its UA
  // default `vertical-align: middle`), so it is left off here too.
  // `relative` on every cell anchors prosemirror-tables' column-resize
  // handle and the cell-selection tint (both absolutely positioned inside
  // the cell, see the table rules below).
  // Border colour: the table's `--table-border` (`extensions/table.ts`
  // sets it from the node's `borderColor`), else the text colour at 20%,
  // the same fallback `render/rich-doc.tsx`'s cells use.
  '[&_td]:relative [&_td]:align-top [&_td]:border [&_td]:[border-color:var(--table-border,color-mix(in_oklab,currentColor_20%,transparent))] [&_td]:px-3 [&_td]:py-2 [&_td]:[font-family:var(--doc-body-font)] [&_td]:[font-size:var(--doc-body-size)]',
  '[&_th]:relative [&_th]:border [&_th]:[border-color:var(--table-border,color-mix(in_oklab,currentColor_20%,transparent))] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:[font-family:var(--doc-body-font)] [&_th]:[font-size:var(--doc-body-size)]',

  // Structural classes shared with `render/rich-doc.tsx` (lists,
  // blockquote, table, rule) so switching between the editor and the
  // read-only preview never shows a layout jump.
  '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-current [&_blockquote]:pl-4 [&_blockquote]:opacity-80',
  // Tables: prosemirror-tables' `TableView` (`extensions/table.ts`) wraps
  // each `<table>` in `div.tableWrapper`, the same `my-4 overflow-x-auto`
  // box `render/table-node.tsx` draws, so a table dragged wider than the
  // column scrolls inside it. `table-fixed` is the fix for typing into a
  // cell re-flowing every other column: under fixed layout only the row
  // height reacts to content, and the column widths come from the
  // `<colgroup>` the view keeps in sync with each cell's `colwidth`
  // (`w-full` is the fluid default a table with no widths yet falls back
  // to; the view's own inline width wins once every column is sized).
  '[&_.tableWrapper]:my-4 [&_.tableWrapper]:overflow-x-auto',
  '[&_table]:m-0 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse',
  // The column-resize affordance and the drag-across-cells tint, both
  // prosemirror-tables classes: the handle is a 4px bar on the cell's
  // right edge shown while the pointer is within `handleWidth` of it, and
  // `resize-cursor` lands on the editor root itself for the duration.
  '[&_.column-resize-handle]:pointer-events-none [&_.column-resize-handle]:absolute [&_.column-resize-handle]:-right-0.5 [&_.column-resize-handle]:inset-y-0 [&_.column-resize-handle]:w-1 [&_.column-resize-handle]:bg-brand-fg',
  '[&.resize-cursor]:cursor-col-resize',
  // A fully sized table (every column with a `colwidth`) fits a
  // phone-width canvas with each column's percentage share, the same
  // `@container/doc` rule as `render/table-node.tsx` (the mobile canvas is
  // a 380px column in a desktop window, so a viewport query never fires
  // there); `!` beats the inline px widths prosemirror-tables writes.
  // `--col-pct` is stamped on each `<col>` by `ProposalTableView`
  // (`extensions/table.ts`); a fluid table has none, which leaves `width`
  // invalid at computed-value time, i.e. auto, so it is untouched.
  // `!min-w-0` matches `render/table-node.tsx`: a not-fully-sized table's
  // inline `min-width` (prosemirror-tables' own `updateColumns`, the
  // desktop px sum) otherwise wins over `!w-full` regardless of
  // specificity, since a browser resolves `min-width` before `width`.
  '@max-3xl/doc:[&_table]:!w-full @max-3xl/doc:[&_table]:!min-w-0 @max-3xl/doc:[&_col]:![width:var(--col-pct)]',
  "[&_.selectedCell]:after:pointer-events-none [&_.selectedCell]:after:absolute [&_.selectedCell]:after:inset-0 [&_.selectedCell]:after:bg-brand-fg/10 [&_.selectedCell]:after:content-['']",
  '[&_hr]:my-6 [&_hr]:border-current/20',

  // Mobile canvas stacking (Task 13, spec 3.6): the renderer's own
  // `max-md:` class on a floated figure never fires inside the editor,
  // because the mobile canvas narrows via a fixed-width wrapper
  // (`CanvasFrame`'s 380px div), not an actual viewport resize. This rule
  // keys off `SectionCanvas`'s own `data-canvas="mobile"` attribute
  // instead, so a floated image stacks in the editor exactly the way it
  // does on a real phone. `figure` is the bare tag `ImageNode` renders, no
  // attribute needed.
  // (A `columns` row had the identical bug and the identical
  // `data-canvas=mobile` workaround here until 2026-09-19, when it moved
  // onto the same `@max-3xl/doc:` container query `ColumnsFrame`'s public
  // render and `render/table-node.tsx`'s table already used - the
  // container reflects the canvas's simulated width directly, so this
  // wrapper-attribute workaround was no longer needed for it.)
  '[[data-canvas=mobile]_&_figure]:!w-full [[data-canvas=mobile]_&_figure]:float-none',
]

/**
 * Paragraph rhythm for a content section (matches `render/rich-doc.tsx`).
 * Kept apart from `PROSE_RULES` so the data-field variant below can leave
 * it out: a Tailwind `[&_p]:m-0` on a caller cannot beat this `mb-3`
 * (same specificity, later in the sheet), which is how every inline field
 * in a card grew 12px of bottom margin (live check, packages cards).
 */
const PARAGRAPH_SPACING = '[&_p]:mb-3'

/**
 * The full prose class for a content section's editor: the rules above,
 * paragraph spacing, and a min-height so an empty section stays
 * clickable instead of collapsing to 0.
 */
export const EDITOR_PROSE_CLASS = [...PROSE_RULES, PARAGRAPH_SPACING, 'min-h-[1.5em]'].join(' ')

/**
 * The prose class for a data section's `InlineField`: everything above
 * except paragraph spacing, which the field's wrapper (an `<h3>`, a card
 * row, an FAQ answer's own `[&_p]:mb-2`) decides, and the min-height,
 * which made a 20px card title 30px tall (an empty paragraph already
 * holds one line box, so a field never collapses).
 */
export const EDITOR_FIELD_PROSE_CLASS = PROSE_RULES.join(' ')
