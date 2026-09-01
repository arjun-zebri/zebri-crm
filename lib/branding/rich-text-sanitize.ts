/**
 * Sanitizer for server-rendered rich-text HTML on public branding surfaces.
 *
 * The rich editor stores TipTap JSON and the server renders it with a controlled
 * extension set, so the *tags* are already constrained. But mark values (colour,
 * font size/family) come from stored JSON that is user-writable
 * (`branding_blocks` jsonb under RLS), so a hand-crafted document could smuggle a
 * CSS injection into a `style` attribute. This is the defence-in-depth boundary:
 * a pure-string, SSR-identical pass that keeps only an allowlist of tags and, on
 * them, only an allowlist of style declarations with validated values, plus
 * variable chips and safe links.
 *
 * @module lib/branding/rich-text-sanitize
 */
import { isKnownVariable } from './document-variables'

/** Tags allowed in rendered rich text, mapped to the attributes they may keep. */
const TAG_ATTRS: Record<string, 'style' | 'variable' | 'link' | 'none'> = {
  p: 'style', h1: 'style', h2: 'style', h3: 'style',
  span: 'variable', // span also keeps validated style (handled below)
  mark: 'style',
  a: 'link',
  strong: 'none', b: 'none', em: 'none', i: 'none', u: 'none', s: 'none',
  ul: 'none', ol: 'none', li: 'none', br: 'none',
  // Couple scripts only: a page break serialises to `<hr data-page-break>`.
  // The attribute is boolean, so it is re-emitted verbatim rather than
  // parsed; a plain `<hr>` from any other source is kept as a bare rule.
  hr: 'none',
}

const SAFE_COLOR = /^#[0-9a-f]{3,8}$|^rgba?\(\s*[\d.,%\s]+\)$/i
const SAFE_FONT_FAMILY = /^[a-z0-9 ,'"\-]+$/i
const SAFE_FONT_SIZE = /^(\d{1,3})px$/
const SAFE_FONT_WEIGHT = /^(normal|bold|[1-9]00)$/
const SAFE_ALIGN = /^(left|center|right|justify)$/
const DECORATION_TOKENS = new Set(['underline', 'line-through', 'overline', 'none'])

/** Validate a single CSS declaration; return the normalised `prop:value` or null. */
function safeDeclaration(prop: string, value: string): string | null {
  const p = prop.trim().toLowerCase()
  const v = value.trim()
  switch (p) {
    case 'color':
    case 'background-color':
      return SAFE_COLOR.test(v) ? `${p}:${v}` : null
    case 'font-family':
      return SAFE_FONT_FAMILY.test(v) && v.length <= 120 ? `${p}:${v}` : null
    case 'font-size': {
      const m = SAFE_FONT_SIZE.exec(v)
      if (!m) return null
      const n = Number(m[1])
      return n >= 8 && n <= 96 ? `${p}:${v}` : null
    }
    case 'font-weight':
      return SAFE_FONT_WEIGHT.test(v) ? `${p}:${v}` : null
    case 'text-decoration':
      return v.split(/\s+/).every((t) => DECORATION_TOKENS.has(t)) ? `${p}:${v}` : null
    case 'text-align':
      return SAFE_ALIGN.test(v) ? `${p}:${v}` : null
    default:
      return null
  }
}

/** Sanitize a `style` attribute value to only validated declarations. */
function safeStyle(style: string): string {
  const decls: string[] = []
  for (const chunk of style.split(';')) {
    const idx = chunk.indexOf(':')
    if (idx === -1) continue
    const ok = safeDeclaration(chunk.slice(0, idx), chunk.slice(idx + 1))
    if (ok) decls.push(ok)
  }
  return decls.join(';')
}

/** Validate an href to a safe scheme. */
function safeHref(href: string): string | null {
  const t = href.trim()
  return /^(https?:\/\/|mailto:|tel:)/i.test(t) && !/["'<>]/.test(t) ? t : null
}

/** Extract an attribute value from a raw attribute string (double or single quoted). */
function attr(raw: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i')
  const m = re.exec(raw)
  if (!m) return null
  return m[2] ?? m[3] ?? ''
}

/** Build the sanitized attribute string for an allowed tag. */
function keepAttrs(tag: string, raw: string): string {
  const kind = TAG_ATTRS[tag]
  const out: string[] = []
  if (tag === 'span') {
    const id = attr(raw, 'data-variable')
    if (id !== null && isKnownVariable(id)) return ` data-variable="${id}"` // chip: no style needed
    const style = attr(raw, 'style')
    if (style) { const s = safeStyle(style); if (s) out.push(`style="${s}"`) }
  } else if (kind === 'style') {
    const style = attr(raw, 'style')
    if (style) { const s = safeStyle(style); if (s) out.push(`style="${s}"`) }
  } else if (kind === 'link') {
    const href = attr(raw, 'href')
    const safe = href ? safeHref(href) : null
    if (safe) out.push(`href="${safe}" rel="noopener nofollow" target="_blank"`)
  }
  return out.length ? ' ' + out.join(' ') : ''
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Sanitize server-rendered rich-text HTML for a public surface. Keeps only
 * allowlisted tags, validated `style` declarations, variable chips with known
 * ids, and safe links; strips everything else while keeping inner text.
 *
 * Pure string transform, identical on server and client (no DOM).
 */
export function sanitizeRichHtml(input: string): string {
  if (!input) return ''
  // Drop dangerous elements including their content.
  const src = input.replace(/<(script|style|iframe|object|embed|svg|math)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, '')

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
    if (!(tag in TAG_ATTRS)) continue // strip disallowed tag, keep its text
    if (tag === 'br') { if (!closing) out += '<br>'; continue }
    if (tag === 'hr') {
      if (!closing) out += /\bdata-page-break\b/i.test(m[3] ?? '') ? '<hr data-page-break="">' : '<hr>'
      continue
    }
    if (closing) {
      const at = stack.lastIndexOf(tag)
      if (at === -1) continue
      while (stack.length > at) out += `</${stack.pop()}>`
    } else {
      out += `<${tag}${keepAttrs(tag, m[3] ?? '')}>`
      stack.push(tag)
    }
  }
  out += escapeText(src.slice(last))
  while (stack.length) out += `</${stack.pop()}>`
  return out
}
