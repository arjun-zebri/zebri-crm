/**
 * Admin audit-log writer.
 *
 * Phase 13. Wraps the service-role Supabase client so that every
 * mutating admin server action records itself in
 * `public.admin_audit_log` (migration 20260531000000). The log row
 * captures actor, target, action, and an arbitrary `details` jsonb
 * payload (before/after entitlements, refund amounts, comp plans,
 * etc.).
 *
 * The helper is **failure-tolerant** — if the audit insert fails we
 * fire a Slack `app_error` alert and swallow the error rather than
 * propagating it to the caller. Blocking a legitimate admin action
 * because the audit table is unreachable would be worse than
 * shipping the action without a record.
 *
 * @module lib/admin/audit
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';

import { sendAlert } from '@/lib/alerts';
import type { Database } from '@/types/database';

/**
 * Stable string identifiers for the actions we record. Adding a new
 * action means picking a new literal here — keep the set small and
 * grep-friendly so the audit log stays useful for post-incident
 * forensics.
 */
export type AdminActionType =
  | 'enter_shadow'
  | 'exit_shadow'
  | 'comp_user'
  | 'extend_trial'
  | 'cancel_at_period_end'
  | 'link_stripe_customer'
  | 'refund_last_invoice'
  | 'update_user_profile'
  | 'send_password_reset'
  | 'delete_user';

export interface RecordAdminActionInput {
  /** The admin who performed the action — required. */
  actorId: string;
  /** The user the action targeted — null for actions with no
   *  target (none today, but kept open for future). */
  targetUserId: string | null;
  action: AdminActionType;
  /** Arbitrary action-specific payload. Avoid putting secrets in
   *  here — the log is readable by any admin. */
  details?: Record<string, unknown>;
}

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Insert a row into `admin_audit_log`. Best-effort: on failure
 * dispatches an `app_error` alert and returns `false`. Never throws.
 *
 * Call this AFTER the underlying admin action succeeds — recording
 * an action that didn't actually happen would be worse than no
 * record at all.
 */
export async function recordAdminAction(
  input: RecordAdminActionInput,
): Promise<boolean> {
  try {
    const admin = serviceClient();
    const { error } = await admin.from('admin_audit_log').insert({
      actor_id: input.actorId,
      target_user_id: input.targetUserId,
      action: input.action,
      details: (input.details ?? {}) as Database['public']['Tables']['admin_audit_log']['Insert']['details'],
    });
    if (error) {
      await sendAlert({
        type: 'app_error',
        severity: 'error',
        source: 'admin.audit',
        message: `admin_audit_log insert failed for action=${input.action}: ${error.message}`,
      });
      return false;
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'admin.audit',
      message: `admin_audit_log threw for action=${input.action}: ${message}`,
    });
    return false;
  }
}
