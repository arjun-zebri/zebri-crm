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
  if (css.color) vars[`--doc-${prefix}-color`] = String(css.color)
}

/**
 * Resolve `branding` (and an optional section-level `textColor` override,
 * mirroring `RichDocContext.textColor`) to the CSS custom properties
 * `EDITOR_PROSE_CLASS` consumes: one group per doc role (heading levels
 * 1-3, fluid on h1 exactly as `render/rich-doc.tsx` does, and body for
 * paragraphs/list items/table cells). Spread onto the element that wraps
 * the editor's ProseMirror node so every descendant selector below
 * resolves.
 */
export function docTypeVars(branding: PublicBranding, textColor?: string | undefined): CSSProperties {
  const inheritColor = !!textColor
  const vars: DocVars = {}
  assignRoleVars(vars, 'h1', roleCss(branding, HEADING_ROLE[1], { fluid: true, inheritColor }))
  assignRoleVars(vars, 'h2', roleCss(branding, HEADING_ROLE[2], { inheritColor }))
  assignRoleVars(vars, 'h3', roleCss(branding, HEADING_ROLE[3], { inheritColor }))
  assignRoleVars(vars, 'body', roleCss(branding, 'body', { inheritColor }))
  // A truthy check (not `??`), matching `render/rich-doc.tsx`'s own rule:
  // an empty-string override must behave like "unset", not a real colour.
  if (textColor) vars['--doc-text-color'] = textColor
  return vars as CSSProperties
}

/**
 * Tailwind classes applied directly to ProseMirror's contenteditable
 * (`editorProps.attributes.class`) so its DOM matches
 * `render/rich-doc.tsx`'s output. One exported constant, never composed
 * per call site, so every section editor renders identically; grouped by
 * concern below, each with a why-comment.
 */
export const EDITOR_PROSE_CLASS = [
  // Bare ProseMirror chrome: no browser focus ring (the section/canvas
  // selection state already shows what is selected), and a min-height so
  // an empty section stays clickable instead of collapsing to 0.
  'outline-none min-h-[1.5em]',

  // Placeholder text: TipTap's Placeholder extension marks the empty
  // first block with `.is-editor-empty` and a `data-placeholder` attr;
  // paint it the same muted colour and float trick `rich-text.tsx`
  // already uses so it never affects layout height.
  '[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:text-text-subtle [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:h-0',

  // Headings: role vars from `docTypeVars` above, one CSS property per
  // role axis, so a branding change (a font swap, a resized heading)
  // recomputes on next render with no editor rebuild. `--doc-text-color`
  // (a section override) wins over the role's own colour when set.
  '[&_h1]:m-0 [&_h1]:mb-4 [&_h1]:[font-family:var(--doc-h1-font)] [&_h1]:[font-size:var(--doc-h1-size)] [&_h1]:[font-weight:var(--doc-h1-weight)] [&_h1]:[line-height:var(--doc-h1-line)] [&_h1]:[letter-spacing:var(--doc-h1-tracking)] [&_h1]:[text-transform:var(--doc-h1-transform)] [&_h1]:[color:var(--doc-text-color,var(--doc-h1-color))]',
  '[&_h2]:m-0 [&_h2]:mb-4 [&_h2]:[font-family:var(--doc-h2-font)] [&_h2]:[font-size:var(--doc-h2-size)] [&_h2]:[font-weight:var(--doc-h2-weight)] [&_h2]:[line-height:var(--doc-h2-line)] [&_h2]:[letter-spacing:var(--doc-h2-tracking)] [&_h2]:[text-transform:var(--doc-h2-transform)] [&_h2]:[color:var(--doc-text-color,var(--doc-h2-color))]',
  '[&_h3]:m-0 [&_h3]:mb-4 [&_h3]:[font-family:var(--doc-h3-font)] [&_h3]:[font-size:var(--doc-h3-size)] [&_h3]:[font-weight:var(--doc-h3-weight)] [&_h3]:[line-height:var(--doc-h3-line)] [&_h3]:[letter-spacing:var(--doc-h3-tracking)] [&_h3]:[text-transform:var(--doc-h3-transform)] [&_h3]:[color:var(--doc-text-color,var(--doc-h3-color))]',

  // Body copy: paragraphs, list items and table cells all read the same
  // body-role vars, matching `renderBlock`'s shared
  // `textStyle(ctx, 'body')` call for every one of those node types.
  '[&_p]:m-0 [&_p]:mb-3 [&_p]:[font-family:var(--doc-body-font)] [&_p]:[font-size:var(--doc-body-size)] [&_p]:[line-height:var(--doc-body-line)] [&_p]:[color:var(--doc-text-color,var(--doc-body-color))]',
  '[&_li]:[font-family:var(--doc-body-font)] [&_li]:[font-size:var(--doc-body-size)] [&_li]:[line-height:var(--doc-body-line)] [&_li]:[color:var(--doc-text-color,var(--doc-body-color))]',
  // `align-top` matches the renderer's `tableCell` class exactly; the
  // renderer's `tableHeader` class does not set it (`th` stays at its UA
  // default `vertical-align: middle`), so it is left off here too.
  '[&_td]:align-top [&_td]:border [&_td]:border-current/20 [&_td]:px-3 [&_td]:py-2 [&_td]:[font-family:var(--doc-body-font)] [&_td]:[font-size:var(--doc-body-size)]',
  '[&_th]:border [&_th]:border-current/20 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:[font-family:var(--doc-body-font)] [&_th]:[font-size:var(--doc-body-size)]',

  // Structural classes shared with `render/rich-doc.tsx` (lists,
  // blockquote, table, rule) so switching between the editor and the
  // read-only preview never shows a layout jump.
  '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-current [&_blockquote]:pl-4 [&_blockquote]:opacity-80',
  // The renderer wraps `<table>` in a `my-4 overflow-x-auto` div so a wide
  // table scrolls instead of blowing out the column; TipTap's TableKit
  // renders a bare `<table>` with no such wrapper (adding one needs a
  // node view, out of this task's scope), so the same two rules are
  // applied to the table element itself. `overflow-x-auto` alone (no
  // `display: block`) keeps the element's table layout/semantics intact.
  '[&_table]:my-4 [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse',
  '[&_hr]:my-6 [&_hr]:border-current/20',

  // Mobile canvas stacking (Task 13, spec 3.6): the renderer's own
  // `max-md:` classes on `columns` rows and floated figures never fire
  // inside the editor, because the mobile canvas narrows via a fixed-width
  // wrapper (`CanvasFrame`'s 380px div), not an actual viewport resize.
  // These rules key off `SectionCanvas`'s own `data-canvas="mobile"`
  // attribute instead, so a columns row and a floated image stack in the
  // editor exactly the way they do on a real phone. `[data-columns]` is
  // the same attribute `ColumnsFrame` (public renderer) and `ColumnsView`
  // (editor node view) both stamp on the columns row itself; `figure` is
  // the bare tag `ImageNode` renders, no attribute needed.
  '[[data-canvas=mobile]_&_[data-columns]]:flex-col',
  '[[data-canvas=mobile]_&_figure]:!w-full [[data-canvas=mobile]_&_figure]:float-none',
].join(' ')
