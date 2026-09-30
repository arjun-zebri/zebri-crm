/**
 * `proposal_expiring` time-based emitter (roadmap R2, spec 5.3).
 *
 * A proposal that is still open (`sent` or `viewed`, not accepted) and
 * whose `expires_at` is exactly `days` from today fires once per
 * (proposal, lead time, calendar day). Lead times come from the active
 * `proposal_expiring` workflow templates, so nothing is published that no
 * workflow would match. Direct sibling of `invoice-due.ts`, anchored on
 * `proposals.expires_at` and without the payment-stage branch.
 *
 * Only `sent` and `viewed` proposals qualify: `draft` has no live
 * `share_token`, and `accepted` / `declined` / `expired` have already
 * left the "still waiting on the couple" state this nudge is for. The
 * `accepted_at is null` filter belongs alongside status rather than
 * replacing it, since `finalize_proposal_acceptance` stamps
 * `accepted_at` in the same update that flips `status`.
 *
 * The payload carries `days_until_expiry` so the trigger's `match()` can
 * narrow to its own lead time, and `share_token` so a "Send email" nudge
 * can resolve `{{proposal.link}}`.
 *
 * @module lib/automations/time-emitters/proposal-expiring
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { getTriggerSpec } from '@/lib/automations/triggers'
import { loadActiveTriggerConfigs } from '@/lib/workflows/trigger-configs'
import { loadWeddingDates } from '@/lib/workflows/wedding-date'
import type { Database } from '@/types/database'

import type { TimeEmitter } from './index'

const EVENT_TYPE = 'proposal_expiring'

/** A proposal that could fire today for one lead time. */
interface Candidate {
  proposalId: string
  userId: string
  coupleId: string
  proposalNumber: string
  title: string
  shareToken: string
  expiresAt: string
  eventDate: string | null
}

/** Lower bound for "today" in UTC, for the per-day dedupe window. */
function startOfUtcDay(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

/**
 * The `expires_at` value (a Postgres `date`, `YYYY-MM-DD`) a proposal
 * must have to be `days` away from today.
 */
export function expiryDateForLeadDays(days: number, now: Date = new Date()): string {
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  target.setUTCDate(target.getUTCDate() + days)
  return target.toISOString().slice(0, 10)
}

/**
 * The lead time a saved trigger config asks for, through the trigger's
 * own schema so `.default(3)` applies to a config saved before the chip
 * wrote one. Null for a config the schema rejects: that workflow is
 * skipped rather than coerced.
 */
export function parseLeadDays(config: unknown): number | null {
  const spec = getTriggerSpec(EVENT_TYPE)
  if (!spec) return null
  const parsed = spec.configSchema.safeParse(config ?? {})
  if (!parsed.success) return null
  const days = (parsed.data as { days?: unknown }).days
  return typeof days === 'number' && Number.isFinite(days) ? Math.floor(days) : null
}

/** Every (user, lead time) pair an active workflow cares about. */
async function collectActiveLeadTimes(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, Set<number>>> {
  const grouped = new Map<string, Set<number>>()
  for (const row of await loadActiveTriggerConfigs(supabase, EVENT_TYPE)) {
    const days = parseLeadDays(row.trigger_config)
    if (days === null) continue
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, new Set())
    grouped.get(row.user_id)!.add(days)
  }
  return grouped
}

/**
 * Open proposals of `userId` expiring exactly `days` from today.
 *
 * `event_date` is resolved through {@link loadWeddingDates} (the
 * batched twin of `loadWeddingDate`: each couple's earliest `events`
 * row date, falling back to `couples.event_date`) rather than a plain
 * `couples(event_date)` join, because that resolution is the same
 * source of truth the lifecycle-event DB trigger
 * (`_workflow_couple_wedding_date`) and every other emitter use, so
 * reusing it keeps a proposal's `{{event.date}}` consistent across the
 * couple, contract and proposal surfaces. The batched form is used
 * (one call with every candidate's `couple_id`) instead of calling
 * `loadWeddingDate` per candidate, which would cost two round trips
 * per row instead of two for the whole page.
 */
async function loadCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: number,
): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select('id, user_id, couple_id, proposal_number, title, share_token, expires_at')
    .eq('user_id', userId)
    .in('status', ['sent', 'viewed'])
    .is('accepted_at', null)
    .eq('expires_at', expiryDateForLeadDays(days))
  if (error) throw new Error(`load proposals: ${error.message}`)

  const rows = data ?? []
  const eventDates = await loadWeddingDates(
    supabase,
    rows.map((row) => row.couple_id),
  )

  return rows.map((row) => ({
    proposalId: row.id,
    userId: row.user_id,
    coupleId: row.couple_id,
    proposalNumber: row.proposal_number,
    title: row.title,
    shareToken: row.share_token,
    expiresAt: row.expires_at as string,
    eventDate: eventDates.get(row.couple_id) ?? null,
  }))
}

/**
 * Already emitted today for this (proposal, lead time)? Narrowed by
 * payload field in JS; the per-day window per proposal is tiny.
 */
async function alreadyEmittedToday(
  supabase: SupabaseClient<Database>,
  candidate: Pick<Candidate, 'proposalId' | 'userId'>,
  days: number,
  dayStart: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('automation_events')
    .select('payload')
    // The tick runs as service role, so RLS does not scope this read;
    // pin it to the owner so a bus row another tenant managed to write
    // under this proposal id can never suppress the real emit.
    .eq('user_id', candidate.userId)
    .eq('source_table', 'proposals')
    .eq('source_id', candidate.proposalId)
    .eq('event_type', EVENT_TYPE)
    .gte('created_at', dayStart)
    .limit(50)
  if (error) throw new Error(`dedupe lookup: ${error.message}`)
  return (data ?? []).some(
    (row) => Number((row.payload as { days_until_expiry?: unknown } | null)?.days_until_expiry) === days,
  )
}

async function emit(
  supabase: SupabaseClient<Database>,
  candidate: Candidate,
  days: number,
): Promise<void> {
  const { error } = await supabase.rpc('emit_automation_event' as never, {
    p_user_id: candidate.userId,
    p_source_table: 'proposals',
    p_source_id: candidate.proposalId,
    p_event_type: EVENT_TYPE,
    p_payload: {
      proposal_id: candidate.proposalId,
      couple_id: candidate.coupleId,
      proposal_number: candidate.proposalNumber,
      title: candidate.title,
      share_token: candidate.shareToken,
      expires_at: candidate.expiresAt,
      event_date: candidate.eventDate,
      days_until_expiry: days,
    } as never,
    p_couple_id: candidate.coupleId,
  } as never)
  if (error) throw new Error(`emit ${EVENT_TYPE}: ${error.message}`)
}

/** The exported emitter: fan out per (user, lead time), dedupe per day. */
export const proposalExpiringEmitter: TimeEmitter = {
  type: EVENT_TYPE,
  async run(supabase) {
    const dayStart = startOfUtcDay()
    const grouped = await collectActiveLeadTimes(supabase)
    if (grouped.size === 0) return 0

    let emitted = 0
    for (const [userId, leadTimes] of grouped) {
      for (const days of leadTimes) {
        for (const candidate of await loadCandidates(supabase, userId, days)) {
          if (await alreadyEmittedToday(supabase, candidate, days, dayStart)) continue
          await emit(supabase, candidate, days)
          emitted += 1
        }
      }
    }
    return emitted
  },
}
