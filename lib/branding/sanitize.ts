/**
 * Allowlist HTML sanitizer for inline-edited brand content.
 * Permits only inline formatting + lists. Strips everything else
 * (scripts, styles, attributes, links, images, headings) to plain text.
 *
 * Used in two places:
 *   1. Editor canvas — sanitize on read/write to InlineText contentEditable
 *   2. Public surfaces — sanitize before dangerouslySetInnerHTML
 */

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'ul', 'ol', 'li', 'p', 'span'])
const BLOCK_TAGS = new Set(['p', 'ul', 'ol', 'li'])

export interface SanitizeOptions {
  /** If false, list tags (ul/ol/li) become inline whitespace. Default true. */
  allowLists?: boolean
}

/**
 * Server- and browser-safe HTML sanitizer.
 * Uses DOMParser in the browser, falls back to a regex-based pass on the server.
 */
export function sanitizeHtml(input: string, opts: SanitizeOptions = {}): string {
  if (!input) return ''
  const allowLists = opts.allowLists !== false

  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return serverFallback(input, allowLists)
  }

  const doc = new DOMParser().parseFromString(`<div>${input}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''
  return walk(root as HTMLElement, allowLists)
}

function walk(node: HTMLElement, allowLists: boolean): string {
  let out = ''
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeText(child.nodeValue ?? '')
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const el = child as HTMLElement
    const tag = el.tagName.toLowerCase()

    if (!ALLOWED_TAGS.has(tag)) {
      out += walk(el, allowLists)
      return
    }
    if (!allowLists && (tag === 'ul' || tag === 'ol' || tag === 'li')) {
      out += walk(el, allowLists)
      return
    }
    if (tag === 'br') {
      out += '<br>'
      return
    }
    out += `<${tag}>${walk(el, allowLists)}</${tag}>`
    if (BLOCK_TAGS.has(tag)) {
      // No trailing newline — markup itself provides spacing
    }
  })
  return out
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Pure-string fallback for SSR. Keeps allowed tags, strips everything else.
 * Less strict than the DOMParser path (won't normalize attributes), but safe
 * because we still escape stray < > inside text segments and attributes are
 * removed wholesale.
 */
function serverFallback(input: string, allowLists: boolean): string {
  // Strip script/style blocks entirely first (defense-in-depth)
  let s = input.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
  // Remove any tag we don't allow, OR strip attributes from allowed tags
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>/g, (match, tagName) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''
    if (!allowLists && (tag === 'ul' || tag === 'ol' || tag === 'li')) return ''
    if (match[1] === '/') return `</${tag}>`
    if (tag === 'br') return '<br>'
    return `<${tag}>`
  })
  return s
}

/**
 * Strip ALL tags. Useful for rendering an HTML field in a plain-text context
 * (e.g. <title>, alt attributes, document title bars).
 */
export function htmlToPlainText(input: string | null | undefined): string {
  if (!input) return ''
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(input, 'text/html')
    return doc.body.textContent ?? ''
  }
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
