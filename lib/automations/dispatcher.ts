/**
 * Event dispatcher.
 *
 * One half of the tick. Reads a batch of unprocessed
 * `automation_events` and matches each against the user's active
 * automations. For every match, opens an `automation_runs` row
 * (idempotent - the unique constraint `(automation_id, event_id)`
 * guarantees a single event can't double-fire one automation).
 *
 * The dispatcher does NOT execute any actions - that's the
 * runner's job. Separating the two stages keeps each tick's hot
 * loop simple and lets us reason about backpressure cleanly:
 * unmatched events still get marked processed so the partial
 * index stays small.
 *
 * @module lib/automations/dispatcher
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'
import type {
  AutomationEventRow,
  AutomationRow,
  AutomationRunRow,
  TriggerType,
} from '@/types/automations'

import { getTriggerSpec } from './triggers'

export interface DispatchResult {
  matchedAutomations: number
  openedRuns: number
  processedEvents: number
}

/**
 * Pull up to `limit` unprocessed events from the bus, match them
 * against each event's owner's active automations, and open runs.
 */
export async function dispatchPendingEvents(
  supabase: SupabaseClient<Database>,
  limit = 500,
): Promise<DispatchResult> {
  const { data: events } = await supabase
    .from('automation_events' as never)
    .select('id, user_id, source_table, source_id, event_type, payload, couple_id, created_at, processed_at, error_message')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(limit)

  const rows = (events ?? []) as AutomationEventRow[]
  let matchedAutomations = 0
  let openedRuns = 0

  for (const event of rows) {
    try {
      const automations = await loadCandidateAutomations(supabase, event.user_id, event.event_type as TriggerType)
      for (const automation of automations) {
        const spec = getTriggerSpec(automation.trigger_type)
        if (!spec) continue
        // Apply the trigger spec's Zod schema before calling match()
        // so optional fields with `.default(0)` etc. resolve to their
        // declared defaults. Without this, an automation saved before
        // the picker started seeding defaults (or one with a missing
        // optional field) would silently fail `match()` for any
        // narrowing predicate that compares against config values.
        const parsed = spec.configSchema.safeParse(automation.trigger_config ?? {})
        if (!parsed.success) continue
        if (!spec.match(event, parsed.data)) continue
        matchedAutomations += 1
        const opened = await openRun(supabase, automation, event)
        if (opened) openedRuns += 1
      }
      await markProcessed(supabase, event.id)
    } catch (err) {
      await markProcessed(supabase, event.id, describeError(err))
    }
  }

  return { matchedAutomations, openedRuns, processedEvents: rows.length }
}

async function loadCandidateAutomations(
  supabase: SupabaseClient<Database>,
  userId: string,
  triggerType: TriggerType,
): Promise<AutomationRow[]> {
  const { data } = await supabase
    .from('automations' as never)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('trigger_type', triggerType)
  return (data ?? []) as AutomationRow[]
}

/**
 * Open a run for the matched (automation, event) pair. Returns
 * true if a new run was inserted, false if the unique constraint
 * said "already done" (idempotency).
 */
async function openRun(
  supabase: SupabaseClient<Database>,
  automation: AutomationRow,
  event: AutomationEventRow,
): Promise<boolean> {
  // Find the first action (lowest position, no parent).
  const { data: firstAction } = await supabase
    .from('automation_actions' as never)
    .select('id')
    .eq('automation_id', automation.id)
    .is('parent_action_id', null)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase
    .from('automation_runs' as never)
    .insert({
      automation_id: automation.id,
      event_id: event.id,
      user_id: event.user_id,
      couple_id: event.couple_id,
      status: 'running',
      current_action_id: (firstAction as { id?: string } | null)?.id ?? null,
      last_payload: { trigger_payload: event.payload, action_results: {} },
    } as never)

  if (error) {
    // 23505 = unique violation - the (automation_id, event_id) pair
    // already has a run. Treat as idempotent no-op.
    if ((error as { code?: string }).code === '23505') return false
    throw error
  }
  return true
}

/**
 * Coerce any thrown value into a readable string for
 * `automation_events.error_message`. Supabase JS errors are plain
 * objects with `code` + `message` and aren't `Error` instances, so
 * the prior `err instanceof Error ? err.message : 'unknown'` lost
 * the actual failure (PostgREST schema cache misses, RLS denials,
 * etc.) — they all stored literally `'unknown'`.
 */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err !== null) {
    const o = err as { code?: unknown; message?: unknown; details?: unknown }
    const parts: string[] = []
    if (o.code) parts.push(`[${String(o.code)}]`)
    if (o.message) parts.push(String(o.message))
    if (o.details) parts.push(`(${String(o.details)})`)
    if (parts.length > 0) return parts.join(' ')
  }
  return 'unknown'
}

async function markProcessed(
  supabase: SupabaseClient<Database>,
  eventId: string,
  errorMessage?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { processed_at: new Date().toISOString() }
  if (errorMessage) patch.error_message = errorMessage
  await supabase.from('automation_events' as never).update(patch as never).eq('id', eventId)
}
