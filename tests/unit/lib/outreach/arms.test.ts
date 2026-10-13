import { describe, expect, it } from 'vitest';

import { availabilityOf, eligibleArms, pickWeighted } from '@/lib/outreach/sequencer/arms';

const arms = [
  { sequenceId: 'email-only', weight: 1, channels: ['email' as const] },
  { sequenceId: 'ig-first', weight: 1, channels: ['instagram' as const, 'email' as const] },
  { sequenceId: 'off', weight: 0, channels: ['email' as const] },
];

describe('eligibleArms', () => {
  it('needs every channel the arm uses', () => {
    expect(eligibleArms(arms, { email: true, instagram: false }).map((a) => a.sequenceId)).toEqual(['email-only']);
    expect(eligibleArms(arms, { email: true, instagram: true }).map((a) => a.sequenceId)).toEqual(['email-only', 'ig-first']);
    expect(eligibleArms(arms, { email: false, instagram: true })).toEqual([]);
  });
});

describe('pickWeighted', () => {
  it('respects weights', () => {
    const items = [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }];
    expect(pickWeighted(items, () => 0.1)?.id).toBe('a');
    expect(pickWeighted(items, () => 0.3)?.id).toBe('b');
    expect(pickWeighted([{ weight: 0 }], () => 0.5)).toBeNull();
  });
});

describe('availabilityOf', () => {
  it('requires a checked email and a reachable IG', () => {
    expect(availabilityOf({ email: 'a@b.com', email_check: 'unverified', instagram_handle: 'x', ig_status: null })).toEqual({ email: false, instagram: true });
    expect(availabilityOf({ email: 'a@b.com', email_check: 'ok', instagram_handle: 'x', ig_status: 'private' })).toEqual({ email: true, instagram: false });
  });
});

describe('availabilityOf: scraped emails', () => {
  it('never counts a found email as a channel, even when it checks out', () => {
    expect(availabilityOf({ email: 'a@b.com', email_check: 'ok', email_source: 'found', instagram_handle: null, ig_status: null })).toEqual({ email: false, instagram: false });
  });

  it('counts a founder-confirmed (manual or sheet) email', () => {
    expect(availabilityOf({ email: 'a@b.com', email_check: 'ok', email_source: 'manual', instagram_handle: null, ig_status: null }).email).toBe(true);
    expect(availabilityOf({ email: 'a@b.com', email_check: 'ok', email_source: 'sheet', instagram_handle: null, ig_status: null }).email).toBe(true);
  });
});
