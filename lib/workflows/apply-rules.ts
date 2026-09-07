/**
 * Apply-rule registry.
 *
 * An apply rule decides whether a bus event should create an instance of
 * a template for a couple. It is the workflows equivalent of an
 * automation's trigger, with two differences: `manual` is a first-class
 * rule that never matches an event, and `on_event` delegates to the
 * existing trigger registry so all 28 automation triggers remain
 * expressible with no new matcher code.
 *
 * A rule whose `configSchema` rejects its stored config silently never
 * matches. Give every optional field a `.default()` so a config saved
 * before a field existed still parses, and keep `.passthrough()` so a
 * config saved against a since-deleted field still loads. This is the
 * exact failure mode the 2026-08-13 trigger sweep found in the
 * automations dispatcher.
 *
 * @module lib/workflows/apply-rules
 */

import { z } from 'zod'

import type { AutomationEventRow, TriggerType } from '@/types/automations'
import type { ApplyRuleType } from '@/types/workflows'

import { getTriggerSpec } from '../automations/triggers'

/**
 * A rule with its config type intact. Declared per rule below, then
 * erased into an {@link ErasedApplyRuleSpec} for the registry.
 */
interface ApplyRuleSpec<Config extends Record<string, unknown>> {
  type: ApplyRuleType
  configSchema: z.ZodType<Config>
  /** Label for the builder's apply-rule picker. */
  label: string
  matches: (event: AutomationEventRow, config: Config) => boolean
}

/**
 * A registry entry with its config type erased.
 *
 * Callers never hold a typed config: they hold raw jsonb out of
 * `workflow_templates.apply_rule_config`, and {@link matchesRaw} parses it
 * through the rule's own schema first. Putting the parse here rather than
 * at each call site is deliberate. A config that fails to parse silently
 * never matches, which is how the automations dispatcher shipped dead
 * triggers in the 2026-08-13 sweep; there is now exactly one place that
 * can go wrong.
 */
export interface ErasedApplyRuleSpec {
  type: ApplyRuleType
  /** Label for the builder's apply-rule picker. */
  label: string
  /** True when this rule, configured with `raw`, fires for `event`. */
  matchesRaw: (event: AutomationEventRow, raw: unknown) => boolean
  /** The validated config, or null when `raw` does not parse. */
  parseConfig: (raw: unknown) => Record<string, unknown> | null
}

/** Erase a typed rule into its registry form. */
function erase<Config extends Record<string, unknown>>(
  spec: ApplyRuleSpec<Config>,
): ErasedApplyRuleSpec {
  return {
    type: spec.type,
    label: spec.label,
    parseConfig: (raw) => {
      const parsed = spec.configSchema.safeParse(raw ?? {})
      return parsed.success ? parsed.data : null
    },
    matchesRaw: (event, raw) => {
      const parsed = spec.configSchema.safeParse(raw ?? {})
      if (!parsed.success) return false
      return spec.matches(event, parsed.data)
    },
  }
}

/** Reads a string field out of a bus event payload. */
function payloadString(event: AutomationEventRow, key: string): string | null {
  const payload = event.payload as Record<string, unknown> | null
  const value = payload?.[key]
  return typeof value === 'string' ? value : null
}

const manualSchema = z.object({}).passthrough()
const manual: ApplyRuleSpec<z.infer<typeof manualSchema>> = {
  type: 'manual',
  configSchema: manualSchema,
  label: 'Only when I apply it',
  // Never matches. A manual template is applied from the couple profile
  // picker, which inserts the instance directly.
  matches: () => false,
}

const coupleCreatedSchema = z.object({}).passthrough()
const onCoupleCreated: ApplyRuleSpec<z.infer<typeof coupleCreatedSchema>> = {
  type: 'on_couple_created',
  configSchema: coupleCreatedSchema,
  label: 'When a couple is created',
  // Couple INSERT already emits `new_enquiry` (20260604000100). We match
  // that existing slug rather than adding a second event for the same row
  // change, which would double-fire anything listening to both.
  matches: (event) => event.event_type === 'new_enquiry',
}

const stageChangedSchema = z
  .object({ toStatus: z.string().default('') })
  .passthrough()
const onStageChanged: ApplyRuleSpec<z.infer<typeof stageChangedSchema>> = {
  type: 'on_stage_changed',
  configSchema: stageChangedSchema,
  label: 'When the couple moves to a status',
  matches: (event, config) => {
    if (event.event_type !== 'couple_stage_changed') return false
    // An unconfigured rule must not fire on every stage change.
    if (!config.toStatus) return false
    const to = payloadString(event, 'to_status')
    if (!to) return false
    // Couple statuses are user-defined free text and get renamed. Compare
    // case-insensitively so a capitalisation change does not silently kill
    // an MC's workflow.
    return to.toLowerCase() === config.toStatus.toLowerCase()
  },
}

const packageAppliedSchema = z
  .object({ packageId: z.string().uuid().optional() })
  .passthrough()
const onPackageApplied: ApplyRuleSpec<z.infer<typeof packageAppliedSchema>> = {
  type: 'on_package_applied',
  configSchema: packageAppliedSchema,
  label: 'When a package is applied',
  matches: (event, config) => {
    if (event.event_type !== 'package_applied') return false
    // No package configured means "any package".
    if (!config.packageId) return true
    return payloadString(event, 'package_id') === config.packageId
  },
}

const onEventSchema = z
  .object({
    eventType: z.string().default(''),
    /** The chosen trigger's own filter config, parsed by its spec. */
    triggerConfig: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough()
const onEvent: ApplyRuleSpec<z.infer<typeof onEventSchema>> = {
  type: 'on_event',
  configSchema: onEventSchema,
  label: 'When something happens',
  matches: (event, config) => {
    if (!config.eventType) return false
    if (event.event_type !== config.eventType) return false
    const spec = getTriggerSpec(config.eventType as TriggerType)
    if (!spec) return false
    // Re-parse through the trigger's own schema so optional fields with
    // declared defaults resolve before match() compares against them. The
    // automations dispatcher learned this the hard way: without it, a
    // config missing an optional field fails every narrowing predicate.
    const parsed = spec.configSchema.safeParse(config.triggerConfig)
    if (!parsed.success) return false
    return spec.match(event, parsed.data)
  },
}

export const applyRuleRegistry: Record<ApplyRuleType, ErasedApplyRuleSpec> = {
  manual: erase(manual),
  on_couple_created: erase(onCoupleCreated),
  on_stage_changed: erase(onStageChanged),
  on_package_applied: erase(onPackageApplied),
  on_event: erase(onEvent),
}

/** Look up an apply-rule spec by slug. Returns null for an unknown type. */
export function getApplyRuleSpec(type: string): ErasedApplyRuleSpec | null {
  return applyRuleRegistry[type as ApplyRuleType] ?? null
}

/* ─── the apply-rule adapter ─────────────────────────────────────── */

/**
 * Canvas trigger slug for each stored rule that is not `on_event`.
 *
 * The three native rules predate the builder and are still the clearest
 * way to express themselves in the dispatcher, but the canvas only knows
 * the trigger registry. Each one has a trigger that fires on the same bus
 * event with the same config keys (`toStatus`, `packageId`), so the
 * mapping is lossless in both directions.
 */
const NATIVE_RULE_TRIGGERS: Readonly<Record<string, TriggerType>> = {
  on_couple_created: 'new_enquiry',
  on_stage_changed: 'couple_stage_changed',
  on_package_applied: 'package_applied',
}

/** An apply rule in the vocabulary the builder canvas speaks. */
export interface BuilderApplyRule {
  /** `unset` is the canvas's word for "no automatic rule". */
  triggerType: TriggerType | 'unset'
  /** The trigger's own filter config, flat, as the inspector edits it. */
  triggerConfig: Record<string, unknown>
}

/**
 * Present a stored apply rule as a canvas trigger.
 *
 * Read half of the adapter. The stored model has five rules; the canvas
 * has the whole trigger registry, so `on_event` unwraps to the trigger it
 * nests and everything else maps to its equivalent slug.
 */
export function splitApplyRule(type: string, config: unknown): BuilderApplyRule {
  const raw = (config ?? {}) as Record<string, unknown>
  if (type === 'on_event') {
    const eventType = typeof raw.eventType === 'string' ? raw.eventType : ''
    return {
      triggerType: eventType ? (eventType as TriggerType) : 'unset',
      triggerConfig: (raw.triggerConfig as Record<string, unknown>) ?? {},
    }
  }
  const native = NATIVE_RULE_TRIGGERS[type]
  if (native) return { triggerType: native, triggerConfig: raw }
  // `manual`, and anything a future migration adds that the canvas has no
  // word for yet. Showing the placeholder beats a card titled with a slug
  // the trigger registry cannot label.
  return { triggerType: 'unset', triggerConfig: {} }
}

/**
 * Store a canvas trigger as an apply rule.
 *
 * Write half of the adapter. Every trigger the builder can pick is stored
 * as `on_event` rather than one of the native rules: the CHECK constraint
 * has no member for `new_enquiry`, and nesting under `on_event` keeps the
 * whole 28-trigger vocabulary expressible with no new matcher code.
 */
export function joinApplyRule(
  triggerType: string,
  triggerConfig: Record<string, unknown>,
): { applyRuleType: ApplyRuleType; applyRuleConfig: Record<string, unknown> } {
  if (triggerType === 'unset' || triggerType === 'manual') {
    return { applyRuleType: 'manual', applyRuleConfig: {} }
  }
  return {
    applyRuleType: 'on_event',
    applyRuleConfig: { eventType: triggerType, triggerConfig },
  }
}
