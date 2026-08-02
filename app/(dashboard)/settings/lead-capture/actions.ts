/**
 * Server actions for the Lead Capture settings section. The form row is one
 * per MC (unique user_id); `ensureLeadForm` lazily creates it on first open.
 *
 * @module app/(dashboard)/settings/lead-capture/actions
 */
'use server';

import { createClient } from '@/lib/supabase/server';

export interface LeadFormState {
  token: string;
  enabled: boolean;
  targetStatusSlug: string | null;
}

/** Return the caller's lead-capture form, creating it if absent. */
export async function ensureLeadForm(): Promise<LeadFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('Not authenticated');

  const existing = await supabase
    .from('lead_capture_forms')
    .select('capture_token, enabled, target_status_slug')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing.data) {
    return {
      token: existing.data.capture_token,
      enabled: existing.data.enabled,
      targetStatusSlug: existing.data.target_status_slug,
    };
  }

  const created = await supabase
    .from('lead_capture_forms')
    .insert({ user_id: user.id })
    .select('capture_token, enabled, target_status_slug')
    .single();
  if (created.error || !created.data) {
    throw new Error(created.error?.message ?? 'Could not create lead form');
  }
  return {
    token: created.data.capture_token,
    enabled: created.data.enabled,
    targetStatusSlug: created.data.target_status_slug,
  };
}

/** Persist the enable toggle + chosen landing status. */
export async function saveLeadCaptureSettings(input: {
  enabled: boolean;
  targetStatusSlug: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('lead_capture_forms')
    .update({ enabled: input.enabled, target_status_slug: input.targetStatusSlug })
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
