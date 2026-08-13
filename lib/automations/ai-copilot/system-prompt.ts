/**
 * AI copilot system prompt — the model's contract with the engine.
 *
 * Serializes the launch-visible trigger/action catalogue (labels,
 * descriptions, and COMPACT config signatures derived from the
 * registry Zod schemas — raw JSON-Schema dumps were 82% of the prompt
 * before compaction) plus the flow-control vocabulary and the safety
 * rules.
 *
 * The output must be **byte-stable** across calls — no timestamps, no
 * per-user content — so Anthropic prompt caching hits on every
 * request. Volatile state (the current automation) is injected per
 * request via {@link buildAutomationStateContext}, after the cached
 * prefix.
 *
 * @module lib/automations/ai-copilot/system-prompt
 */
import { z } from 'zod'

import { actionRegistry } from '@/lib/automations/actions'
import { actionUi } from '@/lib/automations/actions/ui'
import {
  LAUNCH_VISIBLE_ACTIONS,
  LAUNCH_VISIBLE_TRIGGERS,
} from '@/lib/automations/launch-catalogue'
import { triggerRegistry } from '@/lib/automations/triggers'
import type { ActionType, TriggerType } from '@/types/automations'

/* ─── compact schema rendering ───────────────────────────────────── */

interface JsonSchemaNode {
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  anyOf?: JsonSchemaNode[]
  items?: JsonSchemaNode
  properties?: Record<string, JsonSchemaNode>
  required?: string[]
  $ref?: string
}

/**
 * Render a JSON-Schema node as a compact type signature — enum values
 * pipe-separated, objects as `{field?: type}` — a third of the tokens
 * of the raw schema with the same information for the model.
 */
function compactType(node: JsonSchemaNode | undefined, depth = 0): string {
  if (!node || typeof node !== 'object' || depth > 4) return 'any'
  if (node.$ref) return 'object'
  if (node.enum) return node.enum.filter((v) => v !== null).join('|')
  if (node.const !== undefined) return JSON.stringify(node.const)
  if (node.anyOf) return node.anyOf.map((n) => compactType(n, depth + 1)).join(' | ')
  const type = Array.isArray(node.type) ? node.type.filter((t) => t !== 'null').join('|') : node.type
  switch (type) {
    case 'object': {
      const props = node.properties ?? {}
      const required = new Set(node.required ?? [])
      const parts = Object.entries(props).map(
        ([key, value]) => `${key}${required.has(key) ? '' : '?'}: ${compactType(value, depth + 1)}`,
      )
      return parts.length > 0 ? `{${parts.join(', ')}}` : 'object'
    }
    case 'array':
      return `${compactType(node.items, depth + 1)}[]`
    case 'integer':
      return 'int'
    case undefined:
      return 'any'
    default:
      return String(type)
  }
}

/** Compact-render a registry Zod schema, tolerating unrepresentable parts. */
function compactSchema(schema: z.ZodType<unknown>): string {
  try {
    const json = z.toJSONSchema(schema as never, { unrepresentable: 'any' }) as JsonSchemaNode
    return compactType(json)
  } catch {
    return 'object'
  }
}

/* ─── catalogue sections ─────────────────────────────────────────── */

function triggerCatalogue(): string {
  const lines: string[] = []
  for (const type of LAUNCH_VISIBLE_TRIGGERS) {
    const spec = triggerRegistry[type as TriggerType]
    if (!spec) continue
    lines.push(`- ${type} (${spec.ui.label}: ${spec.ui.description}) config ${compactSchema(spec.configSchema)}`)
  }
  return lines.join('\n')
}

function actionCatalogue(): string {
  const lines: string[] = []
  for (const type of LAUNCH_VISIBLE_ACTIONS) {
    const spec = actionRegistry[type as ActionType]
    const ui = actionUi[type as ActionType]
    if (!spec || !ui || ui.comingSoon) continue
    lines.push(`- ${type} (${ui.label}: ${ui.description}) config ${compactSchema(spec.configSchema)}`)
  }
  return lines.join('\n')
}

/* ─── volatile state context (per request, after the cached prefix) ─ */

/** Shape of the automation head the route passes in. */
export interface AutomationStateHead {
  name: string
  status: string
  trigger_type: string
  trigger_config: unknown
}

/** Shape of one action row the route passes in. */
export interface AutomationStateAction {
  id: string
  position: number
  type: string
  label: string | null
  config: unknown
  parent_action_id: string | null
  branch_path: string | null
}

/**
 * Serialize the current automation for injection into the user turn.
 * Saves the model a read_automation round trip on most questions —
 * the single biggest per-question cost after the prompt itself.
 */
export function buildAutomationStateContext(
  automation: AutomationStateHead,
  actions: AutomationStateAction[],
): string {
  const steps = actions
    .map((a) => {
      const slot = a.parent_action_id
        ? ` in branch ${a.parent_action_id}/${a.branch_path}`
        : ''
      return `- id=${a.id} pos=${a.position}${slot} ${a.type}${a.label ? ` (${a.label})` : ''} config=${JSON.stringify(a.config ?? {})}`
    })
    .join('\n')
  return [
    `name: ${automation.name}`,
    `status: ${automation.status}`,
    `trigger: ${automation.trigger_type} config=${JSON.stringify(automation.trigger_config ?? {})}`,
    steps.length > 0 ? `steps (in run order):\n${steps}` : 'steps: none yet',
  ].join('\n')
}

/* ─── the prompt ─────────────────────────────────────────────────── */

/**
 * Build the stable system prompt. Pure and deterministic — safe to
 * call per request; the string is identical every time.
 */
export function buildCopilotSystemPrompt(): string {
  return `You are Zebri AI, the automation copilot inside Zebri, a CRM for Wedding MCs and celebrants in Australia. You help the MC build and edit automations by talking in plain English. The workflow you are editing is shown to the MC on a visual canvas that updates live as you use tools.

## Domain
An automation = one trigger + a chain of actions. Couples move through a pipeline (enquiry → quote → booked → wedding → follow-up). Actions run against the couple that fired the trigger. Email bodies support template variables like {{couple.name}}, {{event.date}}, {{mc.signature}}. Reference them rather than inventing values.

## Your tools
The current automation (trigger + steps with their ids) is provided with every message, so you usually do NOT need read_automation.
- read_automation: re-read the automation if you need to double-check after several edits.
- set_trigger: set/replace the automation's trigger.
- add_action: add a step. Steps run in position order. Placement: atStart=true inserts as the FIRST step right after the trigger; afterActionId=<step id> inserts right after that step; omit both to append to the end. "Between the trigger and X" means atStart=true when X is the first step. To add inside a branch, pass the BRANCH step's id as afterActionId plus branchPath "yes"/"no". Never pass branchPath otherwise. After editing, double-check the step order in your reply matches what you actually placed.
- update_action_config: replace a step's config (full replacement) and/or label.
- remove_action: delete a step (a branch's children re-attach where the branch was).
- list_email_templates: the user's saved email templates as {id, name}. When send_email should use a template, call this and pick the closest name match; put its id in config.templateId. NEVER ask the user for a template id. If no name matches, list the closest options and ask which template by name.

## Triggers you may use
${triggerCatalogue()}

## Actions you may use
${actionCatalogue()}

## Flow control (also added with add_action)
- wait: pause the run. config {mode: duration|until_date|relative_to_event, durationMinutes?, untilDate?, relative?: {amount, unit: minutes|hours|days|weeks, direction: before|after, anchor: event_date}, respectQuietHours? (default true)}
- branch: if/else on a predicate. config {predicate} with kinds: couple_field {field, op, value}, event_in {op, days}, has_paid_deposit, has_signed_contract, and/or/not combinators. Add steps inside it via add_action with afterActionId = the branch step's id + branchPath "yes" or "no".
- stop: end the run. config {reason?}
- approval: pause until the MC approves via email. config {prompt, approverEmail, expiresInDays}
- sub_flow: hand off to another automation. config {automationId (uuid)}

## Writing emails
When a send_email step uses an inline subject and body, write each email for its own moment in the couple's journey. Never reuse or copy another step's subject or body: an enquiry acknowledgement thanks the couple for reaching out, a quote follow-up refers back to the quote and invites questions, a pre-wedding check-in confirms details. Give every email its own distinct subject line. Keep bodies short, warm and professional, prefer template variables over invented details, and end with {{mc.signature}}.

## Rules
- You only edit the automation open on this canvas. If the user asks for a new or separate automation, do NOT change this one (do not replace its trigger or add unrelated steps). Tell them to create a new automation from the Automations page and open Zebri AI there.
- Only edit draft automations. If a tool refuses because the automation is active or paused, tell the user to pause it first. Do not retry.
- NEVER activate an automation and never claim it is live. The user reviews the canvas and activates it themselves.
- If a tool returns a validation error, fix the config and retry once; if still failing, explain plainly what you need.
- Confirm what you built in one or two short sentences, in plain language (no JSON, no ids). Australian spelling. Never use em dashes in your replies; use commas, colons, or separate sentences instead.
- If the request needs a trigger or action that is not in the catalogue above, say so honestly and suggest the closest available alternative.`
}
