/**
 * True when a `YYYY-MM-DD` calendar date is strictly *before* today —
 * i.e. the date has fully passed. The date itself ("due today") is
 * NOT past due; overdue/expired begins the following day.
 *
 * Both sides are pinned to **local midnight** so the current
 * time-of-day never leaks into the comparison. The bug this guards
 * against: comparing a date's midnight directly to `new Date()` (the
 * current instant) made anything due *today* read as overdue the
 * moment the clock passed midnight. Use this for every "overdue" /
 * "expired" derivation on quotes, invoices, contracts and tasks.
 *
 * @param dateStr - a `YYYY-MM-DD` date, or null/undefined (→ false).
 */
export function isPastDue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const due = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatRelativeDate(due_date: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(due_date + 'T00:00:00')
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays > 1 && diffDays <= 6) return due.toLocaleDateString('en-GB', { weekday: 'short' })
  if (diffDays === -1) return 'Yesterday'
  if (diffDays >= -6 && diffDays <= -2) return `${Math.abs(diffDays)} days ago`
  return due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
