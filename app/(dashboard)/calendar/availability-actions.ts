/**
 * Server actions for availability management.
 *
 * Handles CRUD for availability rules and overrides. Every action:
 *
 * - **Zod-validates** the input so clients cannot corrupt availability
 *   configurations (weekday range, time format, timezone).
 * - **RLS-scoped** Supabase client; the user is the authenticated session.
 * - Returns a tagged `{ ok, data } | { ok: false, error }` result the
 *   hook can pattern-match on.
 *
 * @module app/(dashboard)/calendar/availability-actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

import { availabilityRuleSchema, overrideSchema, timezoneSchema } from './availability-schemas';
import type { AvailabilityRuleInput, OverrideInput, TimezoneInput } from './availability-schemas';

export type {
  AvailabilityRuleInput,
  OverrideInput,
  TimezoneInput,
} from './availability-schemas';

/* ─── Tagged result type ───────────────────────────────────────── */

/**
 * Successful action result carrying typed data.
 */
export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

/**
 * Failed action result carrying an error message.
 */
export interface ActionFailure {
  ok: false;
  error: string;
}

/**
 * Tagged union of success or failure. Pattern-match with `if (result.ok)`.
 */
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/* ─── Schemas ──────────────────────────────────────────────────── */
// Schemas live in ./availability-schemas (a plain module): Next.js allows
// only async-function exports from 'use server' files, so exporting a
// Zod object here crashes the module at runtime.

/* ─── Types ────────────────────────────────────────────────────── */

type AvailabilityRule = Database['public']['Tables']['availability_rules']['Row'];
type AvailabilityOverride = Database['public']['Tables']['availability_overrides']['Row'];

/**
 * Response shape for getAvailabilityAction.
 */
export interface AvailabilityData {
  rules: AvailabilityRule[];
  overrides: AvailabilityOverride[];
  timezone: string | null;
}

/* ─── getAvailabilityAction ────────────────────────────────────── */

/**
 * Fetch the authenticated user's availability rules, overrides, and timezone.
 *
 * @returns { rules, overrides, timezone } or an error
 */
export async function getAvailabilityAction(): Promise<ActionResult<AvailabilityData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Fetch rules.
  const { data: rules, error: rulesError } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('weekday', { ascending: true });

  if (rulesError) {
    logger.error('[calendar/availability-actions] getAvailabilityAction rules failed', rulesError, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not load availability rules.' };
  }

  // Fetch overrides.
  const { data: overrides, error: overridesError } = await supabase
    .from('availability_overrides')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true });

  if (overridesError) {
    logger.error('[calendar/availability-actions] getAvailabilityAction overrides failed', overridesError, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not load availability overrides.' };
  }

  // Fetch timezone from user settings.
  const { data: settings, error: settingsError } = await supabase
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', user.id)
    .single();

  if (settingsError && settingsError.code !== 'PGRST116') {
    logger.error('[calendar/availability-actions] getAvailabilityAction settings failed', settingsError, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not load timezone.' };
  }

  return {
    ok: true,
    data: {
      rules: (rules as AvailabilityRule[]) || [],
      overrides: (overrides as AvailabilityOverride[]) || [],
      timezone: (settings as { timezone: string | null } | null)?.timezone || null,
    },
  };
}

/* ─── saveAvailabilityRulesAction ──────────────────────────────── */

/**
 * Save availability rules and timezone with replace-all semantics.
 *
 * Uses INSERT-first atomicity to preserve old rules if the new insert fails:
 * (1) SELECT existing rule IDs to track what to delete.
 * (2) Bulk-insert new rules (check .error; bail here, old rules stay intact).
 * (3) DELETE old rules by ID; if this fails, return an error asking the user
 *     to re-save (duplicated windows may appear temporarily).
 *
 * Critical: the bulk insert array must have identical keys on every row or
 * PostgREST silently drops rows. Each step checks .error to surface issues.
 *
 * @param rules - array of { weekday, start_time, end_time }
 * @param timezone - IANA timezone string
 * @returns success or error
 */
export async function saveAvailabilityRulesAction(
  rules: AvailabilityRuleInput[],
  timezone: TimezoneInput,
): Promise<ActionResult<void>> {
  // Validate input.
  const rulesValidation = z.array(availabilityRuleSchema).safeParse(rules);
  if (!rulesValidation.success) {
    return { ok: false, error: 'Invalid availability rules.' };
  }
  const tzValidation = timezoneSchema.safeParse(timezone);
  if (!tzValidation.success) {
    return { ok: false, error: 'Invalid timezone.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Step 1: SELECT existing rule IDs so we can delete them after insert succeeds.
  const { data: oldRules, error: selectError } = await supabase
    .from('availability_rules')
    .select('id')
    .eq('user_id', user.id);

  if (selectError) {
    logger.error('[calendar/availability-actions] saveAvailabilityRulesAction select failed', selectError, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not load your current rules.' };
  }

  const oldRuleIds = (oldRules || []).map((r) => r.id);

  // Step 2: Bulk insert new rules FIRST. If this fails, old rules stay intact.
  // Map with consistent keys to avoid PostgREST silent partial insert issue.
  if (rulesValidation.data.length > 0) {
    const rows = rulesValidation.data.map((rule) => ({
      user_id: user.id,
      weekday: rule.weekday,
      start_time: rule.start_time,
      end_time: rule.end_time,
    }));

    const { error: insertError } = await supabase
      .from('availability_rules')
      .insert(rows);

    if (insertError) {
      logger.error('[calendar/availability-actions] saveAvailabilityRulesAction insert failed', insertError, {
        userId: user.id,
        ruleCount: rows.length,
      });
      return { ok: false, error: 'Could not save availability rules.' };
    }
  }

  // Step 3: DELETE old rules now that new ones are safely inserted.
  // If this fails, warn the user but surface the error.
  if (oldRuleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('availability_rules')
      .delete()
      .in('id', oldRuleIds);

    if (deleteError) {
      logger.error('[calendar/availability-actions] saveAvailabilityRulesAction cleanup delete failed', deleteError, {
        userId: user.id,
        oldRuleCount: oldRuleIds.length,
      });
      // Don't fail hard; the new rules are saved. Warn the user.
      return {
        ok: false,
        error: 'Rules saved, but could not clean up old versions. You may see duplicate windows. Please save again.',
      };
    }
  }

  // Upsert timezone in user_public_settings.
  const { error: settingsError } = await supabase
    .from('user_public_settings')
    .upsert({
      user_id: user.id,
      timezone: tzValidation.data,
    }, { onConflict: 'user_id' });

  if (settingsError) {
    logger.error('[calendar/availability-actions] saveAvailabilityRulesAction settings failed', settingsError, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not save timezone.' };
  }

  return { ok: true, data: undefined };
}

/* ─── upsertOverrideAction ─────────────────────────────────────── */

/**
 * Upsert an availability override (unique by user_id + date).
 *
 * @param input - { date, available, start_time, end_time }
 * @returns success or error
 */
export async function upsertOverrideAction(
  input: OverrideInput,
): Promise<ActionResult<AvailabilityOverride>> {
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid override data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('availability_overrides')
    .upsert({
      user_id: user.id,
      date: parsed.data.date,
      available: parsed.data.available,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
    }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) {
    logger.error('[calendar/availability-actions] upsertOverrideAction failed', error, {
      userId: user.id,
      date: parsed.data.date,
    });
    return { ok: false, error: 'Could not save override.' };
  }

  return { ok: true, data: data as AvailabilityOverride };
}

/* ─── deleteOverrideAction ─────────────────────────────────────── */

/**
 * Delete an availability override by date.
 *
 * @param date - YYYY-MM-DD string
 * @returns success or error
 */
export async function deleteOverrideAction(date: string): Promise<ActionResult<void>> {
  const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(date);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid date format.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('user_id', user.id)
    .eq('date', parsed.data);

  if (error) {
    logger.error('[calendar/availability-actions] deleteOverrideAction failed', error, {
      userId: user.id,
      date: parsed.data,
    });
    return { ok: false, error: 'Could not delete override.' };
  }

  return { ok: true, data: undefined };
}
