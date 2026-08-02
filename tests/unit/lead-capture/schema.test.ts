import { describe, expect, it } from 'vitest';

import { isLikelyBot, leadSubmitSchema } from '@/lib/lead-capture/schema';

const base = {
  token: '11111111-1111-4111-8111-111111111111',
  name: 'Jamie',
  email: 'jamie@example.test',
  rendered_at: 1_000_000,
};

describe('leadSubmitSchema', () => {
  it('accepts a minimal valid submission', () => {
    expect(leadSubmitSchema.safeParse(base).success).toBe(true);
  });
  it('rejects a bad token', () => {
    expect(leadSubmitSchema.safeParse({ ...base, token: 'nope' }).success).toBe(false);
  });
  it('rejects a bad email', () => {
    expect(leadSubmitSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });
  it('rejects a blank name', () => {
    expect(leadSubmitSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
  });
  it('accepts an ISO wedding_date and rejects a garbage one', () => {
    expect(leadSubmitSchema.safeParse({ ...base, wedding_date: '2027-05-01' }).success).toBe(true);
    expect(leadSubmitSchema.safeParse({ ...base, wedding_date: 'someday' }).success).toBe(false);
  });
});

describe('isLikelyBot', () => {
  it('flags a filled honeypot', () => {
    expect(isLikelyBot({ hp: 'x', rendered_at: 0 }, 10_000)).toBe(true);
  });
  it('flags a too-fast submission (< 2s)', () => {
    expect(isLikelyBot({ rendered_at: 9_000 }, 10_000)).toBe(true);
  });
  it('passes a normal submission', () => {
    expect(isLikelyBot({ rendered_at: 0 }, 10_000)).toBe(false);
  });
});
