// Shared types and constants for the Notion-style tasks UI.

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
}

export const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done']

// Notion-like pill: <bg> + <text> classes.
export const STATUS_PILL_CLASS: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-600 ring-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-100',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
}

export const STATUS_DOT_CLASS: Record<TaskStatus, string> = {
  todo: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  done: 'bg-emerald-500',
}

// Priority is now free-form: built-in low/medium/high have curated colours,
// custom values fall back to a deterministic palette (same as task types).
export type TaskPriority = string

export const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const PRIORITY_ORDER: string[] = ['high', 'medium', 'low']

export const PRIORITY_PILL_CLASS: Record<string, string> = {
  high: 'bg-red-50 text-red-700 ring-red-100',
  medium: 'bg-amber-50 text-amber-800 ring-amber-100',
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
}

// Deterministic colour for free-form task_type tags.
const TYPE_PALETTE = [
  'bg-blue-50 text-blue-700 ring-blue-100',
  'bg-purple-50 text-purple-700 ring-purple-100',
  'bg-amber-50 text-amber-800 ring-amber-100',
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-pink-50 text-pink-700 ring-pink-100',
  'bg-indigo-50 text-indigo-700 ring-indigo-100',
] as const

export function taskTypeColor(value: string): string {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0
  }
  return TYPE_PALETTE[Math.abs(h) % TYPE_PALETTE.length]
}

export function getStatusPillClass(v: string): string {
  return STATUS_PILL_CLASS[v as TaskStatus] ?? 'bg-gray-50 text-gray-600 ring-gray-200'
}

export function getStatusDotClass(v: string): string {
  return STATUS_DOT_CLASS[v as TaskStatus] ?? 'bg-gray-400'
}

export function getStatusLabel(v: string): string {
  return STATUS_LABEL[v as TaskStatus] ?? v
}

export function getPriorityLabel(v: string): string {
  return PRIORITY_LABEL[v] ?? v
}

export function getPriorityPillClass(v: string): string {
  return PRIORITY_PILL_CLASS[v] ?? taskTypeColor(v)
}
