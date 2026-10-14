/**
 * Crash-safe bookkeeping for email sends.
 *
 * A send has one dangerous moment: Gmail accepted the message but Zebri
 * failed to record it. Retrying then sends a second copy. So:
 * - the RFC Message-ID is stored on the row before Gmail is called, which
 *   lets the reaper find the send later;
 * - a row that Gmail accepted is never sent again or reverted, and its
 *   'sent' write is retried on its own;
 * - a 'sending' row that stays unresolved past {@link STALE_SEND_MS} is
 *   settled by searching Gmail for its Message-ID, not by guessing.
 *
 * @module lib/outreach/services/send-recovery
 */
import { sendAlert } from '@/lib/alerts/send-alert';

import { GmailClient } from '../gmail/client';
import { timezoneForState } from '../import/normalise';
import { localDateKey, localParts, CAP_TIMEZONE } from '../sequencer/schedule';
import type { AdminDb, OutreachMessage } from '../types';

import { recordEvent } from './events';
import { afterSend } from './sequencer';

/** Attempts before an email is marked failed. */
export const MAX_ATTEMPTS = 3;
/** A 'sending' row older than this is presumed interrupted. */
export const STALE_SEND_MS = 10 * 60_000;
const PERSIST_TRIES = 3;
const STALE_BATCH = 20;

/** A send Gmail accepted (or one the reaper found), ready to record. */
export interface SentRecord {
  messageId: string;
  enrollmentId: string;
  prospectId: string;
  stepId: string;
  sentAt: Date;
  gmailMessageId: string;
  gmailThreadId: string;
  localHour: number;
  localWeekday: number;
  /** The text part as sent, footer included. Unknown to the reaper, which leaves the queued body. */
  body?: string;
}

/** Message-ids are stored with angle brackets; Gmail's search wants them bare. */
export function bareMessageId(rfcId: string): string {
  return rfcId.replace(/^<|>$/g, '');
}

/**
 * Write the 'sent' state, retrying a transient failure. Gives up without
 * reverting anything: the row stays 'sending' with its Message-ID, and the
 * reaper settles it against Gmail.
 */
async function persistSent(db: AdminDb, rec: SentRecord): Promise<boolean> {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= PERSIST_TRIES; attempt++) {
    const { error } = await db.from('outreach_messages').update({
      status: 'sent',
      sent_at: rec.sentAt.toISOString(),
      gmail_message_id: rec.gmailMessageId,
      gmail_thread_id: rec.gmailThreadId,
      send_local_hour: rec.localHour,
      send_local_weekday: rec.localWeekday,
      error: null,
      ...(rec.body !== undefined ? { body: rec.body } : {}),
    }).eq('id', rec.messageId);
    if (!error) return true;
    lastError = error.message;
    await new Promise((r) => setTimeout(r, 250 * attempt));
  }
  void sendAlert({
    type: 'app_error', severity: 'error', source: 'outreach.persist_sent',
    message: `Email ${rec.messageId} was sent but not recorded (${lastError}). The reaper will reconcile it.`,
  });
  return false;
}

/**
 * Run the follow-on work for a recorded send: the event, stage, next step,
 * and the warm-up start date. Its own try: a failure alerts and leaves the
 * message row alone (it is already correctly 'sent').
 */
async function afterSendGuarded(db: AdminDb, rec: SentRecord): Promise<void> {
  try {
    await afterSend(db, rec.enrollmentId, rec.prospectId, rec.stepId, rec.messageId, 'email', rec.sentAt, 'email_sent', {
      thread: rec.gmailThreadId,
    });
    await db.from('outreach_settings')
      .update({ ramp_started_on: localDateKey(rec.sentAt, CAP_TIMEZONE) })
      .eq('id', true).is('ramp_started_on', null);
  } catch (err) {
    void sendAlert({
      type: 'app_error', severity: 'error', source: 'outreach.after_send',
      message: `Sent email ${rec.messageId} but follow-up bookkeeping failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500),
    });
  }
}

/** Record an accepted send: persist 'sent', then run the follow-on work. */
export async function finishSend(db: AdminDb, rec: SentRecord): Promise<void> {
  if (await persistSent(db, rec)) await afterSendGuarded(db, rec);
}

/**
 * Put a message back for another try, or fail it once attempts run out.
 * Only for failures where Gmail definitely did not send the message.
 */
export async function requeueOrFail(db: AdminDb, msg: Pick<OutreachMessage, 'id' | 'attempts' | 'enrollment_id' | 'prospect_id'>, error: string): Promise<'scheduled' | 'failed'> {
  const final = msg.attempts >= MAX_ATTEMPTS;
  const { error: upErr } = await db.from('outreach_messages')
    .update({ status: final ? 'failed' : 'scheduled', error: error.slice(0, 500), claimed_at: null })
    .eq('id', msg.id);
  if (upErr) throw new Error(`requeue email: ${upErr.message}`);
  if (final) {
    const { data: enr } = await db.from('outreach_enrollments').select('campaign_id').eq('id', msg.enrollment_id).maybeSingle();
    await recordEvent(db, {
      prospectId: msg.prospect_id, type: 'email_failed', channel: 'email', campaignId: enr?.campaign_id ?? null,
      enrollmentId: msg.enrollment_id, messageId: msg.id, payload: { error: error.slice(0, 300) },
    });
  }
  return final ? 'failed' : 'scheduled';
}

/**
 * Settle 'sending' rows that were claimed too long ago. Found in Gmail:
 * recorded as sent. Not found: requeued with the attempt already counted.
 * A lookup that errors is left alone to retry on the next pass.
 *
 * @returns how many rows were recorded as sent and how many were requeued.
 */
export async function recoverStaleSends(db: AdminDb, gmail: GmailClient): Promise<{ recovered: number; requeued: number }> {
  const out = { recovered: 0, requeued: 0 };
  const cutoff = new Date(Date.now() - STALE_SEND_MS).toISOString();
  const { data: stale, error } = await db
    .from('outreach_messages')
    .select('*')
    .eq('channel', 'email').eq('status', 'sending')
    .or(`claimed_at.lt.${cutoff},claimed_at.is.null`)
    .limit(STALE_BATCH);
  if (error) throw new Error(`stale sends: ${error.message}`);

  for (const msg of stale ?? []) {
    if (!msg.rfc_message_id) {
      // Stored before the send, so no send happened.
      await requeueOrFail(db, msg, 'Interrupted before the send was recorded.');
      out.requeued++;
      continue;
    }
    let hits: { id: string; threadId: string }[];
    try {
      hits = await gmail.search(`rfc822msgid:${bareMessageId(msg.rfc_message_id)}`, 5);
    } catch {
      continue;
    }
    if (hits.length === 0) {
      await requeueOrFail(db, msg, 'Gmail has no record of this send; retrying.');
      out.requeued++;
      continue;
    }
    const hit = hits[0]!;
    const { data: prospect } = await db.from('outreach_prospects').select('state').eq('id', msg.prospect_id).maybeSingle();
    const sentAt = msg.claimed_at ? new Date(msg.claimed_at) : new Date();
    const local = localParts(sentAt, timezoneForState(prospect?.state ?? null));
    await finishSend(db, {
      messageId: msg.id, enrollmentId: msg.enrollment_id, prospectId: msg.prospect_id, stepId: msg.step_id,
      sentAt, gmailMessageId: hit.id, gmailThreadId: hit.threadId, localHour: local.hour, localWeekday: local.weekday,
    });
    out.recovered++;
  }
  return out;
}
