/**
 * Watch the outreach mailbox for replies, bounces and opt-outs.
 *
 * Two sweeps:
 * 1. **Our threads.** Every Gmail thread Zebri sent into, for enrolments
 *    that are active or stopped within {@link LOOKBACK_DAYS}. Threads come
 *    least-recently-checked first (a rotating cursor on the sent messages),
 *    so a large list is covered across polls instead of only its first page.
 * 2. **Fresh emails** from people we've contacted, which catches a reply
 *    that starts a new thread.
 *
 * Replies in a thread are never skipped for belonging to one of our
 * threads: each inbound message is decided by its id ({@link handledIds})
 * and our own messages are dropped by their From address.
 *
 * Throttled to every {@link POLL_INTERVAL_MS}. The tick may run every
 * minute or every fifteen; the throttle is by time, not by tick count.
 *
 * @module lib/outreach/services/poll
 */
import { addressOf } from '../gmail/classify';
import { GmailClient, GmailError, headerOf } from '../gmail/client';
import type { AdminDb } from '../types';

import { checkBounceRate, handledIds, handleInbound, type PollResult } from './poll-inbound';
import { mailboxAccess, pauseSending } from './settings';

export type { PollResult } from './poll-inbound';

/** Minimum gap between polls. */
export const POLL_INTERVAL_MS = 5 * 60_000;
/** Enrolments stopped within this window still have their threads watched. */
export const LOOKBACK_DAYS = 45;
/** Threads per poll. The cursor rotates, so the rest come up on later polls. */
export const MAX_THREADS = 100;
const DAY_MS = 86_400_000;
const SEARCH_BATCH = 20;

/** Pass-through for Supabase errors so a failed query never reads as "no rows". */
function check<T extends { error: { message: string } | null }>(label: string, res: T): T {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res;
}

/** Sweep 1: every thread we started, least-recently-checked first. */
async function sweepOwnThreads(
  db: AdminDb,
  gmail: GmailClient,
  ownEmail: string,
  deadline: number,
  result: PollResult,
): Promise<void> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS).toISOString();
  const { data: threads } = check('threads to poll', await db.rpc('outreach_threads_to_poll', { p_limit: MAX_THREADS, p_since: since }));
  let firstError: unknown = null;

  for (const t of threads ?? []) {
    if (Date.now() > deadline) break;
    try {
      const thread = await gmail.thread(t.gmail_thread_id);
      const messages = thread.messages ?? [];
      const done = await handledIds(db, messages.map((m) => m.id));
      for (const m of messages) {
        if (!done.has(m.id)) await handleInbound(db, gmail, ownEmail, t.prospect_id, m, result);
      }
    } catch (err) {
      // One bad thread must not starve the rest: remember the first error,
      // still advance this thread's cursor below, and keep going.
      firstError ??= err;
    }
    // Advance the cursor even on failure, or a thread that always fails
    // would sit at the front of the queue forever.
    check('poll cursor', await db
      .from('outreach_messages')
      .update({ reply_checked_at: new Date().toISOString() })
      .eq('channel', 'email').eq('status', 'sent').eq('gmail_thread_id', t.gmail_thread_id));
  }
  if (firstError) throw firstError;
}

/** Sweep 2: fresh emails from prospects we've recently contacted. */
async function sweepFreshReplies(db: AdminDb, gmail: GmailClient, ownEmail: string, deadline: number, result: PollResult): Promise<void> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS).toISOString();
  const { data: sent } = check('recent sends', await db
    .from('outreach_messages')
    .select('prospect_id, sent_at')
    .eq('channel', 'email').eq('status', 'sent').gte('sent_at', since)
    .limit(10_000));
  // Each prospect's first send in the window: mail from them before it is not a reply.
  const firstSent = new Map<string, number>();
  for (const m of sent ?? []) {
    const at = m.sent_at ? Date.parse(m.sent_at) : Number.POSITIVE_INFINITY;
    firstSent.set(m.prospect_id, Math.min(firstSent.get(m.prospect_id) ?? at, at));
  }
  const prospectIds = [...firstSent.keys()];

  const byEmail = new Map<string, string>();
  for (let i = 0; i < prospectIds.length; i += 200) {
    const { data } = check('contacted prospects', await db
      .from('outreach_prospects')
      .select('id, email')
      .in('id', prospectIds.slice(i, i + 200)));
    for (const p of data ?? []) if (p.email) byEmail.set(p.email.toLowerCase(), p.id);
  }

  const emails = [...byEmail.keys()];
  for (let i = 0; i < emails.length && Date.now() < deadline; i += SEARCH_BATCH) {
    const q = `from:(${emails.slice(i, i + SEARCH_BATCH).join(' OR ')}) newer_than:2d`;
    const hits = await gmail.search(q);
    const done = await handledIds(db, hits.map((h) => h.id));
    for (const hit of hits) {
      if (done.has(hit.id)) continue;
      const msg = await gmail.message(hit.id);
      const prospectId = byEmail.get(addressOf(headerOf(msg, 'From') ?? ''));
      if (!prospectId) continue;
      // Why: the search is "from them, last 2 days", which also finds mail
      // they sent before we ever wrote. That is not a reply, and counting it
      // stopped a sequence the moment its first email went out. Left without
      // a marker, so it is looked at again next poll and skipped again.
      const arrived = msg.internalDate ? Number(msg.internalDate) : Date.now();
      if (arrived < (firstSent.get(prospectId) ?? 0)) continue;
      await handleInbound(db, gmail, ownEmail, prospectId, msg, result);
    }
  }
}

/** Poll the mailbox if it's due. */
export async function pollMailbox(db: AdminDb, deadline: number, force = false): Promise<PollResult> {
  const result: PollResult = { polled: false, replies: 0, bounces: 0, optOuts: 0 };
  const { data: box } = await db.from('outreach_mailbox').select('last_polled_at').eq('id', true).maybeSingle();
  if (!box) return result;
  if (!force && box.last_polled_at && Date.now() - Date.parse(box.last_polled_at) < POLL_INTERVAL_MS) return result;

  let access: Awaited<ReturnType<typeof mailboxAccess>>;
  try {
    access = await mailboxAccess(db);
  } catch (err) {
    if (err instanceof GmailError && err.permanent) {
      await db.from('outreach_mailbox').update({ last_error: err.message }).eq('id', true);
      await pauseSending(db, 'Gmail disconnected: reconnect the mailbox in Outreach settings.');
      return result;
    }
    throw err;
  }
  if (!access) return result;
  const gmail = new GmailClient(access.accessToken);
  result.polled = true;

  await sweepOwnThreads(db, gmail, access.email, deadline, result);
  await sweepFreshReplies(db, gmail, access.email, deadline, result);

  check('poll stamp', await db.from('outreach_mailbox').update({ last_polled_at: new Date().toISOString(), last_error: null }).eq('id', true));
  await checkBounceRate(db);
  return result;
}
