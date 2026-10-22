/**
 * Readiness rules: which rows show, which block activation, which count as
 * "to do", and the sentences the Activate guard returns. The Settings and
 * Campaigns checklists and the activation check all read these, so they
 * are tested once, here.
 */
import { describe, expect, it } from 'vitest';

import { activationProblems, readinessItems, requiredMissing, type ReadinessFacts } from '@/lib/outreach/readiness';

const ready: ReadinessFacts = {
  mailboxConnected: true,
  gmailConfigured: true,
  senderName: 'Jo Bloggs',
  signature: 'Jo, Zebri\njo@example.com',
  bookingPageSet: true,
  apifyConfigured: true,
  sendingPaused: false,
  usesEmail: true,
  usesBooking: true,
};

const byKey = (f: ReadinessFacts) => Object.fromEntries(readinessItems(f).map((i) => [i.key, i]));

describe('readinessItems', () => {
  it('reports every row done when the account is fully set up', () => {
    const items = readinessItems(ready);
    expect(items.every((i) => i.done)).toBe(true);
    expect(activationProblems(ready)).toEqual([]);
  });

  it('lists rows in setup order, with no sending-pause row (the banner covers it)', () => {
    expect(readinessItems(ready).map((i) => i.key)).toEqual(['mailbox', 'sender', 'signature', 'booking', 'apify']);
  });

  it('uses verb labels for the required rows', () => {
    const labels = readinessItems({ ...ready, mailboxConnected: false, senderName: '', signature: '', bookingPageSet: false }).map((i) => i.label);
    expect(labels).toEqual(['Connect Gmail', 'Add your sender name', 'Add your signature', 'Pick a booking page', 'Instagram lookups']);
  });

  it('hides the booking row when no template uses {{booking_link}}', () => {
    const items = byKey({ ...ready, usesBooking: false, bookingPageSet: false });
    expect(items.booking?.shown).toBe(false);
    expect(items.booking?.blocksActivation).toBe(false);
  });

  it('treats a blank sender name or signature as missing, even when it is only spaces', () => {
    // Why: the loader trims before calling this, but a whitespace-only string must still count as missing.
    const items = byKey({ ...ready, senderName: '', signature: '' });
    expect(items.sender?.done).toBe(false);
    expect(items.signature?.done).toBe(false);
  });

  it('marks Instagram lookups optional and never blocking, even when missing', () => {
    const items = byKey({ ...ready, apifyConfigured: false });
    expect(items.apify?.done).toBe(false);
    expect(items.apify?.optional).toBe(true);
    expect(items.apify?.blocksActivation).toBe(false);
    expect(activationProblems({ ...ready, apifyConfigured: false })).toEqual([]);
  });

  it('never names a server setting in user copy', () => {
    const text = readinessItems({ ...ready, apifyConfigured: false, mailboxConnected: false, gmailConfigured: false })
      .flatMap((i) => [i.label, i.detail, i.activationMessage])
      .join(' ');
    expect(text).not.toMatch(/APIFY_TOKEN|OUTREACH_GOOGLE|_CLIENT_|_SECRET/);
    expect(text).toContain('Ask your developer to add the Apify key');
  });

  it("says Gmail isn't set up on the server when OAuth keys are missing", () => {
    const mailbox = byKey({ ...ready, mailboxConnected: false, gmailConfigured: false }).mailbox;
    expect(mailbox?.detail).toBe("Gmail isn't set up on the server yet. Ask your developer to add the Google keys.");
  });
});

describe('requiredMissing', () => {
  it('leaves out done rows, hidden rows and optional rows', () => {
    const items = readinessItems({ ...ready, apifyConfigured: false, mailboxConnected: false, usesBooking: false });
    expect(requiredMissing(items).map((i) => i.key)).toEqual(['mailbox']);
  });

  it('is empty when only optional rows are missing', () => {
    expect(requiredMissing(readinessItems({ ...ready, apifyConfigured: false }))).toEqual([]);
  });
});

describe('activationProblems', () => {
  it('blocks email activation when the mailbox is missing', () => {
    expect(activationProblems({ ...ready, mailboxConnected: false })).toEqual([
      'Connect your Gmail in Settings before activating a campaign with email steps.',
    ]);
  });

  it('does not block a campaign with no email steps, even with no mailbox or identity', () => {
    const f = { ...ready, mailboxConnected: false, senderName: '', signature: '', usesEmail: false };
    expect(activationProblems(f)).toEqual([]);
  });

  it('names the identity problem once when sender and signature are both missing', () => {
    const problems = activationProblems({ ...ready, senderName: '', signature: '' });
    expect(problems).toEqual(['Add your sender name and signature in Settings first. Every email must say who it is from.']);
  });

  it('blocks a booking template when no booking page is chosen', () => {
    expect(activationProblems({ ...ready, bookingPageSet: false })).toEqual([
      'Your templates use {{booking_link}}. Pick a booking page in Settings first.',
    ]);
  });

  it('reports every blocker in setup order, so the first one matches the checklist', () => {
    const problems = activationProblems({ ...ready, mailboxConnected: false, signature: '', bookingPageSet: false });
    expect(problems).toHaveLength(3);
    expect(problems[0]).toMatch(/Gmail/);
  });
});

describe('email identity gates activation', () => {
  it('blocks activation of an email campaign until sender name and signature are set', () => {
    const problems = activationProblems({ ...ready, senderName: '', signature: '' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('sender name');
  });

  it('blocks activation when the signature has no email, phone or web address', () => {
    const problems = activationProblems({ ...ready, signature: 'Jo Bloggs, Celebrant' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('email, phone or web address');
  });

  it('allows a signature with contact details', () => {
    expect(activationProblems({ ...ready, signature: 'Jo Bloggs\n0412 345 678' })).toEqual([]);
  });

  it('does not block a campaign with no email steps', () => {
    expect(activationProblems({ ...ready, usesEmail: false, senderName: '', signature: '' })).toEqual([]);
  });
});
