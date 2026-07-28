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
