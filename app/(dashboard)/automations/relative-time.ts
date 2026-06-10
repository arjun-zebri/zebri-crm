/**
 * Tiny relative-time formatter shared across the home page
 * sections + the list rows.
 *
 *   now ← future:  "in 3h", "tomorrow 9am", "in 5d"
 *   past → now:    "just now", "12m ago", "3h ago", "yesterday", "5d ago"
 *
 * Pure; no I/O. Imported by stats-strip, couples-in-flows,
 * recent-activity, and the enriched list row.
 *
 * @module app/(dashboard)/automations/relative-time
 */
const ONE_MIN = 60_000
const ONE_HOUR = 3_600_000
const ONE_DAY = 86_400_000

export function relativePast(iso: string | null, now: number = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, now - t)
  if (diff < 30_000) return 'just now'
  if (diff < ONE_HOUR) return `${Math.floor(diff / ONE_MIN)}m ago`
  if (diff < ONE_DAY) return `${Math.floor(diff / ONE_HOUR)}h ago`
  if (diff < 2 * ONE_DAY) return 'yesterday'
  if (diff < 7 * ONE_DAY) return `${Math.floor(diff / ONE_DAY)}d ago`
  return new Date(t).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

export function relativeFuture(iso: string | null, now: number = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = t - now
  if (diff <= 0) return 'any moment'
  if (diff < ONE_HOUR) return `in ${Math.floor(diff / ONE_MIN)}m`
  if (diff < ONE_DAY) return `in ${Math.floor(diff / ONE_HOUR)}h`
  if (diff < 2 * ONE_DAY) return 'tomorrow'
  if (diff < 7 * ONE_DAY) return `in ${Math.floor(diff / ONE_DAY)}d`
  return new Date(t).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}
