/**
 * "Has this document actually been changed?", for the one decision where
 * the answer has to be right: whether to create a `proposals` row for an
 * editor that was opened on a template's layout
 * (`use-layout-autosave.ts`, the uncreated target).
 *
 * A plain `JSON.stringify` comparison says yes far too often. Mounting
 * the editor rebuilds objects (so key order moves) and lets TipTap repair
 * the document it was handed: StarterKit's `trailingNode`, and this
 * feature's own `TrailingParagraphExtension`, append an empty paragraph
 * wherever a container ends in something you cannot type after. None of
 * that is the MC's work, and the founder's complaint (2026-09-23) is
 * precisely about rows appearing for work nobody did.
 *
 * So the comparison ignores exactly those two things: key order, and
 * trailing empty paragraphs in any container. It is used only to decide
 * whether to write, never to decide what to write, so a document that
 * does get saved is stored exactly as the editor holds it.
 *
 * A consequence worth naming: pressing Enter at the end of a section and
 * leaving does not create a proposal. An empty line is not a document
 * worth minting a couple a copy for.
 *
 * @module features/proposals/editor/layout-equivalence
 */
import type { ProposalLayout } from '../model/layout'

/** True when the value is a TipTap paragraph node carrying nothing at all. */
function isEmptyParagraph(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const { type, content } = node as { type?: unknown; content?: unknown }
  if (type !== 'paragraph') return false
  return content === undefined || (Array.isArray(content) && content.length === 0)
}

/**
 * A stable string for `value`: object keys sorted, and trailing empty
 * paragraphs dropped from every `content` array on the way down (the doc
 * root, a column, a table cell - the extensions repair all three).
 */
function canonical(value: unknown): string {
  return JSON.stringify(normalise(value))
}

/** The recursive half of {@link canonical}. */
function normalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalise)
  if (!value || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source).sort()) {
    const child = source[key]
    if (key === 'content' && Array.isArray(child)) {
      const trimmed = [...child]
      while (trimmed.length > 0 && isEmptyParagraph(trimmed[trimmed.length - 1])) trimmed.pop()
      out[key] = trimmed.map(normalise)
      continue
    }
    out[key] = normalise(child)
  }
  return out
}

/**
 * True when the two layouts are the same document as far as the MC is
 * concerned. See the module doc for what is deliberately ignored.
 */
export function sameDocument(a: ProposalLayout, b: ProposalLayout): boolean {
  return canonical(a) === canonical(b)
}
