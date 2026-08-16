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

import { formatTimeLabel } from './time-options'

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

/**
 * Names for ids a config stores but cannot read.
 *
 * A questionnaire step holds a template id; the card has to show the
 * template's *name*, and that lives in the database. The builder
 * already loads the list for the picker, so it passes the lookup in
 * rather than this module fetching anything.
 */
export interface StepSummaryLabels {
  questionnaires?: Record<string, string>
}

/** Collapsed-card summary for one action. */
export function stepSummary(action: AutomationActionRow, labels?: StepSummaryLabels): string {
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
    case 'send_whatsapp':
      // Neither can send yet, and neither card opens, so the summary
      // is the only place that can say so.
      return 'Not enabled yet — this step will not run'
    case 'create_task': {
      const title = text(config, 'title')
      return title ? truncate(title) : 'No title yet'
    }
    case 'update_couple_stage': {
      const status = text(config, 'toStatus')
      return status ? `Move to ${status}` : 'No status chosen'
    }
    case 'add_note': {
      const note = text(config, 'text')
      return note ? truncate(note) : 'No note yet'
    }
    case 'send_timeline_to_vendors':
      return `Sends the run sheet to ${runSheetAudience(config)}`
    case 'send_couple_questionnaire': {
      const templateId = text(config, 'questionnaireTemplateId')
      if (!templateId) return 'No questionnaire chosen'
      // The title override is what the couple sees, so it wins over
      // the template's own name when set.
      const title = text(config, 'title')
      return truncate(title || labels?.questionnaires?.[templateId] || 'Sends a questionnaire')
    }
    // The pre-composed sends are emails; their subject is the
    // headline, exactly as it is for send_email.
    case 'send_onboarding_pack':
    case 'send_pre_event_checklist':
    case 'send_thank_you_message':
    case 'send_anniversary_message':
    case 'request_review':
    case 'send_referral_request': {
      const subject = text(config, 'subject')
      return subject ? `Subject: ${truncate(subject)}` : 'No subject yet'
    }
    case 'create_couple': {
      const name = text(config, 'name')
      return name ? `Creates ${truncate(name)}` : 'No couple name yet'
    }
    case 'create_timeline_event': {
      const title = text(config, 'title')
      if (!title) return 'No title yet'
      const startTime = text(config, 'startTime')
      return startTime
        ? `${truncate(title, 50)} at ${formatTimeLabel(startTime)}`
        : truncate(title)
    }
    default:
      return actionUi[action.type as ActionType]?.description ?? ''
  }
}

/**
 * Who the run sheet reaches, phrased for the collapsed card and the
 * step's own "send to" chip (which imports this, so the two can never
 * describe the same config differently).
 *
 * Vendors read as on when the key is absent: a config saved before
 * the recipient flags existed went to vendors, and the runner still
 * treats it that way.
 */
export function runSheetAudience(config: Record<string, unknown>): string {
  const on: string[] = []
  if (config['sendToVendors'] !== false) on.push('vendors')
  if (config['sendToCouple'] === true) on.push('the couple')
  if (config['sendToMe'] === true) on.push('me')
  return on.length ? on.join(', ') : 'nobody'
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

/** Couple fields the runner can actually read in a branch. */
export const BRANCH_COUPLE_FIELDS: { value: string; label: string }[] = [
  { value: 'status', label: 'Stage' },
  { value: 'lead_source', label: 'Lead source' },
  { value: 'venue', label: 'Venue' },
  { value: 'event_date', label: 'Wedding date' },
  { value: 'name', label: 'Couple name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
]

/**
 * Comparisons offered on a couple field.
 *
 * The numeric ones (`gt`/`gte`/`lt`/`lte`) are deliberately absent:
 * every readable couple field is a string, and the runner's `compare`
 * turns a non-numeric operand into `null` and returns false. Offering
 * them meant offering a branch that always took the "no" path.
 */
export const BRANCH_FIELD_OPS: { value: string; label: string }[] = [
  { value: 'eq', label: 'is' },
  { value: 'neq', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'is_set', label: 'is set' },
  { value: 'is_unset', label: 'is empty' },
]

/** "at most" / "at least", the same words the trigger chips use. */
export const BRANCH_DAY_OPS: { value: string; label: string }[] = [
  { value: '<=', label: 'at most' },
  { value: '>=', label: 'at least' },
]

function label(options: { value: string; label: string }[], value: string, fallback: string) {
  return options.find((o) => o.value === value)?.label ?? fallback
}

/**
 * One leaf predicate, as a sentence.
 *
 * Shared by the collapsed card and the branch's own chips so the two
 * can never phrase the same predicate differently.
 */
export function conditionPhrase(predicate: Record<string, unknown>): string {
  const kind = typeof predicate['kind'] === 'string' ? predicate['kind'] : 'event_in'
  switch (kind) {
    case 'event_in': {
      const op = label(BRANCH_DAY_OPS, String(predicate['op'] ?? '<='), 'at most')
      const days = Number(predicate['days'] ?? 60)
      return `wedding is ${op} ${days} ${days === 1 ? 'day' : 'days'} away`
    }
    case 'has_signed_contract':
      return 'the contract is signed'
    case 'has_paid_deposit':
      return 'the deposit is paid'
    case 'has_paid_invoice':
      return 'the invoice is paid in full'
    case 'couple_field': {
      const field = label(
        BRANCH_COUPLE_FIELDS,
        String(predicate['field'] ?? ''),
        String(predicate['field'] ?? 'a couple field'),
      ).toLowerCase()
      const op = String(predicate['op'] ?? 'eq')
      const opLabel = label(BRANCH_FIELD_OPS, op, 'is')
      if (op === 'is_set' || op === 'is_unset') return `${field} ${opLabel}`
      const value = String(predicate['value'] ?? '')
      return value ? `${field} ${opLabel} ${value}` : `${field} ${opLabel} …`
    }
    // Retired from the picker (nothing writes the action results it
    // reads), but saved branches still have to describe themselves.
    case 'custom_field':
      return `custom field ${String(predicate['key'] ?? '')} is ${String(predicate['value'] ?? '')}`
    default:
      return 'a condition'
  }
}

/**
 * The leaf conditions a branch tests, in order.
 *
 * A branch holds either one predicate or an `and` / `or` group of
 * them; the runner has always evaluated both, so this flattens the
 * group into the list the chips render.
 */
export function branchConditions(config: Record<string, unknown>): Record<string, unknown>[] {
  const predicate = (config['predicate'] as Record<string, unknown> | undefined) ?? {}
  const kind = predicate['kind']
  if (kind === 'and' || kind === 'or') {
    const children = predicate['predicates']
    return Array.isArray(children) ? (children as Record<string, unknown>[]) : []
  }
  // A brand-new branch has no predicate: it starts empty and the MC
  // adds the first condition, rather than arriving with a guess about
  // what they meant already filled in.
  return typeof kind === 'string' ? [predicate] : []
}

/** How a group's conditions are joined: every one, or any one. */
export function branchJoin(config: Record<string, unknown>): 'and' | 'or' {
  const kind = (config['predicate'] as Record<string, unknown> | undefined)?.['kind']
  return kind === 'or' ? 'or' : 'and'
}

/** Every condition a branch splits on, as one sentence. */
export function branchCondition(config: Record<string, unknown>): string {
  const parts = branchConditions(config).map(conditionPhrase)
  if (parts.length === 0) return 'a condition'
  return parts.join(branchJoin(config) === 'or' ? ' or ' : ' and ')
}

function branchSummary(config: Record<string, unknown>): string {
  if (branchConditions(config).length === 0) return 'No condition set'
  return `Yes when ${branchCondition(config)}`
}
