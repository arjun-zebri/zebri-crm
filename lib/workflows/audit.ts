/**
 * Workflow audit trail.
 *
 * Every instance creation and step transition writes one row to
 * `workflow_audit_log`. The couple profile's activity section reads it,
 * and it is the only durable record of what the engine did once a step's
 * own status has moved on.
 *
 * Writes go through a service-role client: the table has a SELECT-only
 * policy, the same access model as `contract_audit_log`.
 *
 * @module lib/workflows/audit
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/database';

/** One audit entry. `detail` is free-form and rendered by the narrator. */
export interface AuditEntry {
  userId: string;
  instanceId: string;
  stepId?: string | null;
  coupleId?: string | null;
  event:
    | 'instance_created'
    | 'instance_completed'
    | 'instance_cancelled'
    | 'instance_paused'
    | 'instance_resumed'
    | 'step_started'
    | 'step_completed'
    | 'step_skipped'
    | 'step_errored'
    | 'step_waiting'
    | 'step_added'
    | 'step_approved'
    | 'step_rescheduled'
    | 'step_retry_scheduled'
    | 'branch_taken';
  detail?: Json;
}

/**
 * Append one entry to the audit log.
 *
 * Never throws. An audit write failing must not abort the step execution
 * that produced it: losing a log line is a far smaller problem than
 * leaving a half-executed step behind.
 */
export async function writeAudit(
  supabase: SupabaseClient<Database>,
  entry: AuditEntry,
): Promise<void> {
  await writeAuditMany(supabase, [entry]);
}

/**
 * Append many entries in one round trip.
 *
 * For the callers that transition a batch of steps at once (the stuck
 * sweep). One insert rather than one per row: a sweep that recovers a
 * few thousand steps would otherwise spend the tick's budget on audit
 * writes alone. Every row carries the same keys, which supabase-js
 * requires of an array insert.
 *
 * Never throws, for the same reason as {@link writeAudit}.
 */
export async function writeAuditMany(
  supabase: SupabaseClient<Database>,
  entries: AuditEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const { error } = await supabase.from('workflow_audit_log').insert(
      entries.map((entry) => ({
        user_id: entry.userId,
        instance_id: entry.instanceId,
        step_id: entry.stepId ?? null,
        couple_id: entry.coupleId ?? null,
        event: entry.event,
        detail: entry.detail ?? {},
      })),
    );
    if (error) {
      console.error('[workflows] audit write failed', entries.length, error.message);
    }
  } catch (err) {
    console.error('[workflows] audit write threw', entries.length, err);
  }
}
