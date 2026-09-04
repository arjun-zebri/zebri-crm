/**
 * Server actions for the Lead Capture settings section. The form row is one
 * per MC (unique user_id); `ensureLeadForm` lazily creates it on first open.
 *
 * @module app/(dashboard)/settings/lead-capture/actions
 */
'use server';

import { z } from 'zod';

import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import {
  MAX_ALLOWED_ORIGINS,
  originFromWebsite,
  parseAllowedOrigin,
  withWwwSibling,
} from '@/lib/lead-capture/cors';
import { leadFormFields, type PublicLeadField } from '@/lib/lead-capture/fields';
import { createClient } from '@/lib/supabase/server';

export interface LeadFormState {
  token: string;
  enabled: boolean;
  targetStatusSlug: string | null;
  /** Browser origins allowed to post to the API. Empty means browser posts are refused. */
  allowedOrigins: string[];
  /** The public field list, as `GET /api/lead/config` would report it. Feeds the AI prompt. */
  fields: PublicLeadField[];
}

const FORM_COLUMNS = 'capture_token, enabled, target_status_slug, allowed_origins';

/** The caller's saved `lead` block tree, or null when not customised. */
async function loadLeadBlocks(userId: string): Promise<Block[] | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('user_branding').select('branding_blocks').eq('user_id', userId).maybeSingle();
  const tree = (data?.branding_blocks as { lead?: unknown } | null)?.lead;
  return Array.isArray(tree) ? (tree as Block[]) : null;
}

/** Return the caller's lead-capture form, creating it if absent. */
export async function ensureLeadForm(): Promise<LeadFormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('Not authenticated');

  let row = (
    await supabase.from('lead_capture_forms').select(FORM_COLUMNS).eq('user_id', user.id).maybeSingle()
  ).data;

  if (!row) {
    const created = await supabase
      .from('lead_capture_forms')
      .insert({ user_id: user.id })
      .select(FORM_COLUMNS)
      .single();
    if (created.error || !created.data) {
      throw new Error(created.error?.message ?? 'Could not create lead form');
    }
    row = created.data;
  }

  // An empty allowlist refuses every browser post, so an MC who has told us
  // their website gets it filled in rather than discovering the refusal from
  // their own site. Seeded whenever the list is empty (not only at creation)
  // so accounts that predate this also benefit; the help text says so.
  let allowedOrigins = row.allowed_origins ?? [];
  if (allowedOrigins.length === 0) {
    const seeded = originFromWebsite(
      typeof user.user_metadata?.website === 'string' ? user.user_metadata.website : null,
    );
    if (seeded) {
      // Both www and apex: the MC typed one, and a browser will send whichever
      // their site actually serves.
      const pair = withWwwSibling(seeded);
      const { error } = await supabase
        .from('lead_capture_forms')
        .update({ allowed_origins: pair })
        .eq('user_id', user.id);
      if (!error) allowedOrigins = pair;
    }
  }

  return {
    token: row.capture_token,
    enabled: row.enabled,
    targetStatusSlug: row.target_status_slug,
    allowedOrigins,
    fields: leadFormFields(await loadLeadBlocks(user.id)),
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

const originsInputSchema = z.array(z.string().max(300)).max(MAX_ALLOWED_ORIGINS);

/**
 * Replace the form's CORS allowlist. Every entry is normalised to
 * `scheme://host[:port]`; the first invalid entry rejects the whole save so
 * the stored list is never half-updated.
 */
export async function saveAllowedOrigins(
  origins: string[],
): Promise<{ ok: true; origins: string[] } | { ok: false; error: string }> {
  const shape = originsInputSchema.safeParse(origins);
  if (!shape.success) return { ok: false, error: `Up to ${MAX_ALLOWED_ORIGINS} domains.` };

  const normalised: string[] = [];
  for (const raw of shape.data) {
    const parsed = parseAllowedOrigin(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    if (!normalised.includes(parsed.origin)) normalised.push(parsed.origin);
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('lead_capture_forms')
    .update({ allowed_origins: normalised })
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, origins: normalised };
}
