/**
 * Server actions for the couple-profile tab layout (the gear "settings mode"
 * in the couple profile modal).
 *
 * Reads/writes the single per-user `couple_profile_tabs_config` JSON on
 * `user_public_settings` (one row per MC, existing owner RLS). The layout is
 * global across couples — there is no couple id here.
 *
 * The `couple_profile_tabs_config` column ships in
 * `20260627000000_add_couple_profile_tabs_config.sql` and only exists on the
 * database after CI deploy. The dev server points at remote Supabase, so until
 * then the read tolerates a missing column (returns the default config) and a
 * write surfaces a friendly error rather than throwing.
 *
 * @module app/(dashboard)/couples/profile-settings-actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';

import {
  DEFAULT_TABS_CONFIG,
  SECTION_KEYS,
  type CoupleProfileSection,
  type CoupleProfileTabsConfig,
} from './couple-profile-types';

/** Tagged result; `data` is always a usable config on the success path. */
export type TabsConfigResult =
  | { ok: true; data: CoupleProfileTabsConfig }
  | { ok: false; error: string };

const KEY_SET = new Set<string>(SECTION_KEYS);

/** Type guard: is `v` a known tab key? */
function isSectionKey(v: unknown): v is CoupleProfileSection {
  return typeof v === 'string' && KEY_SET.has(v);
}

/** Strict write schema: rejects nonsense before it reaches the DB. */
const writeSchema = z
  .object({
    hidden_tabs: z.array(z.custom<CoupleProfileSection>(isSectionKey)),
    tab_order: z.array(z.custom<CoupleProfileSection>(isSectionKey)),
  })
  .refine((c) => !c.hidden_tabs.includes('overview'), 'Overview cannot be hidden.')
  .refine((c) => new Set(c.tab_order).size === c.tab_order.length, 'Duplicate tab in order.');

/**
 * Lenient read coercion: salvage a usable config from whatever JSON is stored
 * (partial rows, keys from an older tab set, etc.). The client derive layer
 * tolerates further drift, so reads never hard-fail.
 */
function coerceConfig(raw: unknown): CoupleProfileTabsConfig {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const keys = (v: unknown): CoupleProfileSection[] =>
    Array.isArray(v) ? v.filter(isSectionKey) : [];
  return {
    hidden_tabs: keys(obj.hidden_tabs).filter((k) => k !== 'overview'),
    tab_order: keys(obj.tab_order),
  };
}

/** Resolve the signed-in user + RLS client, or a tagged error. */
async function authedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Session expired. Please log in again.' };
  return { ok: true as const, supabase, userId: user.id };
}

/**
 * Read this MC's couple-profile tab layout. Always returns a usable config:
 * the stored one, or {@link DEFAULT_TABS_CONFIG} when there is no row yet (or
 * the column is not deployed).
 */
export async function readCoupleProfileTabsConfigAction(): Promise<TabsConfigResult> {
  const auth = await authedUser();
  if (!auth.ok) return { ok: true, data: DEFAULT_TABS_CONFIG };

  const { data, error } = await auth.supabase
    .from('user_public_settings')
    .select('couple_profile_tabs_config')
    .eq('user_id', auth.userId)
    .maybeSingle();

  // Missing column (pre-deploy) or missing row → fall back to defaults.
  if (error || !data) return { ok: true, data: DEFAULT_TABS_CONFIG };
  return { ok: true, data: coerceConfig(data.couple_profile_tabs_config) };
}

/**
 * Persist this MC's couple-profile tab layout. Validates the layout (Overview
 * never hidden, no duplicate order, default stays visible) and upserts the one
 * per-user row.
 */
export async function updateCoupleProfileTabsConfigAction(
  input: CoupleProfileTabsConfig,
): Promise<TabsConfigResult> {
  const parsed = writeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid tab settings.' };

  const auth = await authedUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase
    .from('user_public_settings')
    .upsert(
      {
        user_id: auth.userId,
        couple_profile_tabs_config: parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    logger.error('[couples/profile-settings] save tabs config failed', error, { userId: auth.userId });
    return { ok: false, error: 'Could not save tab settings. Please try again.' };
  }
  return { ok: true, data: parsed.data };
}
