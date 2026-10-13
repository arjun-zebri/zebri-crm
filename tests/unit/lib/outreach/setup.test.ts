/**
 * Setup guide derivation: which of the five steps are done, which one is
 * current (the only one that gets a button), the N-of-5 count, and the
 * booking and Instagram sub-rows.
 */
import { describe, expect, it } from 'vitest';

import { deriveSetup, type SetupFacts } from '@/lib/outreach/setup';

/** A brand-new account: nothing done, every server key present. */
const fresh: SetupFacts = {
  mailboxConnected: false,
  gmailConfigured: true,
  senderName: '',
  signature: '',
  prospectCount: 0,
  checkedCount: 0,
  sequenceCount: 0,
  launchedCampaignCount: 0,
  apifyConfigured: true,
  usesBooking: false,
  bookingPageSet: false,
};

/** Every required step done. */
const finished: SetupFacts = {
  mailboxConnected: true,
  gmailConfigured: true,
  senderName: 'Jo',
  signature: 'Jo, Zebri\njo@example.com',
  prospectCount: 120,
  checkedCount: 80,
  sequenceCount: 2,
  launchedCampaignCount: 1,
  apifyConfigured: true,
  usesBooking: false,
  bookingPageSet: false,
};

const step = (f: SetupFacts, n: number) => deriveSetup(f).steps[n - 1]!;

describe('deriveSetup', () => {
  it('starts with five steps, none done, the first one current', () => {
    const s = deriveSetup(fresh);
    expect(s.steps.map((x) => x.number)).toEqual([1, 2, 3, 4, 5]);
    expect(s.doneCount).toBe(0);
    expect(s.total).toBe(5);
    expect(s.complete).toBe(false);
    expect(s.currentKey).toBe('gmail');
    expect(s.steps.filter((x) => x.current).map((x) => x.key)).toEqual(['gmail']);
  });

  it('is complete when every required step is done', () => {
    const s = deriveSetup(finished);
    expect(s.doneCount).toBe(5);
    expect(s.complete).toBe(true);
    expect(s.currentKey).toBeNull();
    expect(s.steps.every((x) => x.current === false)).toBe(true);
  });

  it('counts a check run as done once any prospect has a verdict', () => {
    const s = deriveSetup({ ...fresh, prospectCount: 5, checkedCount: 0 });
    expect(step({ ...fresh, prospectCount: 5 }, 2).done).toBe(true);
    expect(s.steps[2]?.done).toBe(false);
    expect(deriveSetup({ ...fresh, prospectCount: 5, checkedCount: 1 }).steps[2]?.done).toBe(true);
  });

  it('makes the first undone step current, even when a later one is done', () => {
    // Why: the founder may have imported before connecting Gmail; the guide still points at the gap.
    const s = deriveSetup({ ...fresh, prospectCount: 5, sequenceCount: 1 });
    expect(s.currentKey).toBe('gmail');
    expect(s.doneCount).toBe(2);
  });

  it('keeps the Gmail step done only when the mailbox AND sender AND signature are set', () => {
    expect(step({ ...fresh, mailboxConnected: true, senderName: 'Jo' }, 1).done).toBe(false);
    expect(step({ ...fresh, mailboxConnected: true, senderName: 'Jo', signature: 'jo@example.com' }, 1).done).toBe(true);
    expect(step({ ...fresh, senderName: 'Jo', signature: 'jo@example.com' }, 1).done).toBe(false);
  });

  it('asks for the identity once the mailbox is connected, with the sending-setup button', () => {
    const g = step({ ...fresh, mailboxConnected: true }, 1);
    expect(g.description).toBe('Add your sender name and signature');
    expect(g.buttonLabel).toBe('Finish sending setup');
    expect(g.href).toBe('/admin/outreach?view=settings#sending');
  });

  it('offers Connect Gmail when nothing is connected and the server keys exist', () => {
    const g = step(fresh, 1);
    expect(g.buttonLabel).toBe('Connect Gmail');
    expect(g.href).toBe('/admin/outreach?view=settings#mailbox');
    expect(g.description).toBe('Emails send from your inbox. Replies land there too.');
  });

  it('drops the button and says what is missing when the server has no Google keys', () => {
    const g = step({ ...fresh, gmailConfigured: false }, 1);
    expect(g.buttonLabel).toBeNull();
    expect(g.description).toBe("Gmail isn't set up on the server yet. Ask your developer to add the Google keys.");
    expect(g.description).not.toMatch(/OUTREACH_|_CLIENT|_SECRET/);
  });

  it('links each later step to its own deep link', () => {
    const s = deriveSetup({ ...fresh, mailboxConnected: true, senderName: 'Jo', signature: 'jo@example.com' });
    expect(s.steps.map((x) => x.href)).toEqual([
      '/admin/outreach?view=settings#mailbox',
      '/admin/outreach?view=prospects&import=1',
      '/admin/outreach?view=prospects&check=1',
      '/admin/outreach?view=sequences&new=template',
      '/admin/outreach?view=campaigns&new=1',
    ]);
  });

  it('only gives the current step a button label', () => {
    const s = deriveSetup({ ...fresh, mailboxConnected: true, senderName: 'Jo', signature: 'jo@example.com', prospectCount: 3 });
    const labelled = s.steps.filter((x) => x.buttonLabel !== null).map((x) => x.key);
    expect(labelled).toEqual(['check']);
  });

  it('shows the booking gap as a warning on the campaign step and keeps that step open', () => {
    const f: SetupFacts = { ...finished, usesBooking: true, bookingPageSet: false };
    const s = deriveSetup(f);
    expect(s.bookingWarning).toBe(true);
    expect(s.steps[4]?.done).toBe(false);
    expect(s.complete).toBe(false);
    expect(s.currentKey).toBe('campaign');
  });

  it('does not warn about booking when no template uses it', () => {
    expect(deriveSetup({ ...finished, usesBooking: false, bookingPageSet: false }).bookingWarning).toBe(false);
  });

  it('reports Instagram lookups as optional and never counts it', () => {
    const off = deriveSetup({ ...finished, apifyConfigured: false });
    expect(off.optional.done).toBe(false);
    expect(off.optional.description).toBe('Ask your developer to add the Apify key to turn on Instagram checks.');
    expect(off.complete).toBe(true);
    expect(off.doneCount).toBe(5);
    expect(deriveSetup(finished).optional.done).toBe(true);
  });
});
