/**
 * Allowlist HTML sanitizer for inline-edited brand content.
 * Permits only inline formatting + lists. Strips everything else
 * (scripts, styles, attributes, links, images, headings) to plain text.
 *
 * Used in two places:
 *   1. Editor canvas - sanitize on read/write to InlineText contentEditable
 *   2. Public surfaces - sanitize before dangerouslySetInnerHTML
 */

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'ul', 'ol', 'li', 'p', 'span'])

export interface SanitizeOptions {
  /** If false, list tags (ul/ol/li) become inline whitespace. Default true. */
  allowLists?: boolean
}

/**
 * Server- and browser-identical HTML sanitizer.
 *
 * A single pure-string tokenizer runs in both environments so the SSR pass
 * and client hydration produce byte-identical markup. Allowed tags keep no
 * attributes; disallowed tags are stripped but their text kept; unbalanced
 * tags are closed via an open-tag stack; stray angle brackets are escaped.
 */
export function sanitizeHtml(input: string, opts: SanitizeOptions = {}): string {
  if (!input) return ''
  const allowLists = opts.allowLists !== false

  // Defense in depth: drop script-ish elements INCLUDING their content.
  const src = input.replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')

  const allowed = (tag: string) =>
    ALLOWED_TAGS.has(tag) && (allowLists || (tag !== 'ul' && tag !== 'ol' && tag !== 'li'))

  let out = ''
  const stack: string[] = []
  const tagRe = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(src)) !== null) {
    out += escapeText(src.slice(last, m.index))
    last = tagRe.lastIndex
    const closing = m[1] === '/'
    const tag = (m[2] ?? '').toLowerCase()
    if (!allowed(tag)) continue // strip tag, keep surrounding text
    if (tag === 'br') {
      if (!closing) out += '<br>'
      continue
    }
    if (closing) {
      // Close intermediate open tags so nesting stays well-formed, then
      // drop orphan closers that never opened.
      const at = stack.lastIndexOf(tag)
      if (at === -1) continue
      while (stack.length > at) out += `</${stack.pop()}>`
    } else {
      out += `<${tag}>`
      stack.push(tag)
    }
  }
  out += escapeText(src.slice(last))
  while (stack.length) out += `</${stack.pop()}>`
  return out
}

/**
 * Escape text content for safe inclusion in HTML.
 *
 * Converts &, <, and > to their entity equivalents.
 */
function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Strip ALL tags. Useful for rendering an HTML field in a plain-text context
 * (e.g. <title>, alt attributes, document title bars).
 */
export function htmlToPlainText(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}
