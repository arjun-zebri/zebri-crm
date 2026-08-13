/**
 * One-line summaries for collapsed step cards and wait connectors.
 *
 * A collapsed card has to answer "what is this set to?" without being
 * opened, otherwise the flow reads as a list of type names and you
 * have to expand every step to see what it does. Where a step has an
 * obvious headline field (a task title, an email subject) that field
 * is the summary; otherwise it falls back to the action's description.
 *
 * @module app/(dashboard)/automations/[id]/step-summary
 */
import { actionUi } from '@/lib/automations/actions/ui'
import type { ActionType, AutomationActionRow } from '@/types/automations'

/** Reads a config key as a trimmed string, or `''`. */
function text(config: Record<string, unknown>, key: string): string {
  const raw = config[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

function truncate(value: string, max = 70): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

/** Human label for a step card's title row. */
export function stepTitle(action: AutomationActionRow): string {
  if (action.label) return action.label
  switch (action.type) {
    case 'wait':
      return 'Wait'
    case 'branch':
      return 'Branch'
    case 'stop':
      return 'Stop'
    case 'approval':
      return 'Approval'
    case 'sub_flow':
      return 'Run another automation'
    default:
      return actionUi[action.type as ActionType]?.label ?? 'Step'
  }
}

/** Collapsed-card summary for one action. */
export function stepSummary(action: AutomationActionRow): string {
  const config = (action.config as Record<string, unknown>) ?? {}

  switch (action.type) {
    case 'wait':
      return waitLabel(action)
    case 'branch':
      return branchSummary(config)
    case 'stop':
      return text(config, 'reason') || 'End the run here'
    case 'send_email': {
      const template = text(config, 'templateId')
      if (template) return 'Uses a saved template'
      const subject = text(config, 'subject')
      return subject ? `Subject: ${truncate(subject)}` : 'No subject set'
    }
    case 'send_sms':
    case 'send_whatsapp': {
      const body = text(config, 'body')
      return body ? truncate(body) : 'No message set'
    }
    case 'create_task': {
      const title = text(config, 'title')
      return title ? truncate(title) : 'No title set'
    }
    case 'update_couple_stage': {
      const status = text(config, 'toStatus')
      return status ? `Move to ${status}` : 'No status chosen'
    }
    case 'add_note': {
      const note = text(config, 'text')
      return note ? truncate(note) : 'No note set'
    }
    default:
      return actionUi[action.type as ActionType]?.description ?? ''
  }
}

/**
 * Connector text for a wait step, e.g. "20 min later".
 *
 * Wait steps render as a line between cards rather than as a card of
 * their own: a pause is a property of the gap between two steps, not
 * a thing that happens.
 */
export function waitLabel(action: AutomationActionRow): string {
  return waitConfigLabel((action.config as Record<string, unknown>) ?? {})
}

/**
 * Same phrase from a bare config object — the wait chip shows the
 * value it edits, and it holds the config, not the action row.
 */
export function waitConfigLabel(config: Record<string, unknown>): string {
  const mode = text(config, 'mode') || 'duration'

  if (mode === 'until_date') {
    const date = text(config, 'untilDate')
    return date ? `on ${date}` : 'until a date'
  }

  if (mode === 'relative_to_event') {
    const relative = (config['relative'] as Record<string, unknown> | undefined) ?? {}
    const amount = Number(relative['amount'] ?? 1)
    const unit = typeof relative['unit'] === 'string' ? relative['unit'] : 'weeks'
    const direction = relative['direction'] === 'after' ? 'after' : 'before'
    return `${amount} ${plural(unit, amount)} ${direction} the event`
  }

  const minutes = Number(config['durationMinutes'] ?? 1440)
  if (!Number.isFinite(minutes) || minutes <= 0) return 'no delay'
  return `${formatDuration(minutes)} later`
}

/** Largest whole unit that divides the duration, e.g. 1440 → "1 day". */
function formatDuration(minutes: number): string {
  const week = 60 * 24 * 7
  const day = 60 * 24
  if (minutes % week === 0 && minutes >= week) {
    const n = minutes / week
    return `${n} ${plural('weeks', n)}`
  }
  if (minutes % day === 0 && minutes >= day) {
    const n = minutes / day
    return `${n} ${plural('days', n)}`
  }
  if (minutes % 60 === 0 && minutes >= 60) {
    const n = minutes / 60
    return `${n} ${plural('hours', n)}`
  }
  return `${minutes} min`
}

/** Singularises a plural unit label when the amount is exactly 1. */
function plural(unit: string, amount: number): string {
  const base = unit.endsWith('s') ? unit.slice(0, -1) : unit
  return amount === 1 ? base : `${base}s`
}

const BRANCH_KIND_LABELS: Record<string, string> = {
  event_in: 'How far away the wedding is',
  has_signed_contract: 'Whether the contract is signed',
  has_paid_deposit: 'Whether the deposit is paid',
  couple_field: 'A couple field',
  custom_field: 'A custom field',
}

function branchSummary(config: Record<string, unknown>): string {
  const predicate = (config['predicate'] as Record<string, unknown> | undefined) ?? {}
  const kind = typeof predicate['kind'] === 'string' ? predicate['kind'] : 'event_in'
  return BRANCH_KIND_LABELS[kind] ?? 'Splits the run in two'
}
