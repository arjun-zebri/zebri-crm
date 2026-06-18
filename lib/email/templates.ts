/**
 * Email-template rendering + the missing-variable detector.
 *
 * An email template has two parts:
 *   - `subject` — a lightweight mustache string (`{{ couple.name }}`).
 *   - `content` — a TipTap JSON body whose mention nodes carry a
 *     namespaced variable key in `attrs.id` (e.g. `couple.primary_name`,
 *     `event.date | friendly`).
 *
 * Both resolve through the SAME atom the automation engine uses
 * ({@link resolveVariable} in `lib/automations/variables`), so a
 * template renders identically whether it's fired by an automation or
 * sent manually.
 *
 * The defining rule of this feature: **an email must never go out with
 * an unfilled variable.** Where the contracts renderer silently prints
 * a literal `{{token}}`, this module instead records every unresolved
 * variable so the caller can block the send (automations) or warn +
 * gate it behind an explicit "Send anyway" (manual). A variable counts
 * as resolved when its expression yields a non-empty string — a
 * `default:` filter therefore resolves it.
 *
 * Pure module: no I/O, no React, no Supabase. The {@link RunContext}
 * is pre-resolved by the caller.
 *
 * @module lib/email/templates
 */

import Mention from '@tiptap/extension-mention'
import { generateHTML } from '@tiptap/html'
import type { JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import sanitizeHtml from 'sanitize-html'

import { extractTokens, resolveVariable, variableLabel } from '@/lib/automations/variables'
import type { RunContext } from '@/types/automations'

/** How a template should be rendered. */
export type RenderMode =
  /** Inline-highlight unresolved variables (editor / compose preview). */
  | 'preview'
  /** Drop unresolved variables to empty (the actual outgoing email). */
  | 'send'

/** Result of rendering a template body. */
export interface EmailRenderResult {
  /** Sanitised HTML, ready for the email shell or the preview pane. */
  html: string
  /**
   * Distinct unresolved variable paths in the body (e.g.
   * `couple.primary_name`). Empty means the body is fully filled.
   */
  unresolved: string[]
}

/** A template's renderable parts. */
export interface EmailTemplateInput {
  subject: string
  content: JSONContent
}

/**
 * Temporary, per-send fills for missing variables, keyed by base
 * variable path (e.g. `couple.spouse_name`). Used by the manual
 * compose flow so an MC can fill a gap for one email without writing
 * back to the couple. A non-empty override resolves its variable.
 */
export type VariableOverrides = Record<string, string>

/** Outcome of the missing-variable check across subject + body. */
export interface MissingVariableResult {
  /** Distinct unresolved variable paths across subject and body. */
  missing: string[]
  /** True when anything is unresolved — i.e. the send must be gated. */
  blocked: boolean
  /** Human-readable summary, e.g. `Missing: Primary contact, Event date`. */
  message?: string
}

// Private-use sentinels wrap a missing variable's label during
// substitution, then get swapped for a highlight span AFTER sanitising
// (so the injected markup survives the sanitiser). They never collide
// with real content.
const MISSING_OPEN = '\uE000'
const MISSING_CLOSE = '\uE001'

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
    'strong', 'em', 'u', 's', 'br', 'a', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'span',
  ],
  allowedAttributes: { '*': ['href', 'target', 'rel', 'class'] },
  // Keep our sentinels out of sanitiser entity-escaping by leaving
  // text alone; they're plain private-use chars, not markup.
  textFilter: (text) => text,
}

/**
 * Render an email template body (TipTap JSON) against a context.
 *
 * Returns the sanitised HTML plus the list of unresolved variables.
 * In `preview` mode unresolved variables become a highlighted label
 * span; in `send` mode they collapse to empty.
 */
export function renderEmailTemplate(
  content: JSONContent,
  ctx: RunContext,
  mode: RenderMode = 'send',
  overrides?: VariableOverrides,
): EmailRenderResult {
  const unresolved = new Set<string>()
  const substituted = substituteMentions(content, ctx, mode, unresolved, overrides)
  const raw = generateHTML(substituted, [
    StarterKit,
    Mention.configure({
      HTMLAttributes: { class: 'inline-block rounded bg-surface-muted px-1.5 py-0.5 text-sm' },
    }),
  ])
  const clean = sanitizeHtml(raw, SANITIZE_OPTS)
  return { html: applyMissingHighlights(clean), unresolved: [...unresolved] }
}

/**
 * Render a template subject (mustache string) against a context.
 *
 * In `preview` mode unresolved tokens render as a bracketed label
 * (`[Event date]`); in `send` mode they collapse to empty.
 */
export function renderEmailSubject(
  subject: string,
  ctx: RunContext,
  mode: RenderMode = 'send',
  overrides?: VariableOverrides,
): string {
  if (!subject) return ''
  return subject.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr: string) => {
    const value = resolveWith(expr, ctx, overrides)
    if (value) return value
    return mode === 'preview' ? `[${variableLabel(expr)}]` : ''
  })
}

/**
 * Detect every variable in a template (subject + body) that cannot be
 * filled from the given context. This is the single gate both the
 * manual send route and the automation handler consult before a send.
 */
export function detectMissingVariables(
  template: EmailTemplateInput,
  ctx: RunContext,
  overrides?: VariableOverrides,
): MissingVariableResult {
  const missing = new Set<string>()

  for (const expr of extractTokens(template.subject)) {
    if (resolveWith(expr, ctx, overrides) === '') missing.add(basePath(expr))
  }
  collectUnresolvedMentions(template.content, ctx, missing, overrides)

  const list = [...missing]
  return {
    missing: list,
    blocked: list.length > 0,
    message: list.length ? `Missing: ${list.map(variableLabel).join(', ')}` : undefined,
  }
}

// ────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────

/** The variable path with any filters stripped. */
function basePath(expr: string): string {
  return (expr.split('|')[0] ?? expr).trim()
}

/** Resolve an expression, preferring a non-empty inline override. */
function resolveWith(expr: string, ctx: RunContext, overrides?: VariableOverrides): string {
  const override = overrides?.[basePath(expr)]
  if (override && override.trim()) return override
  return resolveVariable(expr, ctx)
}

/**
 * Walk the TipTap tree, replacing each mention node with a text node
 * holding the resolved value. Unresolved mentions are recorded and,
 * in preview mode, wrapped in highlight sentinels.
 */
function substituteMentions(
  node: JSONContent,
  ctx: RunContext,
  mode: RenderMode,
  unresolved: Set<string>,
  overrides?: VariableOverrides,
): JSONContent {
  if (node.type === 'mention' && node.attrs?.id) {
    const expr = String(node.attrs.id)
    const value = resolveWith(expr, ctx, overrides)
    if (value) return { type: 'text', text: value }
    unresolved.add(basePath(expr))
    const text =
      mode === 'preview'
        ? `${MISSING_OPEN}${variableLabel(expr)}${MISSING_CLOSE}`
        : ''
    return { type: 'text', text: text || ' ' }
  }
  if (Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content.map((c) => substituteMentions(c, ctx, mode, unresolved, overrides)),
    }
  }
  return node
}

/** Record (don't render) every unresolved mention in a body. */
function collectUnresolvedMentions(
  node: JSONContent,
  ctx: RunContext,
  missing: Set<string>,
  overrides?: VariableOverrides,
): void {
  if (node.type === 'mention' && node.attrs?.id) {
    const expr = String(node.attrs.id)
    if (resolveWith(expr, ctx, overrides) === '') missing.add(basePath(expr))
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) collectUnresolvedMentions(child, ctx, missing, overrides)
  }
}

/** Swap missing-variable sentinels for amber highlight spans. */
function applyMissingHighlights(html: string): string {
  const pattern = new RegExp(`${MISSING_OPEN}([^${MISSING_CLOSE}]*)${MISSING_CLOSE}`, 'g')
  return html.replace(
    pattern,
    (_m, label: string) =>
      `<span class="rounded bg-amber-100 px-1 text-amber-900" data-missing-var="true">${escapeText(
        label,
      )}</span>`,
  )
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
