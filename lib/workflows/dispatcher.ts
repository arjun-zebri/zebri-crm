/**
 * Event dispatcher.
 *
 * The first half of the tick. Reads a batch of bus events and matches
 * each against the owner's active workflow templates. Every match applies
 * the template to the event's couple, creating an instance.
 *
 * The dispatcher executes nothing: that is the executor's job. Keeping
 * the two stages separate is what makes each tick's hot loop simple and
 * backpressure easy to reason about.
 *
 * # Marking events processed
 *
 * This engine owns `automation_events.processed_at`. During the dual-run
 * window it could not: the old dispatcher owned that column, and two
 * writers would have starved each other, so progress went into
 * `workflow_dispatched_events`. With the automations engine gone, the
 * column is back to being the single record of what has been handled.
 * The guard table is kept until the legacy tables drop, so a rollback
 * still has somewhere to look.
 *
 * @module lib/workflows/dispatcher
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AutomationEventRow } from '@/types/automations';
import type { Database } from '@/types/database';
import type { WorkflowTemplateRow } from '@/types/workflows';

import { getApplyRuleSpec } from './apply-rules';
import { completeBookedAppointmentSteps } from './appointments';
import { applyTemplate } from './instantiate';

export interface DispatchResult {
  processedEvents: number;
  matchedTemplates: number;
  openedInstances: number;
  /** Appointment steps a Scheduler booking completed on this pass. */
  appointmentsCompleted: number;
}

/**
 * Match pending bus events against active templates and open instances.
 *
 * @param supabase - a service-role client; this runs from the cron tick
 * @param limit - how many events to consider this tick
 * @param opts.userId - only this owner's events. Set by the immediate
 *   kick a mutation fires for the MC who caused it (`./kick`), so one
 *   MC adding a couple never pays for another tenant's backlog. The
 *   cron leaves it unset and sweeps everyone.
 * @param opts.since - only events emitted at or after this ISO
 *   timestamp. Also the kick's: the batch is oldest-first, so without a
 *   window a long backlog fills the whole limit with history and the
 *   event the MC just caused - the one they are watching for - is the
 *   one that does not get dispatched. The cron leaves it unset and
 *   works the backlog down.
 */
export async function dispatchPendingEvents(
  supabase: SupabaseClient<Database>,
  limit = 500,
  opts: { userId?: string; since?: string } = {},
): Promise<DispatchResult> {
  const events = await loadUndispatchedEvents(supabase, limit, opts);

  let matchedTemplates = 0;
  let openedInstances = 0;
  let appointmentsCompleted = 0;

  for (const event of events) {
    try {
      // A booking can satisfy an appointment step that is already
      // running, as well as opening a new workflow. Do it first, so the
      // executor sees the steps it released on this same tick.
      appointmentsCompleted += await completeBookedAppointmentSteps(supabase, event);

      const templates = await loadCandidateTemplates(supabase, event.user_id);
      for (const template of templates) {
        const spec = getApplyRuleSpec(template.apply_rule_type);
        if (!spec) continue;
        // matchesRaw parses the stored config through the rule's own
        // schema first. A config that fails to parse simply does not
        // match, rather than throwing and stalling the whole batch.
        if (!spec.matchesRaw(event, template.apply_rule_config)) continue;

        matchedTemplates += 1;
        const result = await applyTemplate(supabase, {
          userId: event.user_id,
          templateId: template.id,
          coupleId: event.couple_id,
          triggerEventId: event.id,
          // An automatic re-apply means duplicate emails. The manual
          // picker is the only path that may apply a template twice.
          dedupe: true,
        });
        if ('instanceId' in result) openedInstances += 1;
      }
    } catch (err) {
      // One bad event must not stall the batch. Mark it seen so it does
      // not jam the queue on every subsequent tick.
      console.error('[workflows] dispatch failed for event', event.id, err);
    }
    await markDispatched(supabase, event.id);
  }

  return {
    processedEvents: events.length,
    matchedTemplates,
    openedInstances,
    appointmentsCompleted,
  };
}

/** Bus events this engine has not handled yet, oldest first. */
async function loadUndispatchedEvents(
  supabase: SupabaseClient<Database>,
  limit: number,
  opts: { userId?: string; since?: string },
): Promise<AutomationEventRow[]> {
  let query = supabase
    .from('automation_events')
    .select('*')
    // Oldest first, so a template that opens on one event and a step
    // that reads its result stay in the order they happened.
    .order('created_at', { ascending: true })
    .is('processed_at', null)
    .limit(limit);

  if (opts.userId) query = query.eq('user_id', opts.userId);
  if (opts.since) query = query.gte('created_at', opts.since);

  const { data } = await query;

  return (data ?? []) as unknown as AutomationEventRow[];
}

/** A user's templates that could match anything. */
async function loadCandidateTemplates(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WorkflowTemplateRow[]> {
  // Loaded by (user, status) rather than by apply_rule_type: `on_event`
  // can match any bus event type, so narrowing on the rule slug in SQL
  // would not reduce the candidate set for the rule that needs it most.
  // The partial index on (user_id, apply_rule_type) where status='active'
  // still keeps this cheap.
  const { data } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('apply_rule_type', 'manual');
  return (data ?? []) as unknown as WorkflowTemplateRow[];
}

/** Record that the event has been handled, so no later tick re-runs it. */
async function markDispatched(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<void> {
  await supabase
    .from('automation_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', eventId);
}
