/**
 * Event dispatcher.
 *
 * The first half of the tick. Reads a batch of bus events and matches
 * each against the owner's active workflow templates. Every match applies
 * the template to the event's couple, creating an instance. A stage
 * change first stops the workflows that list the new stage as an exit
 * (`./exit-dispatch`).
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

import { sendAlert } from '@/lib/alerts/send-alert';
import type { AutomationEventRow } from '@/types/automations';
import type { Database } from '@/types/database';
import type { WorkflowTemplateRow } from '@/types/workflows';

import { getApplyRuleSpec } from './apply-rules';
import { completeBookedAppointmentSteps } from './appointments';
import { applyExitRules, reportExitFailure } from './exit-dispatch';
import { isOwnExitStage } from './exit-rules';
import { recordHeartbeat, STALE_EVENT_MS, STALE_EVENTS_HEARTBEAT } from './heartbeat';
import { applyTemplate } from './instantiate';
import { isWorkflowReadError, throwIfReadFailed } from './read-failure';

/**
 * Re-exported: both constants are the dispatcher's, but live in
 * `./heartbeat` so the Admin card (a client component) can read them
 * without pulling the dispatcher into the browser bundle.
 */
export { STALE_EVENT_MS, STALE_EVENTS_HEARTBEAT } from './heartbeat';

export interface DispatchResult {
  processedEvents: number;
  matchedTemplates: number;
  openedInstances: number;
  /** Appointment steps a Scheduler booking completed on this pass. */
  appointmentsCompleted: number;
  /** Instances an exit rule stopped because their couple changed stage. */
  exitedInstances: number;
  /**
   * Events whose exit call failed. Each is left unprocessed, so the next
   * tick retries it whole, until it works or turns stale.
   */
  exitFailures: number;
  /** True when the deadline stopped the pass before the batch was done. */
  truncated: boolean;
  /** Events older than {@link STALE_EVENT_MS} marked skipped, not dispatched. */
  staleEvents: number;
  /**
   * Matches refused because the template was turned off between the
   * candidate load and the insert. A quiet skip: no error, no retry.
   */
  skippedOffTemplates: number;
  /**
   * Events left unprocessed because a read they depended on failed (a
   * {@link WorkflowReadError}). The next tick retries each whole, like an
   * exit failure, until it works or turns stale. The tick alerts on it.
   */
  readFailures: number;
  /** The first read failure's site, for the tick's alert. Null when none. */
  readFailureSite: string | null;
}


/**
 * One `workflow_events_stale` alert per scope per ten minutes, the
 * `workflow_send_cap_unreadable` window. The sweep is one statement, so
 * after an outage the whole pile goes in one batch and one alert; what
 * trickles in afterwards (an event whose exit keeps failing until it
 * ages out) would otherwise post once a minute.
 */
const STALE_ALERT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Per scope (an MC id for the kick, `*` for the cron sweep): when the
 * last alert went, and how many skipped events have gone unalerted since.
 * In memory, like the send-cap dedupe: a second alert after a cold start
 * is noise, not harm.
 */
const staleAlertState = new Map<string, { lastAt: number; suppressed: number }>();

/**
 * Stamp every unread event older than the replay window as skipped.
 * One statement, before the batch is loaded, so a stale pile never
 * costs the tick a round trip per event.
 */
async function skipStaleEvents(
  supabase: SupabaseClient<Database>,
  opts: { userId?: string },
): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_EVENT_MS).toISOString();
  let query = supabase
    .from('automation_events')
    .update(
      {
        processed_at: new Date().toISOString(),
        error_message: `skipped: stale (older than ${STALE_EVENT_MS / 3_600_000}h when first read)`,
      },
      { count: 'exact' },
    )
    .is('processed_at', null)
    .lt('created_at', cutoff);
  if (opts.userId) query = query.eq('user_id', opts.userId);
  const { count, error } = await query;
  if (error) throw new Error(`skip stale events: ${error.message}`);
  const skipped = count ?? 0;
  if (skipped > 0) await reportStaleEvents(supabase, skipped, opts.userId ?? null);
  return skipped;
}

/**
 * Say that events were dropped as stale: a deduped Slack alert with the
 * count, and the record the Admin scheduler card shows. Never throws:
 * the events are already stamped, and failing the dispatch pass over
 * the report would only stop the next batch being dispatched.
 */
async function reportStaleEvents(
  supabase: SupabaseClient<Database>,
  count: number,
  userId: string | null,
): Promise<void> {
  try {
    await recordHeartbeat(supabase, STALE_EVENTS_HEARTBEAT, { count, userId });
  } catch (err) {
    // The alert below is the signal that matters; the card record is the
    // after-the-fact view of it.
    console.error('[workflows] could not record the stale-event skip', err);
  }

  const scope = userId ?? '*';
  const now = Date.now();
  const state = staleAlertState.get(scope);
  if (state && now - state.lastAt < STALE_ALERT_WINDOW_MS) {
    state.suppressed += count;
    return;
  }
  staleAlertState.set(scope, { lastAt: now, suppressed: 0 });
  // Awaited, not left floating: a promise still in flight when a Vercel
  // handler returns may never finish. The Slack transport bounds it.
  await sendAlert({
    type: 'workflow_events_stale',
    severity: 'error',
    count,
    suppressed: state?.suppressed ?? 0,
    userId,
  }).catch(() => undefined);
}

/** Test-only: forget every scope's stale-alert dedupe state. */
export function _resetStaleAlertDedupForTest(): void {
  staleAlertState.clear();
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
 * @param opts.deadline - epoch ms; events not reached stay unprocessed for
 *   the next tick.
 */
export async function dispatchPendingEvents(
  supabase: SupabaseClient<Database>,
  limit = 500,
  opts: { userId?: string; since?: string; deadline?: number } = {},
): Promise<DispatchResult> {
  const staleEvents = await skipStaleEvents(supabase, opts);
  const events = await loadUndispatchedEvents(supabase, limit, opts);

  let matchedTemplates = 0;
  let openedInstances = 0;
  let skippedOffTemplates = 0;
  let appointmentsCompleted = 0;
  let exitedInstances = 0;
  let exitFailures = 0;
  let readFailures = 0;
  let readFailureSite: string | null = null;
  let truncated = false;
  let processedEvents = 0;

  for (const event of events) {
    if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
      truncated = true;
      break;
    }
    processedEvents += 1;
    let exitFailed = false;
    let readFailed = false;
    try {
      // A booking can satisfy an appointment step that is already
      // running, as well as opening a new workflow. Do it first, so the
      // executor sees the steps it released on this same tick.
      appointmentsCompleted += await completeBookedAppointmentSteps(supabase, event);

      // Exits before applies, so the event that starts workflow A and
      // stops workflow B does both in this one pass. In its own try: a
      // failed exit must not cost the event its applies, and it leaves
      // the event unprocessed so the next tick retries it. The retry is
      // safe to run whole: the exit statement only matches running and
      // paused instances, and an apply is unique per (template, event)
      // (`workflow_instances_unique_per_event_idx`), so a second pass
      // starts nothing twice, `allow_reapply` or not. Only a stage change
      // can fail here, and a stage change completes no appointments.
      try {
        exitedInstances += await applyExitRules(supabase, event);
      } catch (err) {
        exitFailed = true;
        exitFailures += 1;
        await reportExitFailure(event, err);
      }

      const templates = await loadCandidateTemplates(supabase, event.user_id);
      for (const template of templates) {
        // Never start a workflow on a stage that stops it, whatever
        // its trigger says: a blank "any stage" trigger is allowed to
        // be saved alongside stop stages (lib/workflows/exit-rules).
        if (isOwnExitStage(event, template.exit_statuses ?? [])) continue;
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
        // Turned off mid-apply is the same quiet skip as turned off
        // before the insert, whichever side of the insert it landed.
        if ('instanceId' in result) {
          if (result.pausedReason === 'template_off') skippedOffTemplates += 1;
          else openedInstances += 1;
        } else if (result.skipped === 'template_off') skippedOffTemplates += 1;
      }
    } catch (err) {
      console.error('[workflows] dispatch failed for event', event.id, err);
      // A read that failed says nothing about the event: marking it seen
      // would drop an enquiry because the database blinked. Left for the
      // next tick instead, like an exit failure, and counted so the tick
      // alerts. Retrying the whole event is safe for the same reasons
      // given above for exits: exits match only live instances,
      // appointment completion only pending steps, and an apply is unique
      // per (template, event).
      if (isWorkflowReadError(err)) {
        readFailed = true;
        readFailures += 1;
        readFailureSite ??= err.site;
      }
      // Anything else is a bad event, and one bad event must not stall
      // the batch. Marked seen so it does not jam every subsequent tick.
    }
    // Left unprocessed on an exit or read failure, for the next tick. The
    // stale sweep (STALE_EVENT_MS, keyed on created_at) caps the retries,
    // and now alerts when it does.
    if (!exitFailed && !readFailed) await markDispatched(supabase, event.id);
  }

  return {
    processedEvents,
    matchedTemplates,
    openedInstances,
    appointmentsCompleted,
    exitedInstances,
    exitFailures,
    truncated,
    staleEvents,
    skippedOffTemplates,
    readFailures,
    readFailureSite,
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

  const { data, error } = await query;
  // Throws, so the tick's guard alerts: an empty batch here would report
  // a clean pass while every enquiry waits.
  throwIfReadFailed('dispatcher.load_events', error);

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
  const { data, error } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('apply_rule_type', 'manual');
  // No templates would mark the event dispatched with nothing opened:
  // the workflow the MC switched on silently never starts for it.
  throwIfReadFailed('dispatcher.load_templates', error);
  return (data ?? []) as unknown as WorkflowTemplateRow[];
}

/**
 * Record that the event has been handled, so no later tick re-runs it.
 *
 * The write's error is not checked, deliberately: if the stamp does not
 * land, the next tick dispatches the event again, which is the same safe
 * retry an exit or read failure takes (every step of it is idempotent),
 * and the stale sweep ends it after a day, with an alert.
 */
async function markDispatched(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<void> {
  await supabase
    .from('automation_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', eventId);
}
