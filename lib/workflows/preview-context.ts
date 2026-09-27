/**
 * The run context the builder's Compose email preview renders against.
 *
 * A workflow template belongs to no couple, so its email has nobody to
 * be rendered for. The preview borrows the MC's own real couple when
 * they have one (the email then reads exactly as it will for them), and
 * otherwise a clearly labelled sample couple. The MC half of the context
 * is always the real one, read the way the send reads it, so the
 * branding, signature and footer identity are the MC's own.
 *
 * @module lib/workflows/preview-context
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildRunContext, loadMcSnapshot } from '@/lib/automations/context';
import { buildSampleContext } from '@/lib/email/template-variables';
import type { AutomationEventRow, AutomationRunRow, RunContext } from '@/types/automations';
import type { Database } from '@/types/database';

/**
 * Build the context for previewing a draft email.
 *
 * The caller proves ownership of `coupleId` with the MC's own RLS client
 * BEFORE calling this: `admin` is only here because the MC half of the
 * context (signature, branding) is read from the auth record, exactly as
 * the send reads it.
 *
 * @param admin - Service-role client, for the MC's auth record.
 * @param userId - The MC.
 * @param coupleId - An owned couple to render for, or null for the sample.
 */
export async function buildComposePreviewContext(
  admin: SupabaseClient<Database>,
  userId: string,
  coupleId: string | null,
): Promise<RunContext> {
  if (coupleId === null) {
    const sample = buildSampleContext();
    return { ...sample, userId, mc: await loadMcSnapshot(admin, userId) };
  }

  // Shaped like a manually applied workflow's first step: no triggering
  // event, so invoice and link variables resolve from the couple's own
  // records, as they would when the MC applies the workflow to them.
  const now = new Date().toISOString();
  const event: AutomationEventRow = {
    id: coupleId,
    user_id: userId,
    source_table: 'couples',
    source_id: coupleId,
    event_type: 'manual_fire',
    payload: {},
    couple_id: coupleId,
    created_at: now,
    processed_at: null,
    error_message: null,
  };
  const run: AutomationRunRow = {
    id: coupleId,
    automation_id: coupleId,
    event_id: coupleId,
    user_id: userId,
    couple_id: coupleId,
    status: 'running',
    current_action_id: null,
    started_at: now,
    completed_at: null,
    error_message: null,
    last_payload: { action_results: {} },
  };
  return buildRunContext(admin, run, event);
}
