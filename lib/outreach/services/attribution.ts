/**
 * Tie outreach to outcomes: demo bookings on the founder's Scheduler,
 * Zebri signups, and paid subscriptions.
 *
 * Matching happens on the outreach side, from the tick, instead of in
 * the booking RPC, signup action or Stripe webhook: those paths serve
 * every customer and stay untouched, and a missed tick only delays an
 * attribution rather than losing it.
 *
 * Every pass is idempotent. A booking that matched by its tagged link
 * (`?ref=`) stops the sequence and moves the stage on every pass, not just
 * the first, so a pass that failed half-way is finished by the next one.
 * A booking that matched only by email is recorded for the founder to
 * confirm and changes nothing else: an anonymous public booking with a
 * matching address must not stop someone's sequence.
 *
 * @module lib/outreach/services/attribution
 */
import { sendAlert } from '@/lib/alerts/send-alert';

import type { AdminDb } from '../types';

import { attributePaying, attributeSignups } from './attribution-accounts';
import { autoAdvance, recordEvent, stopActiveEnrollment } from './events';
import { loadSettings } from './settings';

const BOOKING_LOOKBACK_DAYS = 60;
/** `.in()` lists are chunked to stay well inside PostgREST's URL limit. */
const ID_CHUNK = 200;

/** Outcome of one attribution pass. */
export interface AttributionResult {
  booked: number;
  demosDone: number;
  cancelled: number;
  signedUp: number;
  paying: number;
}

/** Who a booking was matched to, and whether that match is confirmed. */
interface BookingMatch {
  prospectId: string;
  confirmed: boolean;
}

/** Existing `demo_booked` events keyed by booking id. */
async function bookedMatches(db: AdminDb, ids: string[]): Promise<Map<string, BookingMatch>> {
  const out = new Map<string, BookingMatch>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await db
      .from('outreach_events')
      .select('prospect_id, payload')
      .eq('type', 'demo_booked')
      .in('payload->>booking_id', ids.slice(i, i + ID_CHUNK));
    if (error) throw new Error(`booking events: ${error.message}`);
    for (const r of data ?? []) {
      const payload = r.payload as { booking_id?: string; needs_confirmation?: boolean };
      if (!payload.booking_id || !r.prospect_id) continue;
      out.set(payload.booking_id, { prospectId: r.prospect_id, confirmed: payload.needs_confirmation !== true });
    }
  }
  return out;
}

/** Booking ids that already have an event of `type`. */
async function bookingsWithEvent(db: AdminDb, type: 'demo_done' | 'demo_cancelled', ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await db
      .from('outreach_events')
      .select('payload')
      .eq('type', type)
      .in('payload->>booking_id', ids.slice(i, i + ID_CHUNK));
    if (error) throw new Error(`${type} events: ${error.message}`);
    for (const r of data ?? []) {
      const id = (r.payload as { booking_id?: string }).booking_id;
      if (id) out.add(id);
    }
  }
  return out;
}

/** Chunked `.in()` lookup, so long lists never hit PostgREST's URL limit. */
async function inChunks<T>(values: string[], fetch: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += ID_CHUNK) {
    const { data, error } = await fetch(values.slice(i, i + ID_CHUNK));
    if (error) throw new Error(`prospect match: ${error.message}`);
    out.push(...(data ?? []));
  }
  return out;
}

/** Prospect ids keyed by their ref code. */
async function prospectsByRef(db: AdminDb, refs: string[]): Promise<Map<string, string>> {
  const rows = await inChunks(refs, async (chunk) => await db.from('outreach_prospects').select('id, ref_code').in('ref_code', chunk));
  return new Map(rows.map((r) => [r.ref_code, r.id]));
}

/** Prospect ids keyed by lower-cased email. */
async function prospectsByEmail(db: AdminDb, emails: string[]): Promise<Map<string, string>> {
  const rows = await inChunks(emails, async (chunk) => await db.from('outreach_prospects').select('id, email').in('email', chunk));
  const out = new Map<string, string>();
  for (const r of rows) if (r.email) out.set(r.email.toLowerCase(), r.id);
  return out;
}

/** Match Scheduler bookings to prospects: ref code first, then email. */
export async function attributeBookings(db: AdminDb, meetingTypeId: string, result: AttributionResult): Promise<void> {
  const since = new Date(Date.now() - BOOKING_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data: bookings, error } = await db
    .from('bookings')
    .select('id, email, source_ref, status, starts_at, ends_at')
    .eq('meeting_type_id', meetingTypeId)
    .gte('created_at', since);
  if (error) throw new Error(`bookings: ${error.message}`);
  if (!bookings?.length) return;

  const ids = bookings.map((b) => b.id);
  const [matches, done, cancelled] = await Promise.all([
    bookedMatches(db, ids),
    bookingsWithEvent(db, 'demo_done', ids),
    bookingsWithEvent(db, 'demo_cancelled', ids),
  ]);

  const refs = [...new Set(bookings.map((b) => b.source_ref).filter((r): r is string => !!r))];
  const emails = [...new Set(bookings.map((b) => b.email.toLowerCase()))];
  const refMap = await prospectsByRef(db, refs);
  const emailMap = await prospectsByEmail(db, emails);

  for (const b of bookings) {
    let match = matches.get(b.id);
    if (!match) {
      const viaRef = b.source_ref ? refMap.get(b.source_ref) : undefined;
      const viaEmail = emailMap.get(b.email.toLowerCase());
      const prospectId = viaRef ?? viaEmail;
      if (!prospectId) continue;
      const confirmed = viaRef !== undefined;
      await recordEvent(db, {
        prospectId, type: 'demo_booked',
        payload: {
          booking_id: b.id, starts_at: b.starts_at,
          matched_by: confirmed ? 'ref' : 'email',
          ...(confirmed ? {} : { needs_confirmation: true }),
        },
      });
      match = { prospectId, confirmed };
      if (confirmed) {
        result.booked++;
        void sendAlert({ type: 'outreach_activity', severity: 'info', kind: 'booking', prospectId });
      }
    }
    // An email-only match waits for the founder to confirm it.
    if (!match.confirmed) continue;

    await stopActiveEnrollment(db, match.prospectId, 'booked');
    await autoAdvance(db, match.prospectId, 'demo_booked');
    if (b.status === 'cancelled' && !cancelled.has(b.id)) {
      await recordEvent(db, { prospectId: match.prospectId, type: 'demo_cancelled', payload: { booking_id: b.id } });
      result.cancelled++;
    } else if (b.status !== 'cancelled' && Date.parse(b.ends_at) < Date.now() && !done.has(b.id)) {
      await recordEvent(db, { prospectId: match.prospectId, type: 'demo_done', payload: { booking_id: b.id } });
      await autoAdvance(db, match.prospectId, 'demo_done');
      result.demosDone++;
    }
  }
}

/** Run every attribution matcher. */
export async function runAttribution(db: AdminDb): Promise<AttributionResult> {
  const result: AttributionResult = { booked: 0, demosDone: 0, cancelled: 0, signedUp: 0, paying: 0 };
  const settings = await loadSettings(db);
  if (settings.booking_meeting_type_id) await attributeBookings(db, settings.booking_meeting_type_id, result);
  const signups = await attributeSignups(db);
  result.signedUp = signups.signedUp;
  result.paying = await attributePaying(db);
  return result;
}
