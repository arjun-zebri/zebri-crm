/**
 * `normaliseEditorJSON` (spec §2.2, §10): the one place editor output is
 * made safe to validate and store. Runs `toPlainJSON` (drops TipTap's
 * null-prototype `attrs` objects, see `lib/utils`) and then strips any
 * node-level attr whose value is `null`, because the layout schema
 * (`model/schema.ts`) declares optional node attrs with `.optional()`, not
 * `.nullable()` (`image`/`button` in particular): a TipTap `undefined`
 * default that round-tripped through `getJSON()` as `null` would otherwise
 * fail validation for a perfectly ordinary, untouched node.
 *
 * Only `attrs` is touched. `text` and `content` are structural and are
 * never null; `marks` (and each mark's own `attrs`) are left exactly as
 * TipTap produced them, since the mark schemas in `model/schema.ts` are
 * either required or already `.nullable()`.
 *
 * @module features/proposals/editor/extensions/normalise
 */
import type { JSONContent } from '@tiptap/core'

import { toPlainJSON } from '@/lib/utils'

/** Drop every `null`-valued key from a node's `attrs`, recursing into `content`; `marks` is left untouched. */
function stripNullAttrs(node: JSONContent): JSONContent {
  const next: JSONContent = { ...node }
  if (next.attrs) {
    const attrs = Object.fromEntries(Object.entries(next.attrs).filter(([, value]) => value !== null))
    if (Object.keys(attrs).length > 0) next.attrs = attrs
    else delete next.attrs
  }
  if (next.content) next.content = next.content.map(stripNullAttrs)
  return next
}

/**
 * Make raw TipTap `getJSON()` output safe to validate and store: plain
 * objects (via `toPlainJSON`) with every `null` node-level attr dropped.
 *
 * @param json - the editor's `getJSON()` output (or any rich-doc JSON).
 * @returns an equivalent document with null-prototype objects and null attrs removed.
 */
export function normaliseEditorJSON(json: JSONContent): JSONContent {
  return stripNullAttrs(toPlainJSON(json))
}
