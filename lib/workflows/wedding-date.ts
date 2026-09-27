/**
 * The couple's wedding date, as every workflow due date reads it.
 *
 * Its own module so the executor can read it without importing
 * `./instantiate`, which imports `./resume`, which imports the executor:
 * an import cycle for no reason (see `./instance-homes` for the one that
 * broke a test's `vi.mock`).
 *
 * @module lib/workflows/wedding-date
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { WorkflowReadError } from './read-failure';

/**
 * The couple's wedding date, or null when there is no couple.
 *
 * Lenient: a failed read also answers null. Only for display paths; the
 * engine reads through {@link loadWeddingDateOrThrow}, because a null
 * there undates every wedding-anchored step.
 *
 * Event date and venue live on the couple's `events` rows (managed via
 * the Events tab); the couple-level `event_date` column is only populated
 * for pre-events-table couples. This mirrors the resolution
 * `loadCoupleSnapshot` already uses, so a step's due date and an email's
 * `{{event.date}}` can never disagree.
 */
export async function loadWeddingDate(
  supabase: SupabaseClient<Database>,
  coupleId: string | null,
): Promise<string | null> {
  if (!coupleId) return null;
  const [{ data: primaryEvent }, { data: couple }] = await Promise.all([
    supabase
      .from('events')
      .select('date')
      .eq('couple_id', coupleId)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from('couples').select('event_date').eq('id', coupleId).maybeSingle(),
  ]);
  return primaryEvent?.date ?? couple?.event_date ?? null;
}

/**
 * {@link loadWeddingDate}, but a failed read throws instead of reading as
 * "no wedding date".
 *
 * For the skip paths (`./resume`), where "no date" is not a safe answer:
 * a wait "until 60 days before the wedding" on a couple with no date is
 * judged not past, so a read that failed and came back empty would let
 * that wait start, finish at once, and release the send behind it.
 *
 * @param supabase - service-role client
 * @param coupleId - the couple, or null for a personal instance
 */
export async function loadWeddingDateOrThrow(
  supabase: SupabaseClient<Database>,
  coupleId: string | null,
): Promise<string | null> {
  if (!coupleId) return null;
  const [events, couple] = await Promise.all([
    supabase
      .from('events')
      .select('date')
      .eq('couple_id', coupleId)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from('couples').select('event_date').eq('id', coupleId).maybeSingle(),
  ]);
  const error = events.error ?? couple.error;
  // A WorkflowReadError, so the dispatcher can tell a blip from a bad
  // event and leave the event for the next tick.
  if (error) throw new WorkflowReadError('wedding_date', error);
  return events.data?.date ?? couple.data?.event_date ?? null;
}
