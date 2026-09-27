/**
 * The one render chain for a `send_email` step.
 *
 * The send (`lib/automations/actions/messaging`) and the review preview
 * (`lib/workflows/review`) both call these functions, and nothing else,
 * to turn a step's config into the HTML a recipient receives: which
 * source wins (saved template, composer doc, legacy plain text), how
 * variables resolve, the branded shell with the MC's signature and
 * preheader, and the legal footer with its unsubscribe link. Before this
 * module the preview flattened the body to plain text on its own, so the
 * MC approved a message that looked nothing like the one the couple got.
 * Keeping one chain is what makes "what the MC reads is what the couple
 * receives" true by construction rather than by care.
 *
 * Pure: no I/O, no token minting, no transport. The caller supplies the
 * loaded template (if any) and the unsubscribe URL for the copy being
 * rendered, so the send can mint a real per-recipient link and the
 * preview can pass {@link PREVIEW_UNSUBSCRIBE_URL} instead.
 *
 * @module lib/email/send-email-render
 */

import type { JSONContent } from '@tiptap/react'

import { renderTemplate, resolveVariable, variableLabel } from '@/lib/automations/variables'
import type { RunContext } from '@/types/automations'

import { appendComplianceFooter, wrapAutomationShell, wrapTemplateHtml } from './html'
import {
  applyMissingHighlights,
  detectMissingVariables,
  escapeText,
  markMissing,
  renderEmailSubject,
  renderEmailTemplate,
} from './templates'

/** Base URL for public surfaces. Matches `lib/email/automation-send`. */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'

/**
 * The unsubscribe link a preview renders in place of a real one.
 *
 * Why a placeholder: a real link carries a signed token for one
 * recipient, and minting it just to show the MC a footer would hand out
 * a working opt-out for the couple on every preview. This address has no
 * token, so the unsubscribe page reads it as an invalid link and opts
 * nobody out (it only counts the attempt on its own rate limiter). The
 * preview frame also blocks a click on it. It sits where
 * the real link sits, so the footer's layout and wording are unchanged.
 */
export const PREVIEW_UNSUBSCRIBE_URL = `${APP_URL}/unsubscribe/preview`

/** The parts of a `send_email` config the render reads. */
export interface SendEmailContentConfig {
  subject?: string | undefined
  /** The composer's TipTap body. */
  content?: Record<string, unknown> | undefined
  /** The pre-composer plain-text body. */
  body?: string | undefined
  /** Wrap in the branded shell (the default) or send the body bare. */
  wrap?: boolean | undefined
}

/**
 * Where a send's words come from, after the template (if any) is loaded.
 *
 * `doc` is a TipTap body (a saved template or the composer) and is held
 * to the never-send-with-a-missing-variable rule; `text` is the legacy
 * plain string, which predates that rule and still sends as it always
 * has.
 */
export type SendEmailSource =
  | { kind: 'doc'; subject: string; content: JSONContent }
  | { kind: 'text'; subject: string; body: string }

/**
 * Pick the source a step sends, in the send's own order of precedence:
 * a loaded saved template, then the composer body, then the legacy
 * plain-text body.
 *
 * @param config - The step's `send_email` config.
 * @param template - The saved template the config names, already loaded
 *   and ownership-checked by the caller; null when it names none.
 */
export function selectSendEmailSource(
  config: SendEmailContentConfig,
  template: { subject: string; content: JSONContent } | null,
): SendEmailSource {
  if (template) return { kind: 'doc', subject: template.subject, content: template.content }
  if (config.content) {
    return { kind: 'doc', subject: config.subject ?? '', content: config.content as JSONContent }
  }
  return { kind: 'text', subject: config.subject ?? '', body: config.body ?? '' }
}

/** A step's message, rendered for its couple, before any recipient is chosen. */
export interface RenderedSendEmail {
  /** The subject line with variables filled. */
  subject: string
  /**
   * Variables the body or subject could not fill, by path. On a `doc`
   * source a non-empty list parks the send (see
   * {@link RenderedSendEmail.blocked}); a legacy `text` source still sends
   * with the gap blank, so the list is only there to be shown.
   */
  missing: string[]
  /** True when the send must not go out: a `doc` source with a gap. */
  blocked: boolean
  /**
   * The whole email for one copy, given that copy's unsubscribe page URL
   * (null for a copy that carries none, such as the MC's test send).
   */
  renderHtml: (unsubscribeUrl: string | null) => string
}

/** How {@link renderSendEmail} renders, beyond the source and context. */
export interface RenderSendEmailOptions {
  /**
   * Preview only. Mark each variable that could not be filled with a
   * highlighted label instead of leaving it blank, so the MC sees the
   * gap rather than a sentence with a hole in it. The send never passes
   * this: without it the output is exactly what it was before the flag
   * existed, which is what keeps highlight markup out of every inbox.
   */
  highlightMissing?: boolean
}

/** The variable path with any filters stripped. */
function basePath(expr: string): string {
  return (expr.split('|')[0] ?? expr).trim()
}

/** The same token pattern `renderTemplate` substitutes. */
const TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g

/**
 * The paths a legacy plain-text subject and body cannot fill.
 *
 * The rich-text check ({@link detectMissingVariables}) walks mention
 * nodes and never sees a `{{token}}` typed into a plain string, so before
 * this the review preview said nothing at all about a legacy step's gaps
 * (Task 28 review M6). The signature is optional here as it is there.
 */
function missingInText(subject: string, body: string, ctx: RunContext): string[] {
  const missing = new Set<string>()
  for (const text of [subject, body]) {
    for (const match of text.matchAll(TOKEN)) {
      const expr = match[1] ?? ''
      if (basePath(expr) === 'mc.signature') continue
      if (resolveVariable(expr, ctx) === '') missing.add(basePath(expr))
    }
  }
  return [...missing]
}

/**
 * A legacy plain-text body with each unfilled variable wrapped in the
 * highlight sentinels. Same pattern and resolver as `renderTemplate`, so
 * with nothing missing the result is identical to it.
 *
 * `escapeLabel` is for the unwrapped path only: there nothing escapes the
 * body before `applyMissingHighlights` puts the label into a span, so the
 * label is escaped here, once. Inside the branded shell the shell escapes
 * the whole body, label included, and escaping here too would double it.
 */
function markTextGaps(body: string, ctx: RunContext, escapeLabel: boolean): string {
  return body.replace(TOKEN, (_m, expr: string) => {
    const value = resolveVariable(expr, ctx)
    if (value || basePath(expr) === 'mc.signature') return value
    const label = variableLabel(expr)
    return markMissing(escapeLabel ? escapeText(label) : label)
  })
}

/**
 * Render a step's subject and body against a run context.
 *
 * @param source - From {@link selectSendEmailSource}.
 * @param ctx - The run context the step executes against.
 * @param wrap - Whether to wrap the body in the branded shell.
 * @param options - Preview-only switches; the send passes none.
 */
export function renderSendEmail(
  source: SendEmailSource,
  ctx: RunContext,
  wrap: boolean,
  options: RenderSendEmailOptions = {},
): RenderedSendEmail {
  const highlight = options.highlightMissing === true
  if (source.kind === 'doc') {
    const check = detectMissingVariables({ subject: source.subject, content: source.content }, ctx)
    const rendered = renderEmailTemplate(source.content, ctx, highlight ? 'preview' : 'send').html
    return {
      subject: renderEmailSubject(source.subject, ctx, 'send'),
      missing: check.missing,
      blocked: check.blocked,
      renderHtml: (url) =>
        wrap ? wrapTemplateHtml(rendered, ctx.mc.businessName, ctx.mc.branding, url) : rendered,
    }
  }
  // What the couple receives: the gap blank. The send uses only this.
  const sentText = renderTemplate(source.body, ctx)
  const bodyText = highlight ? markTextGaps(source.body, ctx, !wrap) : sentText
  // The sentinels ride through the shell as plain characters (it escapes
  // only markup) and become highlight spans after it, so the shell never
  // sees HTML in what it treats as text. The inbox-preview sentence is
  // derived from the unmarked text (review I1): derived from the marked
  // body, its ~110-character cut could keep a gap's opening sentinel and
  // drop the closer, and it would differ from the send's.
  const finish = highlight ? applyMissingHighlights : (html: string) => html
  return {
    subject: renderTemplate(source.subject, ctx),
    missing: missingInText(source.subject, source.body, ctx),
    blocked: false,
    renderHtml: (url) =>
      finish(
        wrap
          ? highlight
            ? wrapAutomationShell(bodyText, ctx.mc.businessName, undefined, ctx.mc.branding, url, sentText)
            : wrapAutomationShell(bodyText, ctx.mc.businessName, undefined, ctx.mc.branding, url)
          : bodyText,
      ),
  }
}

/**
 * The HTML one recipient's copy carries.
 *
 * A commercial copy (every `send_email` is) links to its own recipient's
 * unsubscribe page. When the body was sent without the branded shell
 * (`wrap: false`) the link is not in it yet, so the identity and
 * unsubscribe block is appended: the `List-Unsubscribe` header alone is
 * not reliably shown, and Microsoft Graph cannot carry it at all.
 *
 * @param rendered - From {@link renderSendEmail}.
 * @param ctx - The run context, for the footer's sender identity.
 * @param unsubscribeUrl - This copy's unsubscribe page, or null for a
 *   transactional copy or the MC's own test send.
 */
export function recipientCopyHtml(
  rendered: RenderedSendEmail,
  ctx: RunContext,
  unsubscribeUrl: string | null,
): string {
  if (unsubscribeUrl === null) return rendered.renderHtml(null)
  const html = rendered.renderHtml(unsubscribeUrl)
  return html.includes(unsubscribeUrl)
    ? html
    : appendComplianceFooter(html, ctx.mc.businessName, ctx.mc.branding, unsubscribeUrl)
}
