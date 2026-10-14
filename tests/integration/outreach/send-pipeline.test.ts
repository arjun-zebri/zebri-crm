/**
 * The email send path end to end: claim, gates, Gmail send, recording,
 * follow-up scheduling, and the reaper, against local Supabase with a fake
 * Gmail (see fake-gmail.ts). Nothing here touches the network or OAuth.
 *
 * What these tests guard: a due email is sent exactly once; an accepted
 * send is never requeued or sent again, even when bookkeeping fails; a
 * timeout leaves the row 'sending' until the reaper settles it against
 * Gmail; refusals pause sending; and each send gate cancels with its reason.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { localParts } from '@/lib/outreach/sequencer/schedule';
import { sendDueEmails } from '@/lib/outreach/services/send';

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase';

import {
  acceptedSends, failNextAfterSend, injectInbound, queueSendFaults,
  recordedAlerts, resetFakeGmail, sendCallCount, sendsTo, threadReads,
} from './fake-gmail';
import {
  cleanupTracked, enrol, makeCampaign, makeDueMessage, makeProspect, makeSequence, messageRow,
  newTracker, OWN_EMAIL, patchSettings, prospectRow, saveGlobals, SIGNATURE, type Tracker,
} from './pipeline-fixtures';

// The real GmailError is kept; only the client is replaced. The factory
// hands the real class to the fake, which must throw instances of it.
vi.mock('@/lib/outreach/gmail/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/outreach/gmail/client')>();
  const fake = await import('./fake-gmail');
  fake.bindGmailError(real.GmailError);
  return { ...real, GmailClient: fake.FakeGmailClient };
});

// No OAuth: the mailbox is the fixture row, and the token is never used.
vi.mock('@/lib/outreach/services/settings', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/outreach/services/settings')>();
  return {
    ...real,
    mailboxAccess: async () => ({ email: 'outreach-owner@zebri.test', accessToken: 'fake-token' }),
  };
});

// Bookkeeping that fails once, after Gmail has accepted a send.
vi.mock('@/lib/outreach/services/sequencer', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/outreach/services/sequencer')>();
  const fake = await import('./fake-gmail');
  return {
    ...real,
    afterSend: (...args: Parameters<typeof real.afterSend>) => {
      if (fake.takeAfterSendFault()) throw new Error('simulated bookkeeping failure');
      return real.afterSend(...args);
    },
  };
});

// Alerts are recorded, never sent to Slack.
vi.mock('@/lib/alerts/send-alert', async () => {
  const fake = await import('./fake-gmail');
  return { sendAlert: fake.recordAlert };
});

const db = serviceClient();
const LONG_DEADLINE = () => Date.now() + 60_000;
/** Minutes past which a 'sending' row counts as stale (matches STALE_SEND_MS). */
const STALE_BACKDATE_MS = 11 * 60_000;

let t: Tracker;
let restoreGlobals: () => Promise<void>;
let campaignId = '';
let pausedCampaignId = '';
let sequenceId = '';
let step1Id = '';
let step2Id = '';
let mc: TestUser;

/** One pass of the real send path. */
function pass() {
  return sendDueEmails(db, LONG_DEADLINE());
}

/** A prospect enrolled in the active campaign with a first email due now. */
async function dueProspect(n: string, overrides: Record<string, unknown> = {}, campaign = campaignId) {
  const p = await makeProspect(db, t, n, overrides);
  const enrollmentId = await enrol(db, campaign, p.id, sequenceId);
  const messageId = await makeDueMessage(db, { enrollmentId, prospectId: p.id, stepId: step1Id });
  return { ...p, enrollmentId, messageId };
}

/** Re-open the send path after a pause and drop a leftover due message so the queue stays clean. */
async function resumeAndCancel(messageId: string): Promise<void> {
  await patchSettings(db, { sending_paused: false, paused_reason: null });
  await db.from('outreach_messages').update({ status: 'cancelled', skip_reason: 'test_cleanup' }).eq('id', messageId);
}

/** Make a 'sending' row look older than the reaper threshold. */
async function backdateClaim(messageId: string): Promise<void> {
  const old = new Date(Date.now() - STALE_BACKDATE_MS).toISOString();
  const { error } = await db.from('outreach_messages').update({ claimed_at: old }).eq('id', messageId);
  if (error) throw new Error(`backdate: ${error.message}`);
}

beforeAll(async () => {
  t = newTracker('snd');
  mc = await createTestUser({}, { account_type: 'vendor' });
  restoreGlobals = await saveGlobals(db);
  campaignId = await makeCampaign(db, t, 'active');
  pausedCampaignId = await makeCampaign(db, t, 'paused');
  ({ sequenceId, step1Id, step2Id } = await makeSequence(db, t));
  resetFakeGmail(OWN_EMAIL);
});

afterAll(async () => {
  await cleanupTracked(db, t);
  await restoreGlobals();
  await mc?.cleanup();
});

beforeEach(() => {
  resetFakeGmail(OWN_EMAIL);
});

describe('email send path', () => {
  it('sends a due first email exactly once and schedules the follow-up', async () => {
    const p = await dueProspect('happy');
    await pass();

    const sent = sendsTo(p.email);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe('Hello Ava');
    expect(sent[0]!.body).toBe('First touch');

    const row = await messageRow(db, p.messageId);
    expect(row.status).toBe('sent');
    expect(row.gmail_message_id).toBe(sent[0]!.id);
    expect(row.gmail_thread_id).toBe(sent[0]!.threadId);
    expect(row.rfc_message_id).toBe(sent[0]!.rfcMessageId);
    expect(row.sent_at).not.toBeNull();

    const { data: follow } = await db.from('outreach_messages').select('status, scheduled_for, step_id')
      .eq('enrollment_id', p.enrollmentId).eq('step_id', step2Id).single();
    expect(follow!.status).toBe('scheduled');
    // Step two waits three days after the real send.
    expect(Date.parse(follow!.scheduled_for)).toBeGreaterThan(Date.now() + 2 * 86_400_000);

    const { data: enr } = await db.from('outreach_enrollments').select('current_position, status').eq('id', p.enrollmentId).single();
    expect(enr).toEqual({ current_position: 2, status: 'active' });

    const { data: events } = await db.from('outreach_events').select('type').eq('message_id', p.messageId);
    expect(events!.map((e) => e.type)).toContain('email_sent');
  });

  it('does not requeue an accepted send when the bookkeeping after it throws', async () => {
    const p = await dueProspect('bookkeeping');
    failNextAfterSend();
    await pass();

    // Gmail accepted it, so the row is 'sent', not 'scheduled'.
    const row = await messageRow(db, p.messageId);
    expect(row.status).toBe('sent');
    expect(row.gmail_message_id).not.toBeNull();
    expect(sendsTo(p.email)).toHaveLength(1);
    expect(recordedAlerts().some((a) => a.source === 'outreach.after_send')).toBe(true);

    // Later passes must not send it again.
    await pass();
    await pass();
    expect(sendsTo(p.email)).toHaveLength(1);
    expect(sendCallCount()).toBe(1);
  });

  it('leaves a timed-out send in sending, then the reaper records it without resending', async () => {
    const p = await dueProspect('accepted-lost');
    queueSendFaults({ kind: 'accepted-then-timeout' });
    await pass();

    // Unknown outcome: the row waits for the reaper rather than being retried now.
    let row = await messageRow(db, p.messageId);
    expect(row.status).toBe('sending');
    expect(row.error).toMatch(/timeout/);
    expect(row.rfc_message_id).not.toBeNull();

    await pass();
    expect(sendCallCount()).toBe(1);

    await backdateClaim(p.messageId);
    await pass();

    const accepted = acceptedSends().find((m) => m.to === p.email)!;
    row = await messageRow(db, p.messageId);
    expect(row.status).toBe('sent');
    expect(row.gmail_message_id).toBe(accepted.id);
    expect(row.gmail_thread_id).toBe(accepted.threadId);
    expect(sendCallCount()).toBe(1);
    expect(sendsTo(p.email)).toHaveLength(1);
  });

  it.each([
    { label: 'a dropped send (timeout)', fault: { kind: 'timeout' } as const },
    { label: 'a 503 from Gmail', fault: { kind: 'status', status: 503 } as const },
  ])('requeues $label once the reaper finds Gmail has no record, then sends it once', async ({ fault }) => {
    const p = await dueProspect(`dropped-${fault.kind}`);
    queueSendFaults(fault);
    await pass();

    let row = await messageRow(db, p.messageId);
    expect(row.status).toBe('sending');
    expect(sendsTo(p.email)).toHaveLength(0);

    await backdateClaim(p.messageId);
    await pass();
    // Gmail has no record of it, so the attempt is counted and the message goes back in the queue.
    row = await messageRow(db, p.messageId);
    expect(row.status).toBe('scheduled');
    expect(row.attempts).toBe(1);
    expect(sendsTo(p.email)).toHaveLength(0);

    // The queue is ordered by scheduled time, so the requeued row goes out on the next pass.
    await pass();
    row = await messageRow(db, p.messageId);
    expect(row.status).toBe('sent');
    expect(row.attempts).toBe(2);
    expect(sendsTo(p.email)).toHaveLength(1);
  });

  it.each([429, 403])('pauses sending on a %i and does not retry the message', async (status) => {
    const p = await dueProspect(`refused-${status}`);
    queueSendFaults({ kind: 'status', status });
    await pass();

    const { data: settings } = await db.from('outreach_settings').select('sending_paused, paused_reason').eq('id', true).single();
    expect(settings!.sending_paused).toBe(true);
    expect(settings!.paused_reason).toContain(String(status));
    const row = await messageRow(db, p.messageId);
    expect(row.status).toBe('scheduled');
    expect(row.attempts).toBe(0);
    expect(recordedAlerts().some((a) => a.type === 'outreach_paused')).toBe(true);

    // Paused: a later pass does not call Gmail at all.
    await pass();
    expect(sendCallCount()).toBe(1);
    expect(sendsTo(p.email)).toHaveLength(0);
    await resumeAndCancel(p.messageId);
  });

  it('treats a definitive 4xx refusal as a stop: pauses, alerts, and fails the message without retrying', async () => {
    const p = await dueProspect('refused-400');
    queueSendFaults({ kind: 'status', status: 400 });
    await pass();
    await pass();

    const row = await messageRow(db, p.messageId);
    expect(row.status).toBe('failed');
    expect(row.error).toContain('400');
    expect(sendCallCount()).toBe(1);
    expect(sendsTo(p.email)).toHaveLength(0);
    const { data: settings } = await db.from('outreach_settings').select('sending_paused').eq('id', true).single();
    expect(settings!.sending_paused).toBe(true);
    expect(recordedAlerts().some((a) => a.type === 'outreach_paused')).toBe(true);
    await resumeAndCancel(p.messageId);
  });

  it('fails only the one message on a 404 (a deleted thread) and keeps sending', async () => {
    // One due message when the fault fires: two due at the same instant send in no fixed order.
    const gone = await dueProspect('thread-gone');
    queueSendFaults({ kind: 'status', status: 404 });
    await pass();
    const next = await dueProspect('after-gone');
    await pass();

    expect((await messageRow(db, gone.messageId)).status).toBe('failed');
    const { data: settings } = await db.from('outreach_settings').select('sending_paused').eq('id', true).single();
    expect(settings!.sending_paused).toBe(false);
    expect(sendsTo(next.email)).toHaveLength(1);
  });

  describe('send-time gates', () => {
    it('cancels a suppressed address without calling Gmail', async () => {
      const p = await dueProspect('suppressed');
      t.suppressedEmails.push(p.email);
      const { error } = await db.from('outreach_suppression').insert({ kind: 'email', value: p.email, reason: 'opted_out', source: 'test' });
      expect(error).toBeNull();
      await pass();
      const row = await messageRow(db, p.messageId);
      expect(row).toMatchObject({ status: 'cancelled', skip_reason: 'suppressed' });
      expect(sendsTo(p.email)).toHaveLength(0);
    });

    it('cancels an existing customer, judged by the linked user', async () => {
      const p = await dueProspect('customer', { linked_user_id: mc.id });
      await pass();
      const row = await messageRow(db, p.messageId);
      expect(row).toMatchObject({ status: 'cancelled', skip_reason: 'existing_customer' });
      expect(sendsTo(p.email)).toHaveLength(0);
    });

    it('cancels an address that was only found, never confirmed', async () => {
      const p = await dueProspect('found', { email_source: 'found' });
      await pass();
      const row = await messageRow(db, p.messageId);
      expect(row).toMatchObject({ status: 'cancelled', skip_reason: 'unconfirmed_email' });
      expect(sendsTo(p.email)).toHaveLength(0);
    });

    it('cancels when the footer would show no contact details', async () => {
      const p = await dueProspect('no-identity');
      await patchSettings(db, { signature: 'Just a name' });
      try {
        await pass();
      } finally {
        await patchSettings(db, { signature: SIGNATURE });
      }
      const row = await messageRow(db, p.messageId);
      expect(row).toMatchObject({ status: 'cancelled', skip_reason: 'no_sender_identity' });
      expect(sendsTo(p.email)).toHaveLength(0);
    });
  });

  it('reschedules a due email that falls outside its recipient\'s window instead of sending it', async () => {
    const p = await dueProspect('window');
    const todayWeekday = localParts(new Date(), 'Australia/Melbourne').weekday;
    const allButToday = [1, 2, 3, 4, 5, 6, 7].filter((d) => d !== todayWeekday);
    await patchSettings(db, { send_weekdays: allButToday });
    try {
      await pass();
    } finally {
      await patchSettings(db, { send_weekdays: [1, 2, 3, 4, 5, 6, 7] });
    }

    expect(sendsTo(p.email)).toHaveLength(0);
    const row = await messageRow(db, p.messageId);
    expect(row.status).toBe('scheduled');
    expect(row.attempts).toBe(0);
    expect(Date.parse(row.scheduled_for)).toBeGreaterThan(Date.now());
  });

  it('does not claim a due email whose campaign is paused', async () => {
    const p = await dueProspect('paused-campaign', {}, pausedCampaignId);
    await pass();
    expect(sendsTo(p.email)).toHaveLength(0);
    const row = await messageRow(db, p.messageId);
    expect(row.status).toBe('scheduled');
    await db.from('outreach_messages').update({ status: 'cancelled', skip_reason: 'test_cleanup' }).eq('id', p.messageId);
  });

  it('cancels the follow-up when the person has replied in the thread since our last email', async () => {
    const p = await dueProspect('replied');
    await pass();
    const first = await messageRow(db, p.messageId);
    expect(first.status).toBe('sent');

    injectInbound({ from: p.email, threadId: first.gmail_thread_id!, body: 'Thanks, tell me more' });
    // Make the follow-up due now, so only the reply guard stands between it and Gmail.
    await db.from('outreach_messages').update({ scheduled_for: new Date(Date.now() - 60_000).toISOString() })
      .eq('enrollment_id', p.enrollmentId).eq('step_id', step2Id);
    await pass();

    const { data: follow } = await db.from('outreach_messages').select('status, skip_reason')
      .eq('enrollment_id', p.enrollmentId).eq('step_id', step2Id).single();
    expect(follow).toEqual({ status: 'cancelled', skip_reason: 'reply_in_thread' });
    expect(sendsTo(p.email)).toHaveLength(1);
    expect(threadReads()).toContain(first.gmail_thread_id);
    expect((await prospectRow(db, p.id)).do_not_contact).toBe(false);
  });
});
