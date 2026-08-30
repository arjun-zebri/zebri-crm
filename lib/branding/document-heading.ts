/**
 * The heading a document actually shows.
 *
 * The Contract header block owns the heading: `blockTemplate('title',
 * 'contract')` ships `title: 'Contract'`, and a per-document title overrides
 * it when set. Resolved here rather than inline so every surface agrees: the
 * public page, the builder preview and the PDF, which builds its own HTML and
 * would otherwise print no heading at all for an untitled contract.
 *
 * @module lib/branding/document-heading
 */

/**
 * The shape this needs from a block. Structural rather than importing
 * `TitleBlock`, because `lib/` stays app-agnostic and every real block tree
 * satisfies it.
 */
interface HeadingBlock {
  type: string
  title?: string | null
}

/**
 * Resolve a document's heading.
 *
 * @param blocks - The surface's branding block tree.
 * @param docTitle - The per-document title, which wins when set.
 * @returns The heading, or an empty string when neither supplies one.
 */
export function documentHeading(
  blocks: readonly HeadingBlock[] | null | undefined,
  docTitle: string | null | undefined,
): string {
  const own = typeof docTitle === 'string' ? docTitle.trim() : ''
  if (own) return own

  const header = blocks?.find((b) => b.type === 'title')
  return typeof header?.title === 'string' ? header.title.trim() : ''
}
