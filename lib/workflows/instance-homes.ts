/**
 * The two instances every MC gets without applying anything: a couple's
 * default ("General") instance and the MC's personal to-do instance.
 *
 * Its own module, apart from `./instantiate`, because the legacy task
 * action (`lib/automations/actions/task.ts`) needs these and sits under
 * the executor's import graph. `./instantiate` imports `./resume`, which
 * imports the executor, so importing these from there closed an import
 * cycle through the executor, and that cycle defeated `vi.mock` of
 * `./execute-step` in the executor's own integration tests.
 *
 * @module lib/workflows/instance-homes
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/**
 * The couple's default ("General") instance, created if absent.
 *
 * A DB trigger creates it on couple INSERT, so this is a safety net for
 * couples that predate the trigger. Relies on the partial unique index
 * `workflow_instances_one_default_per_couple_idx` for the race.
 */
export async function ensureDefaultInstance(
  supabase: SupabaseClient<Database>,
  userId: string,
  coupleId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('couple_id', coupleId)
    .eq('is_default', true)
    .maybeSingle();
  if (existing) return existing.id;

  const { data } = await supabase
    .from('workflow_instances')
    .insert({ user_id: userId, couple_id: coupleId, name: 'General', is_default: true })
    .select('id')
    .maybeSingle();
  if (data) return data.id;

  // Lost the race against the unique index; the winner's row is there now.
  const { data: raced } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('couple_id', coupleId)
    .eq('is_default', true)
    .single();
  return raced!.id;
}

/**
 * The user's personal (couple-less) instance, created if absent.
 *
 * Home for to-dos that belong to no couple. It surfaces only in the work
 * queue, never on a couple profile.
 */
export async function ensurePersonalInstance(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('user_id', userId)
    .eq('is_personal', true)
    .maybeSingle();
  if (existing) return existing.id;

  const { data } = await supabase
    .from('workflow_instances')
    .insert({ user_id: userId, name: 'My to-dos', is_personal: true })
    .select('id')
    .maybeSingle();
  if (data) return data.id;

  const { data: raced } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('user_id', userId)
    .eq('is_personal', true)
    .single();
  return raced!.id;
}
