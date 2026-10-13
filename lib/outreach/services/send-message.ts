/**
 * One claimed email, from eligibility checks through to Gmail.
 *
 * The rule that keeps sends from duplicating: Gmail is called exactly once
 * per claim, and nothing that can fail sits between a successful send and
 * its recording (see `finishSend` in send-recovery). Failures before the
 * call put the message back. Failures during or after it leave the row
 * 'sending' with its Message-ID, for the reaper to settle against Gmail.
 *
 * @module lib/outreach/services/send-message
 */
import { sendAlert } from '@/lib/alerts/send-alert';

import { GmailClient, GmailError, isDefinitiveRefusal } from '../gmail/client';
import { buildRawEmail, newMessageId } from '../gmail/mime';
import { timezoneForState } from '../import/normalise';
import { isInSendWindow, localParts } from '../sequencer/schedule';
import type { AdminDb, OutreachMessage, OutreachSettings } from '../types';

import { recordEvent } from './events';
import { deferToWindow, inboundAfter, windowOf } from './send-guards';
import { finishSend, requeueOrFail } from './send-recovery';
import type { ScheduleContext } from './sequencer';
import { pauseSending } from './settings';
import { sendBlockReason } from './suppression';

/** Outcome of one send pass. */
export interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
  deferred: number;
}

/** Whether the pass should carry on with the rest of its claimed messages. */
export type ClaimOutcome = 'done' | 'halt';

/** Shared state for one send pass. */
export interface SendContext {
  db: AdminDb;
  gmail: GmailClient;
  ownEmail: string;
  settings: OutreachSettings;
  result: SendResult;
  /** Lazily loads the day counts; only needed when something is deferred. */
  schedule: () => Promise<ScheduleContext>;
}

/** Cancel a message that must not go out, and say why on the timeline. */
async function cancel(ctx: SendContext, msg: OutreachMessage, reason: string): Promise<void> {
  const { error } = await ctx.db.from('outreach_messages').update({ status: 'cancelled', skip_reason: reason }).eq('id', msg.id);
  if (error) throw new Error(`cancel email: ${error.message}`);
  await recordEvent(ctx.db, {
    prospectId: msg.prospect_id, type: 'message_skipped', channel: 'email',
    enrollmentId: msg.enrollment_id, messageId: msg.id, payload: { reason },
  });
  ctx.result.skipped++;
}

/** Terminal failure for one message Gmail refused on its content. Recorded on the timeline. */
async function failMessage(ctx: SendContext, msg: OutreachMessage, message: string): Promise<void> {
  const { error } = await ctx.db.from('outreach_messages')
    .update({ status: 'failed', error: message.slice(0, 500), claimed_at: null })
    .eq('id', msg.id);
  if (error) throw new Error(`fail email: ${error.message}`);
  const { data: enr } = await ctx.db.from('outreach_enrollments').select('campaign_id').eq('id', msg.enrollment_id).maybeSingle();
  await recordEvent(ctx.db, {
    prospectId: msg.prospect_id, type: 'email_failed', channel: 'email', campaignId: enr?.campaign_id ?? null,
    enrollmentId: msg.enrollment_id, messageId: msg.id, payload: { error: message.slice(0, 300) },
  });
  ctx.result.failed++;
}

/**
 * Handle a failed attempt. `mayHaveSent` is true once gmail.send has been
 * called: a timeout or 5xx then proves nothing, so the row stays 'sending'
 * for the reaper. A 4xx (or a failure before the call) is definitive.
 */
async function fail(ctx: SendContext, msg: OutreachMessage, err: unknown, mayHaveSent: boolean): Promise<ClaimOutcome> {
  const message = err instanceof Error ? err.message : String(err);
  if (mayHaveSent && !isDefinitiveRefusal(err)) {
    await ctx.db.from('outreach_messages').update({ error: message.slice(0, 500) }).eq('id', msg.id);
    return 'done';
  }
  // Every definitive 4xx stops the pass: Gmail is refusing us, so keep
  // knocking and the account gets flagged for a human. The message itself
  // is only requeued for account-level refusals (a dead grant, a rate limit,
  // a forbidden mailbox). Any other 4xx is about this message, and a retry
  // would be refused the same way, so it fails rather than retrying on resume.
  // Why 404 is not a pause: on a follow-up it almost always means the thread
  // we are replying into is gone (deleted in Gmail). That is about this one
  // message, not the account, so it fails alone and sending carries on.
  if (err instanceof GmailError && err.status === 404) {
    await failMessage(ctx, msg, message);
    return 'done';
  }
  if (err instanceof GmailError && isDefinitiveRefusal(err)) {
    const accountLevel = err.permanent || err.status === 429 || err.status === 403;
    if (accountLevel) {
      await ctx.db.from('outreach_messages')
        .update({ status: 'scheduled', error: message.slice(0, 500), claimed_at: null, attempts: Math.max(0, msg.attempts - 1) })
        .eq('id', msg.id);
    } else {
      await failMessage(ctx, msg, message);
    }
    await pauseSending(ctx.db, `Gmail refused a send (${err.status}). Check the mailbox, then resume.`);
    await sendAlert({ type: 'outreach_paused', severity: 'error', reason: `Gmail ${err.status}: ${message.slice(0, 200)}` });
    return 'halt';
  }
  const final = await requeueOrFail(ctx.db, msg, message);
  if (final === 'failed') ctx.result.failed++;
  return 'done';
}

/** Where a message goes in Gmail, and whether the person has already replied. */
export interface ThreadState {
  threadId: string | null;
  inReplyTo: string | null;
  blocked: boolean;
}

/** Gmail's thread view: has the person replied since we last wrote? */
async function threadState(ctx: SendContext, msg: OutreachMessage, step: { is_new_thread: boolean }): Promise<ThreadState> {
  if (step.is_new_thread) return { threadId: null, inReplyTo: null, blocked: false };
  const { data: prev, error } = await ctx.db
    .from('outreach_messages')
    .select('gmail_thread_id, rfc_message_id, sent_at')
    .eq('enrollment_id', msg.enrollment_id).eq('channel', 'email').eq('status', 'sent')
    .order('sent_at', { ascending: false }).limit(1);
  if (error) throw new Error(`previous send: ${error.message}`);
  const last = prev?.[0];
  const threadId = last?.gmail_thread_id ?? null;
  const inReplyTo = last?.rfc_message_id ?? null;
  if (!threadId || !last?.sent_at) return { threadId, inReplyTo, blocked: false };
  // Why: a reply that landed after our last email means the person has
  // engaged. Sending a follow-up now would talk over them.
  const thread = await ctx.gmail.thread(threadId);
  return { threadId, inReplyTo, blocked: inboundAfter(thread, ctx.ownEmail, new Date(last.sent_at)) };
}

/** Send one claimed message, or cancel, defer or fail it. */
export async function sendClaimed(ctx: SendContext, msg: OutreachMessage): Promise<ClaimOutcome> {
  const { db } = ctx;
  const [{ data: prospect }, { data: enrollment }, { data: step }] = await Promise.all([
    db.from('outreach_prospects').select('*').eq('id', msg.prospect_id).single(),
    db.from('outreach_enrollments').select('*').eq('id', msg.enrollment_id).single(),
    db.from('outreach_sequence_steps').select('*').eq('id', msg.step_id).single(),
  ]);
  const recipient = prospect?.email ?? null;
  if (!prospect || !enrollment || !step || !recipient || enrollment.status !== 'active' ||
      prospect.do_not_contact || prospect.email_check !== 'ok') {
    await cancel(ctx, msg, 'no_longer_eligible');
    return 'done';
  }
  const block = await sendBlockReason(db, prospect);
  if (block) {
    await cancel(ctx, msg, block);
    return 'done';
  }

  // Why: a backlog after an outage, or a message from before a settings
  // change, must not go out at night or on a disallowed day.
  const tz = timezoneForState(prospect.state);
  const now = new Date();
  if (!isInSendWindow(now, tz, windowOf(ctx.settings))) {
    if (await deferToWindow(db, msg, tz, ctx.settings, await ctx.schedule(), now)) {
      ctx.result.deferred++;
    } else {
      await cancel(ctx, msg, 'no_slot');
    }
    return 'done';
  }

  let thread: ThreadState;
  try {
    thread = await threadState(ctx, msg, step);
  } catch (err) {
    return fail(ctx, msg, err, false);
  }
  if (thread.blocked) {
    await cancel(ctx, msg, 'reply_in_thread');
    return 'done';
  }

  // Store the Message-ID before Gmail is called, so the reaper can find the
  // send if we crash straight after it.
  const messageId = newMessageId(ctx.ownEmail);
  let raw: string;
  try {
    raw = buildRawEmail({
      from: { name: ctx.settings.sender_name, email: ctx.ownEmail },
      to: recipient,
      subject: msg.subject ?? '',
      body: msg.body,
      inReplyTo: thread.inReplyTo,
      messageId,
    });
    const { error } = await db.from('outreach_messages').update({ rfc_message_id: messageId }).eq('id', msg.id);
    if (error) throw new Error(`store message id: ${error.message}`);
  } catch (err) {
    return fail(ctx, msg, err, false);
  }

  let sent: { id: string; threadId: string };
  try {
    sent = await ctx.gmail.send(raw, thread.threadId);
  } catch (err) {
    return fail(ctx, msg, err, true);
  }

  const sentAt = new Date();
  const local = localParts(sentAt, tz);
  await finishSend(db, {
    messageId: msg.id, enrollmentId: msg.enrollment_id, prospectId: msg.prospect_id, stepId: msg.step_id,
    sentAt, gmailMessageId: sent.id, gmailThreadId: sent.threadId,
    localHour: local.hour, localWeekday: local.weekday,
  });
  ctx.result.sent++;
  return 'done';
}

/** Let the message be claimed again later, without counting this claim. */
export async function release(db: AdminDb, msg: OutreachMessage): Promise<void> {
  const { error } = await db.from('outreach_messages')
    .update({ status: 'scheduled', attempts: Math.max(0, msg.attempts - 1), claimed_at: null })
    .eq('id', msg.id);
  if (error) throw new Error(`release email: ${error.message}`);
}
