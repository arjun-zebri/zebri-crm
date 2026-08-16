/**
 * Plain mustache text ↔ a TipTap doc carrying mention nodes.
 *
 * Two things in the builder store a variable-bearing string rather
 * than a rich document — an automation's note text, and every email
 * body saved before the composer existed — but the editor that writes
 * them only understands **mention nodes**: they are what renders as a
 * green chip and what `renderEmailTemplate` resolves. Text in braces
 * is inert, so it would be shown as literal `{{…}}` and mailed that
 * way.
 *
 * These two functions are the bridge, and they round-trip: the token
 * a mention carries is the same expression the text held, filter and
 * all (`event.date | friendly`).
 *
 * @module lib/automations/mustache-doc
 */

/** Structural view of a TipTap node — enough to read and build one. */
export interface DocNode {
  type?: string
  text?: string
  attrs?: { id?: string | undefined }
  content?: DocNode[]
}

/** An empty doc: an editor needs a paragraph to put a caret in. */
export const EMPTY_DOC: DocNode = { type: 'doc', content: [{ type: 'paragraph' }] }

/**
 * Split one line into text and mention nodes.
 *
 * Non-greedy, so two variables on one line don't swallow the text
 * between them.
 */
function lineToInline(line: string): DocNode[] {
  const nodes: DocNode[] = []
  let cursor = 0
  const pattern = /\{\{\s*(.+?)\s*\}\}/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > cursor) {
      nodes.push({ type: 'text', text: line.slice(cursor, match.index) })
    }
    // `match[1]` is the captured group of a match that just
    // succeeded, so it is always present; the guard is for
    // noUncheckedIndexedAccess.
    nodes.push({ type: 'mention', attrs: { id: match[1] ?? '' } })
    cursor = match.index + match[0].length
  }
  if (cursor < line.length) nodes.push({ type: 'text', text: line.slice(cursor) })
  return nodes
}

/**
 * Lift a mustache string into a document, one paragraph per line.
 *
 * @param text - e.g. `Hi {{couple.name}},`
 */
export function textToDoc(text: string): DocNode {
  if (!text) return EMPTY_DOC
  return {
    type: 'doc',
    content: text.split('\n').map((line) => {
      const inline = lineToInline(line)
      return { type: 'paragraph', ...(inline.length ? { content: inline } : {}) }
    }),
  }
}

/**
 * Flatten a document back to a mustache string.
 *
 * Block-level nodes become lines; a mention becomes its `{{token}}`.
 * A mention that lost its `attrs.id` is dropped rather than written
 * as `{{undefined}}`, which is what a corrupted node would otherwise
 * put in front of a couple.
 */
export function docToText(doc: DocNode | null | undefined): string {
  if (!doc?.content) return ''
  const inline = (node: DocNode): string => {
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'mention') {
      const id = node.attrs?.id
      return id ? `{{${id}}}` : ''
    }
    if (node.type === 'hardBreak') return '\n'
    return (node.content ?? []).map(inline).join('')
  }
  return doc.content
    .map((block) => (block.content ?? []).map(inline).join(''))
    .join('\n')
    .trim()
}
