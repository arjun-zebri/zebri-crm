/**
 * Server-only reads of a lead form's ingest config. Uses the service-role
 * admin client so the allowlist and the block tree are never granted to anon:
 * the public endpoints forward only what `fields.ts` derives from them.
 *
 * Never import from a `'use client'` file.
 *
 * @module lib/lead-capture/load-config
 */
// eslint-disable-next-line no-restricted-imports
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import { createAdminClient } from '@/lib/supabase/admin';

/** What the submit and config routes need to know about a token. */
export type LeadFormConfig =
  | { found: false }
  | { found: true; enabled: boolean; allowedOrigins: string[]; blocks: Block[] | null };

/**
 * Look up a form by capture token. `token` must already be a validated UUID
 * (a non-UUID would make Postgres raise on the comparison).
 */
export async function loadLeadFormConfig(token: string): Promise<LeadFormConfig> {
  const admin = createAdminClient();
  const form = await admin
    .from('lead_capture_forms')
    .select('user_id, enabled, allowed_origins')
    .eq('capture_token', token)
    .maybeSingle();
  if (form.error) throw new Error(form.error.message);
  if (!form.data) return { found: false };

  const branding = await admin
    .from('user_branding')
    .select('branding_blocks')
    .eq('user_id', form.data.user_id)
    .maybeSingle();
  if (branding.error) throw new Error(branding.error.message);
  const tree = (branding.data?.branding_blocks as { lead?: unknown } | null)?.lead;

  return {
    found: true,
    enabled: form.data.enabled,
    allowedOrigins: form.data.allowed_origins ?? [],
    blocks: Array.isArray(tree) ? (tree as Block[]) : null,
  };
}

/**
 * Whether any form has registered `origin`. Backs the CORS preflight, which
 * carries no token. One GIN-indexed containment query.
 */
export async function isOriginRegistered(origin: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('lead_capture_forms')
    .select('id', { count: 'exact', head: true })
    .contains('allowed_origins', [origin]);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
