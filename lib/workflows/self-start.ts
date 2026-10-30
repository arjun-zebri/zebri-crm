/**
 * Plain-English description of a date-anchored trigger, for the Start
 * picker.
 *
 * Some workflows are timed by their trigger rather than by their steps:
 * "7 days before an invoice is due" is the `invoice_due` trigger with
 * `days = 7`, and the steps under it are timed from the moment that
 * trigger fires. Starting one of those from the couple's Start picker
 * applies it with no trigger at all, so the first step counts from the
 * apply instant and comes due today (ZEB-124). The picker uses this
 * sentence to say so before the MC presses Start.
 *
 * Only triggers anchored to a date the couple already has are covered.
 * Starting "when a couple is created" by hand loses nothing, so it gets
 * no notice.
 *
 * @module lib/workflows/self-start
 */

import { getTriggerSpec, invoiceOverdueThresholdDays } from '@/lib/automations/triggers'
import type { TriggerType } from '@/types/automations'

import { splitApplyRule } from './apply-rules'

/** `n` and its unit, singular when `n` is 1: "1 day", "3 weeks". */
function count(n: number, unit: string): string {
  return `${n} ${n === 1 ? unit : `${unit}s`}`
}

/** Strip the plural "s" a stored unit carries: `days` → `day`. */
function singular(unit: string): string {
  return unit.endsWith('s') ? unit.slice(0, -1) : unit
}

/**
 * Parse a trigger config through its own schema so stored defaults
 * apply: an `invoice_due` saved before the inspector wrote `days` means
 * `days = 0`, exactly as the emitter reads it.
 */
function parsed(triggerType: TriggerType, raw: Record<string, unknown>): Record<string, unknown> | null {
  const spec = getTriggerSpec(triggerType)
  if (!spec) return null
  const result = spec.configSchema.safeParse(raw)
  return result.success ? (result.data as Record<string, unknown>) : null
}

/** Reads a non-negative integer, or null. */
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

/**
 * When a workflow's trigger starts it, as a phrase that completes
 * "starts by itself …", or null when the trigger is not anchored to a
 * date.
 *
 * @param applyRuleType - `workflow_templates.apply_rule_type`
 * @param applyRuleConfig - `workflow_templates.apply_rule_config`
 * @returns e.g. "7 days before each invoice is due", or null
 */
export function selfStartTiming(applyRuleType: string, applyRuleConfig: unknown): string | null {
  const { triggerType, triggerConfig } = splitApplyRule(applyRuleType, applyRuleConfig)
  if (triggerType === 'unset') return null
  const config = parsed(triggerType, triggerConfig)
  if (!config) return null

  switch (triggerType) {
    case 'invoice_due': {
      const days = num(config.days)
      if (days === null) return null
      return days === 0
        ? 'on the day each invoice is due'
        : `${count(days, 'day')} before each invoice is due`
    }
    case 'invoice_overdue': {
      const days = invoiceOverdueThresholdDays(config as { daysOverdueMin?: number })
      return `when an invoice is ${count(days, 'day')} overdue`
    }
    case 'time_before_event':
    case 'time_after_event': {
      const amount = num(config.amount)
      const unit = typeof config.unit === 'string' ? singular(config.unit) : null
      if (amount === null || !unit) return null
      const side = triggerType === 'time_before_event' ? 'before' : 'after'
      return `${count(amount, unit)} ${side} the event`
    }
    case 'anniversary_of_event': {
      const years = num(config.years)
      if (years === null) return null
      return `on the couple's ${years}-year anniversary`
    }
    default:
      return null
  }
}

/** A date-anchored trigger as the Start picker shows it. */
export interface SelfStart {
  /** Completes "starts …": see {@link selfStartTiming}. */
  when: string
  /**
   * True when the workflow is switched on, so its trigger really will
   * start it and the MC has no need to.
   */
  active: boolean
}

/**
 * {@link selfStartTiming} plus whether the trigger is live.
 *
 * @param status - `workflow_templates.status`
 * @param applyRuleType - `workflow_templates.apply_rule_type`
 * @param applyRuleConfig - `workflow_templates.apply_rule_config`
 * @returns the notice, or null when the trigger is not date-anchored
 */
export function toSelfStart(
  status: string,
  applyRuleType: string,
  applyRuleConfig: unknown,
): SelfStart | null {
  const when = selfStartTiming(applyRuleType, applyRuleConfig)
  return when ? { when, active: status === 'active' } : null
}
