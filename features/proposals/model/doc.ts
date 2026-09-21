/**
 * Tiny builders for rich-doc JSON, so presets, the v1 migration and tests
 * can write `doc(heading(1, text('Hi')))` instead of nested object
 * literals. Every builder returns plain data (no class instances, no
 * prototypes) so the result is already `toPlainJSON`-safe.
 *
 * @module features/proposals/model/doc
 */
import type { JSONContent } from '@tiptap/core'

/** A TipTap mark as plain JSON (e.g. `{ type: 'bold' }`, `{ type: 'link', attrs: { href } }`). */
export interface MarkJSON { type: string; attrs?: Record<string, unknown> }

/** Build a `doc` root node wrapping the given block content. */
export const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
/** Build a `paragraph` block node wrapping the given inline content. */
export const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
/** Build a `heading` block node at the given level (1-3) wrapping the given inline content. */
export const heading = (level: 1 | 2 | 3, ...content: JSONContent[]): JSONContent => ({ type: 'heading', attrs: { level }, content })
/** Build a `text` inline node, optionally carrying marks (bold, link, ...). */
export const text = (value: string, marks?: MarkJSON[]): JSONContent => (marks && marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value })
/** Build a `variable` inline node referencing a merge-field id (e.g. `couple_name`), with an optional fallback shown when the value is empty. */
export const variable = (id: string, fallback?: string): JSONContent =>
  ({ type: 'variable', attrs: fallback ? { id, fallback } : { id } })
/** Build a `horizontalRule` block node. */
export const hr = (): JSONContent => ({ type: 'horizontalRule' })
/** Build a `spacer` block node of the given height in pixels. */
export const spacer = (heightPx: number): JSONContent => ({ type: 'spacer', attrs: { heightPx } })
/** Build an `embed` block node for an allowlisted external URL (YouTube, Vimeo, ...). */
export const embed = (url: string): JSONContent => ({ type: 'embed', attrs: { url } })

/**
 * Narrowest a table column can be dragged, in px. Shared by the editor's
 * column-resize plugin (`editor/extensions/table.ts`) and the public
 * renderer's `<colgroup>` maths (`render/table-layout.ts`), which must
 * agree on it: prosemirror-tables uses it as the assumed width of any
 * column with no `colwidth` yet when it sums a table's minimum width.
 */
export const TABLE_CELL_MIN_WIDTH = 48

/**
 * Attributes for a `table` node. Column widths are not here: they live on
 * each cell's `colwidth` (prosemirror-tables' own attr, an array of px per
 * spanned column), so the table's width is always the sum of its columns
 * and the editor's column-drag plugin, the width grip and the public
 * renderer all read one source.
 */
export interface TableAttrs {
  /** Minimum height of the whole table in px (rows share the extra space evenly), or `null` for content height. */
  height: number | null
  /** Cell border colour (`#RRGGBB`), or `null` for the default: the text colour at 20%. */
  borderColor: string | null
}

/** Attributes for an `image` node. */
export interface ImageAttrs {
  /** Storage URL of the image. */
  src: string
  /** Alt text for accessibility. */
  alt?: string
  /** Optional caption shown under the image. */
  caption?: string
  /** How the image sits relative to the text column. */
  layout: 'inline' | 'left' | 'right' | 'full'
  /** 20-100, percent of the content column. */
  widthPct: number
}
/** Build an `image` block node from its attributes. */
export const image = (attrs: ImageAttrs): JSONContent => ({ type: 'image', attrs })

/** What a `button` node does when clicked. */
export type ButtonAction =
  | { kind: 'link'; href: string }
  | { kind: 'accept' }
  | { kind: 'decline' }
  | { kind: 'jump'; sectionId: string }
/** Attributes for a `button` node. */
export interface ButtonAttrs {
  /** Visible label text. */
  label: string
  /** What happens on click. */
  action: ButtonAction
  /** Filled or outlined visual style. */
  variant: 'fill' | 'outline'
  /** Button size. */
  size: 'sm' | 'md' | 'lg'
  /** Horizontal alignment within the section. */
  align: 'left' | 'center' | 'right'
  /** Optional override colour (hex). */
  color?: string
  /** Optional corner radius override in pixels. */
  radius?: number
}
/** Build a `button` block node from its attributes. */
export const button = (attrs: ButtonAttrs): JSONContent => ({ type: 'button', attrs })

/** Build a `column` block node holding a fraction (0.1-0.9) of its parent `columns` row. */
export const column = (ratio: number, ...content: JSONContent[]): JSONContent => ({ type: 'column', attrs: { ratio }, content })
/** Build a `columns` block node wrapping 2-3 `column` children. */
export const columns = (...cols: JSONContent[]): JSONContent => ({ type: 'columns', attrs: { count: cols.length }, content: cols })

/**
 * The plain text of a rich doc: text nodes joined in document order,
 * blocks separated by a space, a `variable` chip written as its
 * `{{ id | fallback }}` template token (`lib/branding/template-string.ts`)
 * so the value still resolves once the string reaches a plain-text field.
 * Used wherever a rich field's value must cross into a plain-string
 * boundary - `toPublicOption` (`model/packages.ts`), flattening a
 * package's rich title/description/inclusion text down to the plain
 * `PublicProposalOption` shape a DB-backed proposal also uses.
 */
export function docText(node: JSONContent | null | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'variable') {
    const attrs = (node.attrs ?? {}) as { id?: string; fallback?: string }
    if (!attrs.id) return ''
    return attrs.fallback ? `{{${attrs.id} | ${attrs.fallback}}}` : `{{${attrs.id}}}`
  }
  const parts = (node.content ?? []).map(docText)
  return node.type === 'doc' ? parts.join(' ').replace(/\s+/g, ' ').trim() : parts.join('')
}

/**
 * The plain text of a field that may hold either a rich doc or a legacy
 * plain string (`RichDoc | string`, e.g. a `PackageOption`'s `title`). A
 * thin dispatch in front of {@link docText} so a caller crossing into a
 * plain-string boundary never has to type-check the value itself.
 */
export function plainText(value: JSONContent | string | null | undefined): string {
  return typeof value === 'string' ? value : docText(value)
}
