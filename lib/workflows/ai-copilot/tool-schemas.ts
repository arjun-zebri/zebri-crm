/**
 * AI copilot — config validation against the existing engine schemas.
 *
 * The copilot's tools let the model author trigger and action configs;
 * this module is the guardrail that guarantees the model can only ever
 * write what the deterministic engine already accepts:
 *
 *   - registry actions validate against their `ActionSpec.configSchema`,
 *   - the five flow-control actions validate against the schemas in
 *     `lib/automations/conditions.ts`,
 *   - triggers validate against `TriggerSpec.configSchema`,
 *   - anything hidden from the launch catalogue, unknown, or flagged
 *     `comingSoon` is refused with a message the model can relay.
 *
 * Validation errors are returned as strings (never thrown) so the tool
 * loop can hand them straight back to the model for self-correction.
 *
 * @module lib/workflows/ai-copilot/tool-schemas
 */
import { z } from 'zod'

import { getActionSpec } from '@/lib/automations/actions'
import { actionUi } from '@/lib/automations/actions/ui'
import {
  approvalConfigSchema,
  branchConfigSchema,
  stopConfigSchema,
  subFlowConfigSchema,
  waitConfigSchema,
} from '@/lib/automations/conditions'
import {
  isActionLaunchVisible,
  isTriggerLaunchVisible,
} from '@/lib/automations/launch-catalogue'
import { getTriggerSpec } from '@/lib/automations/triggers'
import type { ActionType, TriggerType } from '@/types/automations'

/** Result of validating a model-authored config. */
export type ValidationResult =
  | { ok: true; config: Record<string, unknown> }
  | { ok: false; error: string }

/**
 * Flow-control actions are runner-evaluated (not in the action
 * registry) and always available to the copilot.
 */
const FLOW_CONTROL_SCHEMAS: Partial<Record<ActionType, z.ZodType<unknown>>> = {
  wait: waitConfigSchema,
  branch: branchConfigSchema,
  stop: stopConfigSchema,
  sub_flow: subFlowConfigSchema,
  approval: approvalConfigSchema,
}

/** Flatten a Zod error into one model-readable line per issue. */
function zodIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ')
}

/**
 * Validate an action config against the engine's schema for `type`.
 * Refuses unknown types, launch-hidden types, and coming-soon types.
 */
export function validateActionConfig(
  type: ActionType,
  config: unknown,
): ValidationResult {
  const flowSchema = FLOW_CONTROL_SCHEMAS[type]
  if (flowSchema) {
    const parsed = flowSchema.safeParse(config ?? {})
    if (!parsed.success) {
      return { ok: false, error: `Invalid ${type} config: ${zodIssues(parsed.error)}` }
    }
    return { ok: true, config: parsed.data as Record<string, unknown> }
  }

  const spec = getActionSpec(type)
  if (!spec) {
    return { ok: false, error: `Unknown action type "${type}".` }
  }
  if (!isActionLaunchVisible(type)) {
    return { ok: false, error: `Action "${type}" is not available yet.` }
  }
  if (actionUi[type]?.comingSoon) {
    return { ok: false, error: `Action "${type}" is coming soon and can't be added yet.` }
  }

  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid config for "${type}": ${zodIssues(parsed.error as z.ZodError)}`,
    }
  }
  return { ok: true, config: parsed.data as Record<string, unknown> }
}

/**
 * Validate a trigger config against the trigger registry schema for
 * `type`. Refuses unknown and launch-hidden triggers.
 */
export function validateTriggerConfig(
  type: TriggerType,
  config: unknown,
): ValidationResult {
  const spec = getTriggerSpec(type)
  if (!spec) {
    return { ok: false, error: `Unknown trigger type "${type}".` }
  }
  if (!isTriggerLaunchVisible(type)) {
    return { ok: false, error: `Trigger "${type}" is not available yet.` }
  }
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid config for trigger "${type}": ${zodIssues(parsed.error as z.ZodError)}`,
    }
  }
  return { ok: true, config: parsed.data as Record<string, unknown> }
}

/* ─── workflow step types the copilot can author ─────────────────── */

/** Manual step types. These are not actions and have no action spec. */
const MANUAL_STEP_TYPES = new Set(['todo', 'appointment'])

const manualConfigSchema = z
  .object({
    /** Appointments can tick themselves off a Scheduler booking. */
    meetingTypeId: z.string().uuid().optional(),
  })
  .strict()

/** Is `type` a step the MC ticks rather than one the engine runs? */
export function isManualStepType(type: string): boolean {
  return MANUAL_STEP_TYPES.has(type)
}

/**
 * Validate a step config, manual or automated.
 *
 * The copilot's single entry point. Manual steps are the reason
 * workflows exist at all (an unticked to-do gates everything anchored
 * behind it), so a copilot that could only add actions could not build
 * the feature's central mechanism.
 */
export function validateStepConfig(type: string, config: unknown): ValidationResult {
  if (isManualStepType(type)) {
    const parsed = manualConfigSchema.safeParse(config ?? {})
    if (!parsed.success) {
      return { ok: false, error: `Invalid ${type} config: ${zodIssues(parsed.error)}` }
    }
    return { ok: true, config: parsed.data as Record<string, unknown> }
  }
  return validateActionConfig(type as ActionType, config)
}

const timingSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('wedding_relative'),
    direction: z.enum(['before', 'after']),
    amount: z.number().int().min(0).max(999),
    unit: z.enum(['days', 'weeks', 'months']),
  }),
  z.object({
    mode: z.literal('apply_relative'),
    amount: z.number().int().min(0).max(999),
    unit: z.enum(['days', 'weeks', 'months']),
  }),
  z.object({
    mode: z.literal('after_previous'),
    delayAmount: z.number().int().min(0).max(999),
    unit: z.enum(['hours', 'days']),
  }),
])

/**
 * Validate a model-authored step timing.
 *
 * Rejecting a bad shape here rather than letting it reach the column
 * matters: a timing the engine cannot parse falls back to the default,
 * so "two weeks before the wedding" would silently become "immediately"
 * and nobody would find out until the email arrived six months early.
 */
export function validateTiming(timing: unknown): ValidationResult {
  const parsed = timingSchema.safeParse(timing)
  if (!parsed.success) {
    return { ok: false, error: `Invalid timing: ${zodIssues(parsed.error)}` }
  }
  return { ok: true, config: parsed.data as unknown as Record<string, unknown> }
}
