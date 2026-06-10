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
 *   - `quote.*`     link, number, total (when the trigger / action config provides one)
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
 * Render a template string against a run context.
 *
 * Pure function - no I/O, no Supabase reads. The context is
 * pre-resolved by the runner once per action.
 */
export function renderTemplate(input: string, ctx: RunContext): string {
  if (!input) return ''
  return input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr: string) => {
    const [pathPart, ...filterParts] = expr.split('|').map((s) => s.trim())
    if (!pathPart) return ''
    let value = readPath(pathPart, ctx)
    for (const filter of filterParts) {
      const [name, arg] = filter.split(':').map((s) => s.trim())
      const fn = FILTERS[name ?? '']
      if (fn) value = fn(value, arg)
    }
    return value
  })
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
    case 'quote':
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
    default:
      return ''
  }
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

function readEventField(ctx: RunContext, namespace: string, key: string): string {
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  const candidates = [`${namespace}_${key}`, key, `${namespace}_${key.replace(/-/g, '_')}`]
  for (const c of candidates) {
    const v = payload[c]
    if (v != null) return String(v)
  }
  // Look in prior action results too - actions like "Send quote"
  // write the resulting quote_id / quote_link into actionResults.
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
    ],
  },
  {
    group: 'Links',
    variables: [
      { token: '{{portal.link}}', label: 'Couple portal link', example: 'https://zebri.app/p/…' },
      { token: '{{quote.link}}', label: 'Quote share link', example: 'https://zebri.app/q/…' },
      { token: '{{invoice.link}}', label: 'Invoice share link', example: 'https://zebri.app/i/…' },
      { token: '{{contract.link}}', label: 'Contract signing link', example: 'https://zebri.app/c/…' },
    ],
  },
]
