/**
 * Human-readable formatting for automation run errors.
 *
 * Run failures end up in `automation_runs.error_message`, which is
 * rendered verbatim on the couple profile's Automations tab — so the
 * runner must never write raw Zod output there. This module is the
 * single place that turns a Zod config-validation failure into plain
 * English ("Subject is required"), and the place the UI goes to
 * translate *legacy* rows that were written before this rule existed
 * (they contain the JSON-stringified Zod issue array).
 *
 * Pure functions only — imported by both the server-side runner and
 * the client-side couple tab.
 *
 * @module lib/automations/config-errors
 */

import type { ZodError } from 'zod'

/**
 * The subset of a Zod issue we need to phrase an error. Structural
 * (rather than `z.core.$ZodIssue`) so we can also feed it issue
 * arrays recovered by JSON-parsing legacy `error_message` rows.
 */
export interface ConfigIssueLike {
  code?: string
  path?: (string | number | symbol)[]
  message?: string
}

/** 'taskTitle' / 'task_title' → 'Task title'. */
function fieldLabel(path: ConfigIssueLike['path']): string | null {
  const last = [...(path ?? [])].reverse().find((seg) => typeof seg === 'string')
  if (!last) return null
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** One issue → one clause, e.g. `Subject is required`. */
function describeIssue(issue: ConfigIssueLike): string {
  const label = fieldLabel(issue.path)
  // A branch saved before its condition was chosen. "Predicate:
  // Invalid input" describes the union that rejected it; what the MC
  // has to do is pick a condition.
  if (label === 'Predicate') return 'no condition chosen'
  // Zod's own defaults ("Too small: expected string to have >=1
  // characters", "Invalid input: expected string, received undefined")
  // describe the type system, not the form — rephrase the common
  // "field left blank" cases as a simple requirement.
  const isBlank =
    issue.code === 'too_small' ||
    (issue.code === 'invalid_type' && /received (undefined|null)/.test(issue.message ?? ''))
  if (label && isBlank) return `${label} is required`
  if (label) return `${label}: ${issue.message ?? 'invalid value'}`
  return issue.message ?? 'invalid settings'
}

/**
 * Summarise a config-validation failure for an end user.
 *
 * @example
 * describeConfigError(parseResult.error) // 'Subject is required'
 */
export function describeConfigError(error: ZodError): string {
  return describeConfigIssues(error.issues as ConfigIssueLike[])
}

/** Same as {@link describeConfigError}, from a bare issue array. */
export function describeConfigIssues(issues: ConfigIssueLike[]): string {
  if (issues.length === 0) return 'invalid settings'
  return issues.map(describeIssue).join('; ')
}

/**
 * Where a config failure is being reported, which decides what the MC is
 * asked to do about it.
 *
 * - `send`: the runner, writing a run's `error_message`. The step has
 *   already failed, so the MC is sent back to the builder.
 * - `save`: a save refused before the write (Task 33). The MC is already
 *   editing, so being told to go and edit reads as nonsense.
 * - `checklist`: one line of the Turn on pre-flight (Task 34). The list
 *   already names the step and says what to do, so the line is only the
 *   field clause, as its own sentence.
 */
export type ConfigErrorContext = 'send' | 'save' | 'checklist'

/** The closing clause per sentence-style {@link ConfigErrorContext}. */
const CONFIG_ERROR_ACTION: Record<Exclude<ConfigErrorContext, 'checklist'>, string> = {
  send: 'Edit the automation to fix it.',
  save: 'Fix this before saving.',
}

/**
 * Build the sentence for a step config that fails schema validation.
 *
 * The field clause is the same in every context, so a refusal at save
 * names exactly what the send would have failed on.
 *
 * @param stepLabel - The action's UI label ('Send email', 'Wait', …).
 *   Unused in the `checklist` context, whose row carries the step's name.
 * @param context - Who is reporting it; defaults to the runner, whose
 *   stored text must not change.
 */
export function configErrorMessage(
  stepLabel: string,
  error: ZodError,
  context: ConfigErrorContext = 'send',
): string {
  if (context === 'checklist') {
    // "no condition chosen" is lower-cased for the middle of a sentence;
    // here it starts one.
    const clause = describeConfigError(error)
    return `${clause.charAt(0).toUpperCase()}${clause.slice(1)}.`
  }
  return `The "${stepLabel}" step has invalid settings: ${describeConfigError(error)}. ${CONFIG_ERROR_ACTION[context]}`
}

/**
 * Legacy / internal `error_message` shapes that predate the friendly
 * runner messages. Matched at display time so old rows don't show
 * raw Zod JSON or runner-internal jargon.
 */
const LEGACY_CONFIG_ERROR = /^(?:invalid config|[\w- ]+ config invalid): (\[[\s\S]*\])$/

/**
 * Translate a stored run `error_message` into user-facing text.
 *
 * New messages (written via {@link configErrorMessage}) pass through
 * unchanged; legacy raw-Zod rows and runner-internal state errors are
 * rewritten. Anything unrecognised is shown as-is — action handlers
 * already write human-readable failures ("Email failed to send: …").
 */
export function friendlyRunError(message: string): string {
  const legacy = message.match(LEGACY_CONFIG_ERROR)
  if (legacy) {
    try {
      const issues = JSON.parse(legacy[1] as string) as ConfigIssueLike[]
      return `This automation has a step with invalid settings: ${describeConfigIssues(issues)}. Edit the automation to fix it.`
    } catch {
      return 'This automation has a step with invalid settings. Edit the automation to fix it.'
    }
  }
  if (/^unknown action /.test(message)) {
    return 'This automation includes a step type that is not available yet.'
  }
  if (message === 'current_action_id points at missing action' || message === 'triggering event missing') {
    return 'This run hit an internal error and was stopped. We have been notified.'
  }
  return message
}
