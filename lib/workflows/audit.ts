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
    | 'step_started'
    | 'step_completed'
    | 'step_skipped'
    | 'step_errored'
    | 'step_waiting'
    | 'step_added'
    | 'step_approved'
    | 'step_rescheduled'
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
  try {
    const { error } = await supabase.from('workflow_audit_log').insert({
      user_id: entry.userId,
      instance_id: entry.instanceId,
      step_id: entry.stepId ?? null,
      couple_id: entry.coupleId ?? null,
      event: entry.event,
      detail: entry.detail ?? {},
    });
    if (error) {
      console.error('[workflows] audit write failed', entry.event, error.message);
    }
  } catch (err) {
    console.error('[workflows] audit write threw', entry.event, err);
  }
}
