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
  return due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
