/**
 * `{{ id | fallback }}` merge syntax for the plain-string fields a rich
 * doc cannot cover: a rich-text button node's label, the accept section's
 * button, the packages CTA. Rich text carries real `variable` chips with
 * a `fallback` attr (`rich-text-extensions.ts`); a plain string has no
 * node to hang that on, so the same two pieces of information travel as
 * text instead, resolved against the same `values` map the chips use.
 * Pure: shared by the public renderers (`lib/branding/public-blocks`) and
 * the proposal feature's own renderer.
 *
 * @module lib/branding/template-string
 */

/** `{{ id }}` or `{{ id | fallback }}`: id is a variable id, fallback any text up to the closing braces. */
const TOKEN_RE = /\{\{\s*([a-z0-9_]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/gi

/**
 * Replace every `{{ id | fallback }}` token in `s` with `values[id]`, else
 * the fallback, else nothing. Unknown ids behave like empty values.
 */
export function resolveTemplateString(s: string, values: Record<string, string>): string {
  if (!s || !s.includes('{{')) return s
  return s.replace(TOKEN_RE, (_m, id: string, fallback?: string) => values[id] || fallback || '')
}

/**
 * Insert a `{{id}}` token into `value` at `caret` (an `<input>`'s
 * `selectionStart`), padding with a space on whichever side touches a
 * non-space character so the token never fuses with a word. Returns the
 * new string and where the caret should land after it.
 */
export function insertTemplateToken(value: string, caret: number, id: string): { value: string; caret: number } {
  const at = Math.max(0, Math.min(caret, value.length))
  const before = value.slice(0, at)
  const after = value.slice(at)
  const lead = before && !/\s$/.test(before) ? ' ' : ''
  const trail = after && !/^\s/.test(after) ? ' ' : ''
  const core = `{{${id}}}`
  // The caret lands right after the token, before any padding space.
  return { value: before + lead + core + trail + after, caret: before.length + lead.length + core.length }
}
