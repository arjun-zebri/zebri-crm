/**
 * Resolve variable chips in a rendered rich-text HTML string to their real
 * values for the sent document.
 *
 * The rich-text editor stores TipTap JSON; the server renders it to HTML via a
 * controlled extension set (so no arbitrary attributes ever reach the public
 * surface). A variable chip serialises to a self-contained, empty element:
 *
 *   <span data-variable="couple_name"></span>
 *
 * This pure function replaces each such chip with the escaped display value for
 * its id. A missing or unknown id resolves to an empty string, so a real
 * document never shows a raw `{{ … }}` chip. Any marks wrapping the chip (bold,
 * colour, size) are separate tags and are left intact, so the resolved value
 * inherits exactly the formatting the MC applied.
 *
 * @module lib/branding/resolve-variables
 */

/** Matches an empty `<span data-variable="ID">…</span>` chip, capturing the id. */
const CHIP_RE = /<span\b[^>]*\bdata-variable="([^"]*)"[^>]*>\s*<\/span>/gi

/** Escape a resolved value for safe inclusion as HTML text. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Replace every variable chip in `html` with the display value for its id.
 *
 * @param html - Server-rendered rich-text HTML that may contain variable chips.
 * @param values - Map of variable id to already-formatted display string
 *   (use `formatVariableValue` from `document-variables`). Absent/unknown ids
 *   resolve to `''`.
 * @returns The HTML with chips replaced by escaped values.
 */
export function resolveVariablesInHtml(html: string, values: Record<string, string>): string {
  if (!html) return ''
  return html.replace(CHIP_RE, (_match, id: string) => {
    const value = values[id]
    return value ? escapeHtml(value) : ''
  })
}
