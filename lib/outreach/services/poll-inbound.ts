/**
 * Handle one inbound Gmail message on an outreach thread: a bounce, an
 * auto-reply, a reply, or an opt-out.
 *
 * Ordering is the rule here. State changes (opt-out, stop, stage, cancel)
 * happen first and the marker event that makes the message "handled" is
 * written last. A failure part-way leaves no marker, so the next poll
 * retries the whole message. Every state change below is idempotent, so a
 * retry after a marker-write failure is harmless too.
 *
 * @module lib/outreach/services/poll-inbound
 */
import { sendAlert } from '@/lib/alerts/send-alert';

import { classifyInbound, isOptOut, replyLead } from '../gmail/classify';
import { GmailClient, headerOf, plainTextOf, type GmailMessage } from '../gmail/client';
import type { AdminDb } from '../types';

import { autoAdvance, cancelPendingEmails, optOut, recordEvent, stopActiveEnrollment } from './events';
import { pauseSending } from './settings';
import { suppressAddress } from './suppression';

/** Bounce-rate tripwire: pause above this share of recent sends. */
const BOUNCE_PAUSE_RATE = 0.03;
const BOUNCE_MIN_SENDS = 20;
/** Gmail ids per `.in()` query; larger lists are chunked. */
const ID_CHUNK = 200;

/** Outcome of one poll. */
export interface PollResult {
  polled: boolean;
  replies: number;
  bounces: number;
  optOuts: number;
}

/** Event types whose payload carries a handled Gmail message id. */
const MARKER_TYPES = ['replied', 'email_bounced', 'auto_reply_received'];

/**
 * Inbound Gmail ids that already have a marker event. Throws on query
 * failure: treating an unknown message as unhandled would re-act on it.
 */
export async function handledIds(db: AdminDb, ids: string[]): Promise<Set<string>> {
  const done = new Set<string>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const { data, error } = await db
      .from('outreach_events')
      .select('payload')
      .in('type', MARKER_TYPES)
      .in('payload->>gmail_message_id', chunk);
    if (error) throw new Error(`handled ids: ${error.message}`);
    for (const r of data ?? []) {
      const id = (r.payload as { gmail_message_id?: string }).gmail_message_id;
      if (id) done.add(id);
    }
  }
  return done;
}

/** Handle one inbound message attributed to a prospect. */
export async function handleInbound(
  db: AdminDb,
  gmail: GmailClient,
  ownEmail: string,
  prospectId: string,
  msg: GmailMessage,
  result: PollResult,
): Promise<void> {
  const subject = headerOf(msg, 'Subject');
  const kind = classifyInbound(
    {
      from: headerOf(msg, 'From') ?? '',
      contentType: headerOf(msg, 'Content-Type'),
      autoSubmitted: headerOf(msg, 'Auto-Submitted'),
      subject,
    },
    ownEmail,
  );
  if (kind === 'own') return;
  const at = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString();

  if (kind === 'bounce') {
    result.bounces++;
    await db.from('outreach_prospects').update({ email_check: 'bounced', updated_at: new Date().toISOString() }).eq('id', prospectId);
    await cancelPendingEmails(db, prospectId, 'bounced');
    // Suppress the address itself, so a re-import or a second prospect row can't email it again.
    const { data: bounced, error: bErr } = await db.from('outreach_prospects').select('email').eq('id', prospectId).single();
    if (bErr) throw new Error(`bounced prospect: ${bErr.message}`);
    await suppressAddress(db, { email: bounced.email }, 'bounced', 'gmail bounce');
    // If nothing but email was left, the sequence is over.
    const { count } = await db.from('outreach_messages').select('id', { count: 'exact', head: true }).eq('prospect_id', prospectId).eq('status', 'scheduled');
    if (!count) await stopActiveEnrollment(db, prospectId, 'bounced');
    await recordEvent(db, { prospectId, type: 'email_bounced', channel: 'email', payload: { gmail_message_id: msg.id, at } });
    return;
  }
  if (kind === 'auto_reply') {
    await recordEvent(db, { prospectId, type: 'auto_reply_received', channel: 'email', payload: { gmail_message_id: msg.id, at } });
    return;
  }

  result.replies++;
  const full = await gmail.message(msg.id);
  const text = plainTextOf(full.payload);
  const snippet = replyLead(text).slice(0, 280);
  if (isOptOut(text, headerOf(full, 'Subject') ?? subject)) {
    result.optOuts++;
    await optOut(db, prospectId, 'email_reply');
    await recordReplyMarker(db, prospectId, msg, at, snippet);
    void sendAlert({ type: 'outreach_activity', severity: 'info', kind: 'opt_out', prospectId });
    return;
  }
  await stopActiveEnrollment(db, prospectId, 'replied');
  await autoAdvance(db, prospectId, 'replied');
  await recordReplyMarker(db, prospectId, msg, at, snippet);
  void sendAlert({ type: 'outreach_activity', severity: 'info', kind: 'reply', prospectId });
}

/** The 'replied' event doubles as the handled marker, so it is written last. */
async function recordReplyMarker(db: AdminDb, prospectId: string, msg: GmailMessage, at: string, snippet: string): Promise<void> {
  await recordEvent(db, {
    prospectId, type: 'replied', channel: 'email',
    payload: { gmail_message_id: msg.id, thread_id: msg.threadId, at, snippet },
  });
}

/** Pause sending when recent bounces cross the tripwire. */
export async function checkBounceRate(db: AdminDb): Promise<void> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const count = async (type: string) => {
    const { count: c, error } = await db.from('outreach_events').select('id', { count: 'exact', head: true }).eq('type', type).gte('occurred_at', since);
    if (error) throw new Error(`bounce count: ${error.message}`);
    return c ?? 0;
  };
  const sent = await count('email_sent');
  if (sent < BOUNCE_MIN_SENDS) return;
  const bounced = await count('email_bounced');
  if (bounced / sent > BOUNCE_PAUSE_RATE) {
    const { data } = await db.from('outreach_settings').select('sending_paused').eq('id', true).single();
    if (data?.sending_paused) return;
    const pct = Math.round((bounced / sent) * 1000) / 10;
    await pauseSending(db, `Bounce rate ${pct}% over the last 14 days. Clean the list, then resume.`);
    await sendAlert({ type: 'outreach_paused', severity: 'error', reason: `bounce rate ${pct}% (${bounced}/${sent})` });
  }
}
