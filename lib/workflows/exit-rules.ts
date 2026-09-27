/**
 * Exit rules: the stages that stop a workflow for a couple.
 *
 * A workflow lists stages in `workflow_templates.exit_statuses`. When a
 * couple moves into one, the dispatcher cancels that couple's running and
 * paused instances of the workflow (`./exit-dispatch`).
 *
 * The stored form is the one the stage-changed apply rule uses: a
 * `couple_statuses.slug`, which is what `couples.status` holds and what
 * the bus event carries as `to_status`. Entries are lower-cased on save
 * because the native `on_stage_changed` rule compares case-insensitively
 * (`./apply-rules`), and the SQL side lower-cases the incoming stage, so
 * both sides compare like with like.
 *
 * Pure: no database, no React.
 *
 * @module lib/workflows/exit-rules
 */

/** How many stages one workflow may list. Far above any real pipeline. */
export const MAX_EXIT_STATUSES = 50

/**
 * The stored form of an exit list: trimmed, lower-cased, no blanks, no
 * repeats, in the order given.
 *
 * @param statuses - stage slugs as the builder sent them
 */
export function normaliseExitStatuses(statuses: readonly string[]): string[] {
  const out: string[] = []
  for (const raw of statuses) {
    const slug = raw.trim().toLowerCase()
    if (slug && !out.includes(slug)) out.push(slug)
  }
  return out
}

/** Read a string field out of a jsonb object, or '' when absent. */
function field(obj: unknown, key: string): string {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return ''
  const value = (obj as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * Which stage a workflow's own apply rule starts it on.
 *
 * - `null`: the rule never starts it on a stage change.
 * - `'*'`: it starts on a move into any stage.
 * - otherwise the stage slug, lower-cased.
 *
 * Two stored forms mean "when the couple moves to a stage": the native
 * `on_stage_changed` rule (`{ toStatus }`), and the builder's `on_event`
 * nesting the `couple_stage_changed` trigger
 * (`{ eventType, triggerConfig: { toStatus } }`). They differ on a blank
 * stage: the native rule never fires unconfigured, while the trigger
 * with no stage chosen fires on every move.
 */
export function applyStage(applyRuleType: string, applyRuleConfig: unknown): string | null {
  if (applyRuleType === 'on_stage_changed') {
    return field(applyRuleConfig, 'toStatus') || null
  }
  if (applyRuleType === 'on_event' && field(applyRuleConfig, 'eventType') === 'couple_stage_changed') {
    const trigger = (applyRuleConfig as Record<string, unknown>)['triggerConfig']
    return field(trigger, 'toStatus') || '*'
  }
  return null
}

/**
 * Why this combination of apply rule and exit list cannot be saved, in
 * the MC's words, or null when it can.
 *
 * A workflow that starts when a couple moves to a stage and also stops
 * then is a contradiction, so a concrete overlap is refused at save.
 *
 * A stage trigger with no stage chosen (it starts on a move into any
 * stage) is allowed alongside stop stages. The picker seeds exactly that
 * blank config when the MC first picks "Couple stage changed", and
 * refusing it would leave them no way to go on and choose the stage. The
 * contradiction is closed where it matters instead: the dispatcher never
 * starts a workflow on one of its own exit stages ({@link isOwnExitStage}).
 *
 * @param rule - the stored apply rule type and config
 * @param exitStatuses - the exit list, in any case
 * @param nameFor - a stage slug's display name; defaults to the slug
 */
export function exitRuleConflict(
  rule: { applyRuleType: string; applyRuleConfig: unknown },
  exitStatuses: readonly string[],
  nameFor: (slug: string) => string = (slug) => slug,
): string | null {
  const exits = normaliseExitStatuses(exitStatuses)
  if (exits.length === 0) return null
  const starts = applyStage(rule.applyRuleType, rule.applyRuleConfig)
  // `'*'` (any stage) is never a save-time conflict; see above.
  if (starts === null || starts === '*') return null
  if (!exits.includes(starts)) return null
  const name = nameFor(starts)
  return (
    `This workflow starts when a couple moves to ${name}, so it cannot also stop then. ` +
    `Remove ${name} from the stop stages, or change what starts it.`
  )
}

/** The event fields {@link isOwnExitStage} reads. */
export interface StageEventLike {
  event_type: string
  payload: unknown
}

/**
 * Does this event move the couple into one of the workflow's own exit
 * stages?
 *
 * The dispatcher's match-time half of the contradiction rule: whatever
 * was saved (a blank "any stage" trigger, or a row written around the
 * save check), a workflow is never started on a stage that stops it.
 *
 * @param event - a bus event
 * @param exitStatuses - the workflow's `exit_statuses`
 */
export function isOwnExitStage(event: StageEventLike, exitStatuses: readonly string[]): boolean {
  if (event.event_type !== 'couple_stage_changed' || exitStatuses.length === 0) return false
  const to = field(event.payload, 'to_status')
  return to !== '' && normaliseExitStatuses(exitStatuses).includes(to)
}
