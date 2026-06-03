/**
 * Task domain types and constants.
 *
 * Shapes for the task-management surface (status, priority, grouping) shared
 * across the Tasks page, couple/event task panels, and the dashboard.
 *
 * @module types/task
 */

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

/* ─── User-defined option palette ──────────────────────────────────
 * Custom priorities and task types (stored in `task_priorities` and
 * `task_types`) each carry a colour. Names map to the same closed
 * palette we use for `task_groups` so the visual language stays
 * consistent across the property surface.
 */

export type TaskOptionColor =
  | 'gray'
  | 'green'
  | 'blue'
  | 'amber'
  | 'red'
  | 'purple'

export const TASK_OPTION_COLORS: TaskOptionColor[] = [
  'gray',
  'green',
  'blue',
  'amber',
  'red',
  'purple',
]

/** Pill (bg + text + ring) classes per option colour. */
export const TASK_OPTION_PILL_CLASS: Record<TaskOptionColor, string> = {
  gray: 'bg-gray-100 text-gray-600 ring-gray-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  purple: 'bg-purple-50 text-purple-700 ring-purple-100',
}

/** Solid swatch (used for the colour-picker chips). */
export const TASK_OPTION_DOT_CLASS: Record<TaskOptionColor, string> = {
  gray: 'bg-gray-300',
  green: 'bg-emerald-400',
  blue: 'bg-blue-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  purple: 'bg-purple-400',
}

export interface TaskOption {
  id: string
  name: string
  color: TaskOptionColor
}

function isTaskOptionColor(v: string): v is TaskOptionColor {
  return (TASK_OPTION_COLORS as readonly string[]).includes(v)
}

/** Coerce a stored color string to a known `TaskOptionColor`,
 *  defaulting to `gray` for any legacy/unknown value. */
export function toTaskOptionColor(v: string): TaskOptionColor {
  return isTaskOptionColor(v) ? v : 'gray'
}

/**
 * Resolve the pill class for a priority value, consulting the
 * user-defined options first (so custom colours win) and falling back
 * to the built-in low/medium/high palette, then to the deterministic
 * hash palette for any unknown value.
 */
export function resolvePriorityPillClass(
  value: string,
  options: TaskOption[],
): string {
  const match = options.find(
    (o) => o.name.toLowerCase() === value.toLowerCase(),
  )
  if (match) return TASK_OPTION_PILL_CLASS[match.color]
  return PRIORITY_PILL_CLASS[value] ?? taskTypeColor(value)
}

/** Resolve the pill class for a status value (user options → built-in
 *  todo/in_progress/done → fallback). */
export function resolveStatusPillClass(
  value: string,
  options: TaskOption[],
): string {
  const match = options.find(
    (o) => o.name.toLowerCase() === value.toLowerCase(),
  )
  if (match) return TASK_OPTION_PILL_CLASS[match.color]
  return getStatusPillClass(value)
}

/** Resolve the leading-dot class for a status value. Custom options
 *  reuse the option dot palette; built-ins keep their existing dots. */
export function resolveStatusDotClass(
  value: string,
  options: TaskOption[],
): string {
  const match = options.find(
    (o) => o.name.toLowerCase() === value.toLowerCase(),
  )
  if (match) return TASK_OPTION_DOT_CLASS[match.color]
  return getStatusDotClass(value)
}

/**
 * Resolve the pill class for a task_type value. Mirrors
 * `resolvePriorityPillClass` but with no built-in palette — task types
 * are entirely user-defined.
 */
export function resolveTypePillClass(
  value: string,
  options: TaskOption[],
): string {
  const match = options.find(
    (o) => o.name.toLowerCase() === value.toLowerCase(),
  )
  if (match) return TASK_OPTION_PILL_CLASS[match.color]
  return taskTypeColor(value)
}
