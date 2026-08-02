/**
 * Variable resolver / template renderer for automations.
 *
 * Every send-* action (email, SMS, WhatsApp) and many side-effect
 * actions (create task, add note, calendar event) accept template
 * strings with `{{ namespace.key }}` placeholders. This module is
 * the single resolver every handler calls.
 *
 * The syntax is intentionally tiny:
 *
 *   - `{{ couple.name }}`            simple read
 *   - `{{ event.date | friendly }}` pipe filter (formatting)
 *   - `{{ couple.spouse_name | default:partner }}`  fallback
 *
 * Filters supported: `friendly` (date → "Sat 12 Apr 2026"),
 * `friendly_long`, `iso`, `time`, `weekday`, `default:VALUE`,
 * `upper`, `lower`, `currency`.
 *
 * The available namespaces are derived from {@link RunContext}:
 *
 *   - `couple.*`    name, primary_name, spouse_name, email, phone, status
 *   - `event.*`   date, days_until, days_since, weekday
 *   - `venue.*`     name
 *   - `mc.*`        business_name, contact_name, email, phone
 *   - `portal.*`    link
 *   - `invoice.*`   link, number, total
 *   - `contract.*`  link, number
 *   - `task.*`      title, due_date
 *
 * Missing fields render as the configured default or an empty
 * string; the resolver does NOT throw on unknown vars. That keeps
 * a tiny copy mistake from killing a send.
 *
 * @module lib/automations/variables
 */

import type { RunContext, CoupleSnapshot, McSnapshot } from '@/types/automations'

/** Built-in pipe filters. */
type FilterFn = (input: string, arg?: string) => string

const FILTERS: Record<string, FilterFn> = {
  friendly: (s) => formatDate(s, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
  friendly_long: (s) => formatDate(s, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
  iso: (s) => (parseDate(s)?.toISOString().slice(0, 10) ?? s),
  time: (s) => (parseDate(s)?.toISOString().slice(11, 16) ?? s),
  weekday: (s) => formatDate(s, { weekday: 'long' }),
  default: (s, arg) => (s ? s : (arg ?? '')),
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  currency: (s) => formatCurrency(s),
}

/**
 * Resolve a single variable expression (`path | filter:arg | …`)
 * against a run context.
 *
 * This is the atom both {@link renderTemplate} (mustache strings) and
 * the email-template renderer (TipTap mention nodes) call, so the two
 * surfaces resolve variables identically. An expression that reads to
 * nothing returns the empty string — callers that need to *flag*
 * missing variables (email templates) treat an empty result as
 * "unresolved" unless a `default:` filter supplied a fallback.
 *
 * @param expr - The inside of a `{{ }}`, e.g. `event.date | friendly`.
 */
export function resolveVariable(expr: string, ctx: RunContext): string {
  const [pathPart, ...filterParts] = expr.split('|').map((s) => s.trim())
  if (!pathPart) return ''
  let value = readPath(pathPart, ctx)
  for (const filter of filterParts) {
    const [name, arg] = filter.split(':').map((s) => s.trim())
    const fn = FILTERS[name ?? '']
    if (fn) value = fn(value, arg)
  }
  return value
}

/**
 * Render a template string against a run context.
 *
 * Pure function - no I/O, no Supabase reads. The context is
 * pre-resolved by the runner once per action.
 */
export function renderTemplate(input: string, ctx: RunContext): string {
  if (!input) return ''
  return input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr: string) =>
    resolveVariable(expr, ctx),
  )
}

/**
 * Extract the raw variable expressions from a mustache string, in
 * document order (duplicates preserved). Used by the email-template
 * missing-variable detector to scan a subject line.
 *
 * @param input - A mustache string, e.g. `Hi {{ couple.primary_name }}`.
 * @returns The inner expressions, e.g. `['couple.primary_name']`.
 */
export function extractTokens(input: string): string[] {
  if (!input) return []
  const out: string[] = []
  for (const match of input.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    const expr = match[1]?.trim()
    if (expr) out.push(expr)
  }
  return out
}

/**
 * Human label for a variable path, used in "Missing: …" warnings and
 * the editor's missing-variable highlights. Prefers the
 * {@link VARIABLE_CATALOGUE} label; falls back to a title-cased key.
 *
 * @param expr - A variable path or full expression (filters ignored),
 *   e.g. `couple.primary_name` or `event.date | friendly`.
 */
export function variableLabel(expr: string): string {
  const base = (expr.split('|')[0] ?? expr).trim()
  for (const group of VARIABLE_CATALOGUE) {
    for (const v of group.variables) {
      const token = v.token.replace(/[{}]/g, '')
      const tokenBase = (token.split('|')[0] ?? token).trim()
      if (tokenBase === base) return v.label
    }
  }
  const key = base.split('.').slice(1).join(' ') || base
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function readPath(path: string, ctx: RunContext): string {
  const [namespace, ...rest] = path.split('.')
  const key = rest.join('.')
  switch (namespace) {
    case 'couple':
      return readCouple(ctx.couple, key)
    case 'event':
      return readEvent(ctx.couple, key)
    case 'venue':
      return readVenue(ctx.couple, key)
    case 'mc':
      return readMc(ctx.mc, key)
    case 'portal':
      return readPortal(ctx, key)
    case 'questionnaire':
      return readQuestionnaire(ctx, key)
    case 'invoice':
    case 'contract':
    case 'task':
      // These read from the triggering event's payload or the
      // accumulated action results. The dispatcher denormalises
      // common fields onto trigger payloads so most reads here
      // are zero-hop.
      return readEventField(ctx, namespace, key)
    default:
      return ''
  }
}

function readCouple(c: CoupleSnapshot | null, key: string): string {
  if (!c) return ''
  switch (key) {
    case 'name':
    case 'full_name':
      return c.name
    case 'primary_name':
    case 'partner1':
      return c.primaryName
    case 'spouse_name':
    case 'partner2':
      return c.spouseName ?? ''
    case 'email':
      return c.email ?? ''
    case 'phone':
      return c.phone ?? ''
    case 'status':
      return c.status
    default:
      return ''
  }
}

function readEvent(c: CoupleSnapshot | null, key: string): string {
  if (!c) return ''
  const date = c.eventDate
  if (!date) return ''
  switch (key) {
    case 'date':
      return date
    case 'days_until': {
      const d = daysBetween(new Date(), parseDate(date))
      return d != null && d >= 0 ? String(d) : ''
    }
    case 'days_since': {
      const d = daysBetween(parseDate(date), new Date())
      return d != null && d >= 0 ? String(d) : ''
    }
    case 'weekday':
      return formatDate(date, { weekday: 'long' })
    default:
      return ''
  }
}

function readVenue(c: CoupleSnapshot | null, key: string): string {
  if (!c) return ''
  if (key === 'name') return c.venue ?? ''
  return ''
}

function readMc(mc: McSnapshot, key: string): string {
  switch (key) {
    case 'business_name':
    case 'name':
      return mc.businessName
    case 'contact_name':
      return mc.contactName
    case 'email':
      return mc.email
    case 'phone':
      return mc.phone ?? ''
    case 'signature':
      // The signature is rich TipTap JSON. The string resolver (subjects,
      // SMS, plain renderTemplate) gets its flattened text; the email-body
      // renderer special-cases the mention to inject formatted HTML.
      return flattenSignatureText(mc.signature)
    default:
      return ''
  }
}

/** A minimal structural view of a TipTap node, enough to read its text. */
interface TextishNode {
  type?: string
  text?: string
  content?: TextishNode[]
}

/**
 * Flatten a TipTap signature doc to plain text: inline text concatenated
 * within each block, blocks joined by a single space. Returns an empty
 * string for a null / empty doc.
 */
function flattenSignatureText(doc: TextishNode | null | undefined): string {
  if (!doc?.content) return ''
  const blockText = (node: TextishNode): string =>
    node.type === 'text' ? node.text ?? '' : (node.content ?? []).map(blockText).join('')
  return doc.content
    .map(blockText)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readPortal(ctx: RunContext, key: string): string {
  if (key !== 'link') return ''
  // The dispatcher stamps the absolute portal URL onto the trigger
  // payload when the source row has a portal_token; if missing, we
  // surface the empty string and let the user's template default
  // kick in.
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  const link = payload['portal_link']
  return typeof link === 'string' ? link : ''
}

/**
 * Questionnaire reads come from two directions: a preceding "Send
 * questionnaire" action writes `questionnaire_link` / `questionnaire_id` into
 * its action results, and the `questionnaire_completed` trigger payload
 * carries `title` + `share_token`. `link` falls back to building the fill URL
 * from the trigger's share token so a thank-you email can still reference it.
 */
function readQuestionnaire(ctx: RunContext, key: string): string {
  const direct = readEventField(ctx, 'questionnaire', key)
  if (direct) return direct
  if (key === 'link') {
    const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
    const token = payload['share_token']
    // Only a questionnaire event's share_token belongs to this namespace.
    if (payload['questionnaire_id'] != null && typeof token === 'string' && token) {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'
      return `${base}/questionnaire/${token}`
    }
  }
  return ''
}

function readEventField(ctx: RunContext, namespace: string, key: string): string {
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  const candidates = [`${namespace}_${key}`, key, `${namespace}_${key.replace(/-/g, '_')}`]
  for (const c of candidates) {
    const v = payload[c]
    if (v != null) return String(v)
  }
  // Look in prior action results too - actions like "Send invoice"
  // write the resulting invoice_id / invoice_link into actionResults.
  for (const actionId of Object.keys(ctx.actionResults)) {
    const r = ctx.actionResults[actionId] as Record<string, unknown> | null
    if (!r) continue
    const v = r[`${namespace}_${key}`] ?? r[key]
    if (v != null) return String(v)
  }
  return ''
}

// ────────────────────────────────────────────────────────────────
// Date / currency helpers - tiny on purpose
// ────────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  if (!s) return null
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(s: string, opts: Intl.DateTimeFormatOptions): string {
  const d = parseDate(s)
  if (!d) return s
  return new Intl.DateTimeFormat('en-AU', opts).format(d)
}

function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / 86400000)
}

function formatCurrency(s: string): string {
  const n = Number(s)
  if (Number.isNaN(n)) return s
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

// ────────────────────────────────────────────────────────────────
// Available-variable catalogue (UI consumption)
// ────────────────────────────────────────────────────────────────

/**
 * Catalogue of variables the builder's right-rail inspector shows.
 * Adding a new variable means: (a) handle the read above and (b)
 * append it here. UI tests assert the two lists stay in lock-step.
 */
export const VARIABLE_CATALOGUE: ReadonlyArray<{
  group: string
  variables: ReadonlyArray<{ token: string; label: string; example: string }>
}> = [
  {
    group: 'Couple',
    variables: [
      { token: '{{couple.name}}', label: 'Couple display name', example: 'Sam & Alex' },
      { token: '{{couple.primary_name}}', label: 'Primary contact', example: 'Sam' },
      { token: '{{couple.spouse_name}}', label: 'Spouse / partner', example: 'Alex' },
      { token: '{{couple.email}}', label: 'Primary email', example: 'sam@example.com' },
      { token: '{{couple.phone}}', label: 'Primary phone', example: '0412 345 678' },
    ],
  },
  {
    group: 'Event',
    variables: [
      { token: '{{event.date | friendly}}', label: 'Event date', example: 'Sat 12 Apr 2026' },
      { token: '{{event.days_until}}', label: 'Days until event', example: '42' },
      { token: '{{event.weekday}}', label: 'Event day of week', example: 'Saturday' },
    ],
  },
  {
    group: 'Venue',
    variables: [{ token: '{{venue.name}}', label: 'Venue name', example: 'The Calile' }],
  },
  {
    group: 'You (MC)',
    variables: [
      { token: '{{mc.business_name}}', label: 'Your business name', example: 'Acme MC Co' },
      { token: '{{mc.contact_name}}', label: 'Your name', example: 'Charlie Park' },
      { token: '{{mc.email}}', label: 'Your email', example: 'hello@acmemc.com' },
      { token: '{{mc.signature}}', label: 'Your email signature', example: 'Cheers, Charlie' },
    ],
  },
  {
    group: 'Links',
    variables: [
      { token: '{{portal.link}}', label: 'Couple portal link', example: 'https://zebri.app/portal/…' },
      { token: '{{invoice.link}}', label: 'Invoice share link', example: 'https://zebri.app/invoice/…' },
      { token: '{{contract.link}}', label: 'Contract signing link', example: 'https://zebri.app/contract/…' },
      { token: '{{questionnaire.link}}', label: 'Questionnaire link', example: 'https://zebri.app/questionnaire/…' },
    ],
  },
  {
    group: 'Document Numbers & Totals',
    variables: [
      { token: '{{invoice.number}}', label: 'Invoice number', example: 'INV-001' },
      { token: '{{contract.number}}', label: 'Contract number', example: 'CTR-001' },
    ],
  },
  {
    group: 'Questionnaire',
    variables: [
      { token: '{{questionnaire.title}}', label: 'Questionnaire title', example: 'Ceremony details' },
    ],
  },
]
