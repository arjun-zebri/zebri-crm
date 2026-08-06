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

import { renderSignatureHtml } from './signature'

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

// Sentinels for the `{{mc.signature}}` variable. The signature is rich
// HTML (it can contain bold, links, line breaks), but mention nodes
// otherwise resolve to plain text. So we emit an indexed placeholder
// here and splice the separately-rendered, already-sanitised signature
// HTML back in AFTER the parent body is sanitised \u2014 the same trick the
// missing-variable highlights use.
const SIG_OPEN = '\uE002'
const SIG_CLOSE = '\uE003'

/** The variable path that injects the MC's email signature. */
const SIGNATURE_PATH = 'mc.signature'

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
  // Sanitised HTML fragments for each `{{mc.signature}}` occurrence,
  // referenced by index from a sentinel placeholder in the tree.
  const sigFragments: string[] = []
  const substituted = substituteMentions(content, ctx, mode, unresolved, overrides, sigFragments)
  const raw = generateHTML(substituted, [
    StarterKit,
    Mention.configure({
      HTMLAttributes: { class: 'inline-block rounded-control bg-surface-muted px-1.5 py-0.5 text-sm' },
    }),
  ])
  const clean = sanitizeHtml(raw, SANITIZE_OPTS)
  return {
    html: fillEmptyParagraphs(applySignatureFragments(applyMissingHighlights(clean), sigFragments)),
    unresolved: [...unresolved],
  }
}

/**
 * Give empty paragraphs height so the MC's intentional blank lines survive.
 * A bare `<p></p>` collapses to zero height in email clients (and the
 * compose preview), so the spacing the MC typed silently disappears. A
 * `<br>` inside is the email-safe way to keep the blank line.
 */
function fillEmptyParagraphs(html: string): string {
  return html.replace(/<p([^>]*)>\s*<\/p>/g, '<p$1><br></p>')
}

/**
 * Resolve a template body for the editable compose preview: every
 * variable the couple **can** fill becomes plain text (its value), while
 * a variable that **can't** be filled is left as its mention node so the
 * editor can highlight it in place as a "fill me" chip.
 *
 * Used by the manual compose modal to seed an **editable** preview: the
 * MC edits the finished email directly (replacing each highlighted gap)
 * rather than supplying per-variable overrides.
 */
export function resolveTemplateContent(
  content: JSONContent,
  ctx: RunContext,
  overrides?: VariableOverrides,
): JSONContent {
  // The root is always a doc, never a mention, so this never drops to null.
  return fillMentions(content, ctx, overrides) ?? content
}

/** Chip styling for the read-only "template shape" preview. */
const CHIP_CLASS = 'inline-block rounded-control bg-blue-50 px-1.5 py-0.5 text-sm font-medium text-blue-700'

/**
 * Render a template body as its **shape**, not a filled email: every
 * variable becomes a labelled blue chip (e.g. "Couple names") regardless
 * of any context. This is the read-only Templates preview pane — it shows
 * what the template is, where the live editor preview (above) fills sample
 * values. No context needed; mentions resolve to their human label.
 */
export function renderTemplateChips(content: JSONContent): string {
  const raw = generateHTML(content, [
    StarterKit,
    Mention.configure({
      HTMLAttributes: { class: CHIP_CLASS },
      renderHTML({ node }) {
        const id = typeof node.attrs?.id === 'string' ? node.attrs.id.trim() : ''
        return ['span', { class: CHIP_CLASS }, variableLabel(id)]
      },
    }),
  ])
  return fillEmptyParagraphs(sanitizeHtml(raw, SANITIZE_OPTS))
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
    // The signature is always optional. An empty one is valid, never a
    // blocking gap.
    if (basePath(expr) === SIGNATURE_PATH) continue
    if (resolveWith(expr, ctx, overrides) === '') missing.add(basePath(expr))
  }
  collectUnresolvedMentions(template.content, ctx, missing, overrides)

  const list = [...missing]
  // Omit `message` entirely when nothing is missing — under
  // exactOptionalPropertyTypes an explicit `undefined` is not assignable
  // to the optional `message?: string`.
  return list.length
    ? { missing: list, blocked: true, message: `Missing: ${list.map(variableLabel).join(', ')}` }
    : { missing: list, blocked: false }
}

// ────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────

/** The variable path with any filters stripped. */
function basePath(expr: string): string {
  return (expr.split('|')[0] ?? expr).trim()
}

/**
 * The variable expression carried by a mention node, or `''` when the
 * node is malformed — i.e. it lost its `attrs.id`. A corrupted mention
 * (commonly from an HTML copy-paste round-trip in the editor, which can
 * strip the id) must be treated as unresolved, never handed to TipTap's
 * default Mention renderer, which would stringify the null id as `@null`.
 */
function mentionExpr(node: JSONContent): string {
  const id = node.attrs?.id
  return typeof id === 'string' ? id.trim() : ''
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
  overrides: VariableOverrides | undefined,
  sigFragments: string[],
): JSONContent {
  if (node.type === 'mention') {
    const expr = mentionExpr(node)
    // Malformed mention (no usable variable id): collapse it rather than
    // letting TipTap's default renderer print `@null`. Empty in send mode,
    // a neutral highlight in preview so the MC can see something's off.
    if (!expr) {
      return {
        type: 'text',
        text: mode === 'preview' ? `${MISSING_OPEN}Variable${MISSING_CLOSE}` : ' ',
      }
    }
    // The signature is rich HTML, not a plain value: render it on its own
    // (with the signature stripped from the context so a nested
    // `{{mc.signature}}` can't recurse) and leave an indexed placeholder
    // that gets the formatted HTML spliced in after sanitising. An empty
    // signature collapses to nothing and is never treated as missing.
    if (basePath(expr) === SIGNATURE_PATH) {
      // The signature is rich HTML (colours, fonts, images), not a plain
      // value: render it on its own and leave an indexed placeholder that
      // gets the formatted HTML spliced in after sanitising. Routing even
      // an empty signature through a placeholder (fragment = '') avoids
      // emitting an empty text node, which the ProseMirror schema rejects.
      const html = renderSignatureHtml(ctx.mc.signature)
      const index = sigFragments.push(html) - 1
      return { type: 'text', text: `${SIG_OPEN}${index}${SIG_CLOSE}` }
    }
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
      content: node.content.map((c) =>
        substituteMentions(c, ctx, mode, unresolved, overrides, sigFragments),
      ),
    }
  }
  return node
}

/**
 * Walk the tree replacing each resolvable mention with its value as a
 * text node, and leaving an unresolvable mention untouched so the editor
 * can render it as a highlighted "fill me" chip.
 */
function fillMentions(
  node: JSONContent,
  ctx: RunContext,
  overrides?: VariableOverrides,
): JSONContent | null {
  if (node.type === 'mention') {
    const expr = mentionExpr(node)
    // Corrupted mention (lost its id): drop it entirely. Returning an
    // empty text node would be rejected by the editor's ProseMirror
    // schema; leaving the mention would render as a "null" chip.
    if (!expr) return null
    // Keep the signature as a mention node so the authoritative send
    // (substituteMentions) injects it as rich HTML — fonts, links, images.
    // Flattening it to plain text here would strip that formatting from
    // the outgoing email, since the editable preview's content is what
    // gets sent verbatim. An empty signature collapses to nothing on send.
    if (basePath(expr) === SIGNATURE_PATH) return node
    const value = resolveWith(expr, ctx, overrides)
    return value ? { type: 'text', text: value } : node
  }
  if (Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content
        .map((c) => fillMentions(c, ctx, overrides))
        .filter((c): c is JSONContent => c !== null),
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
    // Signature is optional. See the subject scan above.
    if (basePath(expr) !== SIGNATURE_PATH && resolveWith(expr, ctx, overrides) === '') {
      missing.add(basePath(expr))
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) collectUnresolvedMentions(child, ctx, missing, overrides)
  }
}

/** Splice each rendered signature fragment back in at its placeholder. */
function applySignatureFragments(html: string, fragments: string[]): string {
  if (fragments.length === 0) return html
  const pattern = new RegExp(`${SIG_OPEN}(\\d+)${SIG_CLOSE}`, 'g')
  return html.replace(pattern, (_m, index: string) => fragments[Number(index)] ?? '')
}

/** Swap missing-variable sentinels for amber highlight spans. */
function applyMissingHighlights(html: string): string {
  const pattern = new RegExp(`${MISSING_OPEN}([^${MISSING_CLOSE}]*)${MISSING_CLOSE}`, 'g')
  return html.replace(
    pattern,
    (_m, label: string) =>
      `<span class="rounded-control bg-amber-100 px-1 text-amber-900" data-missing-var="true">${escapeText(
        label,
      )}</span>`,
  )
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
