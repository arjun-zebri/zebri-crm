/**
 * The MC's own timezone, as the workflow engine reads it.
 *
 * Saved in Settings onto `user_public_settings.timezone`. The executor
 * schedules against it (a step "at 9am" is 9am here), the Today view
 * groups by it, and the step envelope shows a held send's time in it, so
 * an MC in Perth reads 4:00 pm rather than a Sydney or UTC time. One
 * reader keeps those three from disagreeing about which zone is "yours".
 *
 * @module lib/workflows/mc-timezone
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { WorkflowReadError } from './read-failure';

/** Fallback when the MC has never saved a timezone. */
export const DEFAULT_MC_TIMEZONE = 'Australia/Sydney';

/**
 * Read an MC's timezone.
 *
 * @param supabase - Service-role or the MC's own RLS client.
 * @param userId - The MC.
 * @param strict - Throw on a read error instead of falling back. The
 *   executor's due-date recompute passes true: scheduling a send in the
 *   wrong zone is worse than retrying the tick.
 */
export async function loadMcTimezone(
  supabase: SupabaseClient<Database>,
  userId: string,
  strict = false,
): Promise<string> {
  const { data, error } = await supabase
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  if (strict && error) throw new WorkflowReadError('mc_timezone', error);
  return data?.timezone ?? DEFAULT_MC_TIMEZONE;
}
