/**
 * Server-side render for the branding editor's rich-text fields.
 *
 * Pipeline: stored TipTap JSON -> `generateHTML` with the controlled extension
 * set -> `sanitizeRichHtml` (validate style values, strip anything unexpected)
 * -> `resolveVariablesInHtml` (chips become escaped real values). The result is
 * safe to place with `dangerouslySetInnerHTML` on a public surface.
 *
 * @module lib/branding/render-rich-text
 */
import type { JSONContent } from '@tiptap/core'
import { generateHTML } from '@tiptap/html'

import { resolveVariablesInHtml } from './resolve-variables'
import { RICH_TEXT_EXTENSIONS } from './rich-text-extensions'
import { sanitizeRichHtml } from './rich-text-sanitize'

/** A rich-text field value: TipTap JSON, or null/legacy string during migration. */
export type RichContent = JSONContent | string | null | undefined

/**
 * Render a rich-text field to safe HTML with variables resolved.
 *
 * @param content - The stored field content (TipTap JSON; a plain string is
 *   treated as legacy text and escaped).
 * @param values - Map of variable id to formatted display string
 *   (from `formatVariableValue`); missing ids resolve to empty.
 * @returns Sanitized HTML safe for `dangerouslySetInnerHTML`, or `''` when empty.
 */
export function renderRichText(content: RichContent, values: Record<string, string> = {}): string {
  if (!content) return ''
  // Legacy plain string (pre-migration): escape and return, no marks/variables.
  if (typeof content === 'string') {
    return sanitizeRichHtml(content)
  }
  let html: string
  try {
    html = generateHTML(content, RICH_TEXT_EXTENSIONS)
  } catch {
    // Malformed JSON should never crash a public page.
    return ''
  }
  return resolveVariablesInHtml(sanitizeRichHtml(html), values)
}

/**
 * Render a rich-text field as phrasing content only: the same pipeline as
 * {@link renderRichText}, with the paragraph wrappers removed and paragraph
 * boundaries turned into `<br>`. For fields that live inside an element that
 * cannot hold a `<p>` (a hero `<h1>`), where a nested paragraph is invalid
 * HTML the parser silently restructures.
 *
 * @param content - The stored field content.
 * @param values - Variable id to display string, as for `renderRichText`.
 * @returns Sanitized inline HTML, or `''` when empty.
 */
export function renderRichTextInline(content: RichContent, values: Record<string, string> = {}): string {
  const html = renderRichText(content, values)
  if (!html) return ''
  return html
    // Paragraph boundaries become line breaks: the field is one line of
    // heading text, and separate paragraphs (legacy or pasted) read as lines.
    .replace(/<\/p>\s*<p(?: [^>]*)?>/g, '<br>')
    .replace(/^<p(?: [^>]*)?>/, '')
    .replace(/<\/p>$/, '')
}

/** True if this JSON node subtree carries any real content (text or a chip/image). */
function jsonHasContent(node: JSONContent): boolean {
  if (node.type === 'text') return typeof node.text === 'string' && node.text.trim().length > 0
  if (node.type === 'variable' || node.type === 'image') return true
  return Array.isArray(node.content) && node.content.some(jsonHasContent)
}

/**
 * Whether a rich-text field holds anything worth rendering: visible text, a
 * variable chip, or an image. Unlike a truthiness check, an empty TipTap doc
 * (`{ type: 'doc', content: [{ type: 'paragraph' }] }`) counts as empty even
 * though it is a non-null object; unlike {@link richContentToPlainText}, a
 * heading that is only a `{{ variable }}` counts as non-empty. Used by public
 * renderers to decide whether to render an optional heading / caption at all.
 */
export function richTextHasContent(content: RichContent): boolean {
  if (!content) return false
  if (typeof content === 'string') {
    if (/data-variable|<img|<hr/i.test(content)) return true
    return content.replace(/<[^>]*>/g, '').trim().length > 0
  }
  return jsonHasContent(content)
}

/**
 * Extract plain text from rich content (for `<title>`, alt text, previews,
 * empty-checks). Variables render as their label placeholder is not resolved
 * here; unresolved chips contribute nothing.
 */
export function richContentToPlainText(content: RichContent): string {
  const html = renderRichText(content, {})
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}
