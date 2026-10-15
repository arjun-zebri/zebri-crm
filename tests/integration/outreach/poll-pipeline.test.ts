/**
 * The reply poll end to end: which threads are watched, how each inbound
 * message is classified and recorded, and what survives a failure part-way.
 * Runs against local Supabase with the fake Gmail (fake-gmail.ts).
 *
 * The poll writes a 'replied' event last for every inbound message it acts
 * on; that event is the "handled" marker. These tests check the markers and
 * the state they imply, not just call counts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { pollMailbox } from '@/lib/outreach/services/poll';

import { serviceClient } from '../helpers/supabase';

import {
  failNextOptOut, injectInbound, recordedAlerts, resetFakeGmail, seedOwnMail, threadReads, type FakeMail,
} from './fake-gmail';
import {
  cleanupTracked, enrol, makeCampaign, makeProspect, makeSequence, newTracker, OWN_EMAIL, prospectRow,
  saveGlobals, type Tracker,
} from './pipeline-fixtures';

vi.mock('@/lib/outreach/gmail/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/outreach/gmail/client')>();
  const fake = await import('./fake-gmail');
  fake.bindGmailError(real.GmailError);
  return { ...real, GmailClient: fake.FakeGmailClient };
});

vi.mock('@/lib/outreach/services/settings', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/outreach/services/settings')>();
  return {
    ...real,
    mailboxAccess: async () => ({ email: 'outreach-owner@zebri.test', accessToken: 'fake-token' }),
  };
});

// An opt-out that fails once after it has written its state, before the poll records its marker.
vi.mock('@/lib/outreach/services/events', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/outreach/services/events')>();
  const fake = await import('./fake-gmail');
  return {
    ...real,
    optOut: async (...args: Parameters<typeof real.optOut>) => {
      await real.optOut(...args);
      if (fake.takeOptOutFault()) throw new Error('simulated failure after opt-out');
    },
  };
});

vi.mock('@/lib/alerts/send-alert', async () => {
  const fake = await import('./fake-gmail');
  return { sendAlert: fake.recordAlert };
});

const db = serviceClient();
const deadline = () => Date.now() + 60_000;
/** Forced, so the five-minute throttle never hides a poll. */
const poll = () => pollMailbox(db, deadline(), true);

let t: Tracker;
let restoreGlobals: () => Promise<void>;
let campaignId = '';
let sequenceId = '';
let step1Id = '';
let step2Id = '';

/**
 * A prospect we have emailed: an enrolment, a sent first email, and the
 * matching thread in the fake mailbox. Its reply cursor starts at `checkedAt`.
 */
async function contacted(n: string, opts: { checkedAt?: string; withFollowUp?: boolean } = {}) {
  const p = await makeProspect(db, t, n);
  const enrollmentId = await enrol(db, campaignId, p.id, sequenceId);
  const threadId = `thr-${t.tag}-${n}`;
  const mail = seedOwnMail({ threadId, to: p.email });
  const sentAt = new Date(Date.now() - 3_600_000).toISOString();
  const { data: msg, error } = await db.from('outreach_messages').insert({
    enrollment_id: enrollmentId, prospect_id: p.id, step_id: step1Id, channel: 'email', status: 'sent',
    scheduled_for: sentAt, sent_at: sentAt, subject: 'Hello Ava', body: 'First touch',
    gmail_message_id: mail.id, gmail_thread_id: threadId, rfc_message_id: mail.rfcMessageId,
    reply_checked_at: opts.checkedAt ?? null,
  }).select('id').single();
  if (error || !msg) throw new Error(`sent message: ${error?.message}`);
  if (opts.withFollowUp) {
    const { error: fErr } = await db.from('outreach_messages').insert({
      enrollment_id: enrollmentId, prospect_id: p.id, step_id: step2Id, channel: 'email', status: 'scheduled',
      scheduled_for: new Date(Date.now() + 3 * 86_400_000).toISOString(), subject: 'Re: Hello Ava', body: 'Following up',
    });
    if (fErr) throw new Error(`follow-up: ${fErr.message}`);
  }
  return { ...p, enrollmentId, threadId };
}

/** Handled markers for one Gmail message id. */
async function markersFor(gmailId: string) {
  const { data, error } = await db.from('outreach_events').select('type, payload')
    .in('type', ['replied', 'email_bounced', 'auto_reply_received'])
    .eq('payload->>gmail_message_id', gmailId);
  if (error) throw new Error(`markers: ${error.message}`);
  return data ?? [];
}

async function eventsOf(prospectId: string, type: string) {
  const { data, error } = await db.from('outreach_events').select('id, payload').eq('prospect_id', prospectId).eq('type', type);
  if (error) throw new Error(`events: ${error.message}`);
  return data ?? [];
}

beforeAll(async () => {
  t = newTracker('poll');
  restoreGlobals = await saveGlobals(db);
  campaignId = await makeCampaign(db, t, 'active');
  ({ sequenceId, step1Id, step2Id } = await makeSequence(db, t));
  // Reset once, not per test: earlier tests' prospects keep their threads in the
  // database, and the poll reads every one of them, as real Gmail would.
  resetFakeGmail(OWN_EMAIL);
});

afterAll(async () => {
  await cleanupTracked(db, t);
  await restoreGlobals();
});

describe('reply poll', () => {
  it('records a reply in one of our threads and stops the sequence', async () => {
    const p = await contacted('reply', { withFollowUp: true });
    const reply: FakeMail = injectInbound({ from: p.email, threadId: p.threadId, body: 'Sounds good, what dates?' });
    const result = await poll();

    expect(result).toMatchObject({ polled: true, replies: 1, bounces: 0, optOuts: 0 });
    const markers = await markersFor(reply.id);
    expect(markers).toHaveLength(1);
    expect(markers[0]!.type).toBe('replied');
    expect(markers[0]!.payload).toMatchObject({ gmail_message_id: reply.id, thread_id: p.threadId });

    const { data: enr } = await db.from('outreach_enrollments').select('status, stop_reason').eq('id', p.enrollmentId).single();
    expect(enr).toEqual({ status: 'stopped', stop_reason: 'replied' });
    const { data: follow } = await db.from('outreach_messages').select('status, skip_reason').eq('enrollment_id', p.enrollmentId).eq('step_id', step2Id).single();
    expect(follow).toEqual({ status: 'cancelled', skip_reason: 'replied' });
    expect((await prospectRow(db, p.id)).do_not_contact).toBe(false);
  });

  it('finds a reply that starts a new thread through the fresh-mail sweep', async () => {
    const p = await contacted('fresh');
    const reply = injectInbound({ from: `"Ava" <${p.email.toUpperCase()}>`, threadId: `thr-new-${t.tag}`, body: 'Hi, yes please' });
    await poll();
    const markers = await markersFor(reply.id);
    expect(markers.map((m) => m.type)).toEqual(['replied']);
    const { data: enr } = await db.from('outreach_enrollments').select('status').eq('id', p.enrollmentId).single();
    expect(enr!.status).toBe('stopped');
  });

  it('does not count mail the prospect sent before the first email as a reply', async () => {
    // A prospect who had emailed the mailbox earlier the same day was marked
    // "replied" as soon as the first email went out, and the sequence stopped.
    const p = await contacted('earlier');
    const earlier = injectInbound({
      from: p.email, threadId: `thr-earlier-${t.tag}`, body: "I'm ready", internalDate: Date.now() - 2 * 3_600_000,
    });
    const result = await poll();
    expect(result.replies).toBe(0);
    expect(await markersFor(earlier.id)).toEqual([]);
    const { data: enr } = await db.from('outreach_enrollments').select('status').eq('id', p.enrollmentId).single();
    expect(enr!.status).toBe('active');
  });

  it('handles each inbound message once: a second poll does nothing new', async () => {
    const p = await contacted('idempotent');
    const reply = injectInbound({ from: p.email, threadId: p.threadId, body: 'Tell me more' });
    await poll();
    const again = await poll();
    expect(again.replies).toBe(0);
    expect(await markersFor(reply.id)).toHaveLength(1);
    expect(await eventsOf(p.id, 'replied')).toHaveLength(1);
  });

  it('opts out an unsubscribe with an empty body, suppresses the address, and stops the sequence', async () => {
    const p = await contacted('unsub', { withFollowUp: true });
    t.suppressedEmails.push(p.email);
    const unsub = injectInbound({ from: p.email, threadId: p.threadId, subject: 'unsubscribe', body: '' });
    const result = await poll();

    expect(result.optOuts).toBe(1);
    expect(await markersFor(unsub.id)).toHaveLength(1);
    const prospect = await prospectRow(db, p.id);
    expect(prospect).toMatchObject({ do_not_contact: true, stage: 'opted_out' });
    const { data: suppressed } = await db.from('outreach_suppression').select('reason, source').eq('kind', 'email').eq('value', p.email);
    expect(suppressed).toEqual([{ reason: 'opted_out', source: 'email_reply' }]);
    const { data: enr } = await db.from('outreach_enrollments').select('status, stop_reason').eq('id', p.enrollmentId).single();
    expect(enr).toEqual({ status: 'stopped', stop_reason: 'opted_out' });
    const { data: follow } = await db.from('outreach_messages').select('status').eq('enrollment_id', p.enrollmentId).eq('step_id', step2Id).single();
    expect(follow!.status).toBe('cancelled');
    expect(await eventsOf(p.id, 'opted_out')).toHaveLength(1);
  });

  it('suppresses a bounced address without marking the person do-not-contact', async () => {
    const p = await contacted('bounce', { withFollowUp: true });
    t.suppressedEmails.push(p.email);
    const bounce = injectInbound({
      from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>', threadId: p.threadId,
      subject: 'Delivery Status Notification (Failure)', body: 'Address not found.',
      headers: { 'Content-Type': 'multipart/report; report-type=delivery-status' },
    });
    const result = await poll();

    expect(result.bounces).toBe(1);
    expect(await markersFor(bounce.id)).toHaveLength(1);
    const prospect = await prospectRow(db, p.id);
    expect(prospect).toMatchObject({ email_check: 'bounced', do_not_contact: false });
    const { data: suppressed } = await db.from('outreach_suppression').select('reason').eq('kind', 'email').eq('value', p.email);
    expect(suppressed).toEqual([{ reason: 'bounced' }]);
    const { data: follow } = await db.from('outreach_messages').select('status, skip_reason').eq('enrollment_id', p.enrollmentId).eq('step_id', step2Id).single();
    expect(follow).toEqual({ status: 'cancelled', skip_reason: 'bounced' });
    const { data: enr } = await db.from('outreach_enrollments').select('status, stop_reason').eq('id', p.enrollmentId).single();
    expect(enr).toEqual({ status: 'stopped', stop_reason: 'bounced' });
    expect(await eventsOf(p.id, 'email_bounced')).toHaveLength(1);

    // Handled once: a second poll records no second bounce.
    const again = await poll();
    expect(again.bounces).toBe(0);
    expect(await eventsOf(p.id, 'email_bounced')).toHaveLength(1);
  });

  it('ignores our own mail, even one that reads like an opt-out', async () => {
    const p = await contacted('own');
    injectInbound({ from: OWN_EMAIL, threadId: p.threadId, subject: 'unsubscribe', body: 'stop emailing me' });
    const result = await poll();

    expect(result).toMatchObject({ replies: 0, optOuts: 0, bounces: 0 });
    expect((await prospectRow(db, p.id)).do_not_contact).toBe(false);
    expect(await eventsOf(p.id, 'replied')).toHaveLength(0);
    expect(await eventsOf(p.id, 'opted_out')).toHaveLength(0);
    const { data: enr } = await db.from('outreach_enrollments').select('status').eq('id', p.enrollmentId).single();
    expect(enr!.status).toBe('active');
  });

  it('retries a message whose handling failed part-way, because the marker is written last', async () => {
    const p = await contacted('retry');
    t.suppressedEmails.push(p.email);
    const unsub = injectInbound({ from: p.email, threadId: p.threadId, subject: 'unsubscribe', body: '' });

    failNextOptOut();
    await expect(poll()).rejects.toThrow('simulated failure after opt-out');
    // State was written before the failure, but no marker, so the message is not yet "handled".
    expect(await markersFor(unsub.id)).toHaveLength(0);
    expect((await prospectRow(db, p.id)).do_not_contact).toBe(true);

    await poll();
    expect(await markersFor(unsub.id)).toHaveLength(1);
    expect(await eventsOf(p.id, 'opted_out')).toHaveLength(1);
    expect((await prospectRow(db, p.id)).do_not_contact).toBe(true);
    expect(recordedAlerts().some((a) => a.kind === 'opt_out')).toBe(true);
  });

  it('still watches the thread after the sequence has run out of steps', async () => {
    // The last email is when a late "yes" usually arrives, and a completed
    // enrolment has no stopped_at. A colleague replies, so only the thread
    // sweep (not the fresh-mail search by the prospect's address) can find it.
    const p = await contacted('completed');
    const { error } = await db.from('outreach_enrollments').update({ status: 'completed' }).eq('id', p.enrollmentId);
    if (error) throw new Error(`complete: ${error.message}`);
    const reply = injectInbound({ from: 'assistant@celebrant.example', threadId: p.threadId, body: 'Yes, count us in.' });
    await poll();
    expect(await markersFor(reply.id)).toHaveLength(1);
  });

  it('reaches threads beyond the first page by rotating the reply cursor', async () => {
    const N = 105;
    const base = Date.now() - 3 * 86_400_000;
    const prospects = await Promise.all(Array.from({ length: N }, (_, i) => makeProspect(db, t, `cursor${i}`)));
    const { data: enrs, error: eErr } = await db.from('outreach_enrollments').insert(
      prospects.map((p) => ({ campaign_id: campaignId, prospect_id: p.id, sequence_id: sequenceId })),
    ).select('id, prospect_id');
    if (eErr || !enrs) throw new Error(`enrolments: ${eErr?.message}`);

    const threads = prospects.map((_, i) => `thr-${t.tag}-cursor${i}`);
    prospects.forEach((p, i) => seedOwnMail({ threadId: threads[i]!, to: p.email }));
    const { error: mErr } = await db.from('outreach_messages').insert(prospects.map((p, i) => ({
      enrollment_id: enrs.find((e) => e.prospect_id === p.id)!.id, prospect_id: p.id, step_id: step1Id,
      channel: 'email', status: 'sent', scheduled_for: new Date(base).toISOString(), sent_at: new Date(base).toISOString(),
      subject: 'Hello Ava', body: 'First touch', gmail_message_id: `gm-cursor-${i}`, gmail_thread_id: threads[i]!,
      rfc_message_id: `<cursor${i}@zebri.test>`,
      // Thread i was last checked i minutes after `base`, so index 0 is the stalest.
      reply_checked_at: new Date(base + i * 60_000).toISOString(),
    })));
    if (mErr) throw new Error(`cursor messages: ${mErr.message}`);

    // Index 102 is past the first 100 threads. Someone other than the prospect replies, so the
    // fresh-mail sweep cannot find it: only the thread sweep can.
    const target = 102;
    const reply = injectInbound({ from: 'colleague@venue.example', threadId: threads[target]!, body: 'Ava is away, I can help.' });

    const first = await poll();
    expect(threadReads()).not.toContain(threads[target]);
    expect(await markersFor(reply.id)).toHaveLength(0);
    expect(first.replies).toBe(0);

    const second = await poll();
    expect(threadReads()).toContain(threads[target]);
    expect(second.replies).toBe(1);
    expect(await markersFor(reply.id)).toHaveLength(1);
  }, 120_000);
});
