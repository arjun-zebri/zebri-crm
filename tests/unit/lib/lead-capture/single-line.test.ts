/**
 * Task 31 (audit M5): the public lead form and the public booking page
 * are where an outsider types a couple's name and address, which later
 * land in email headers. A line break there is rejected at the schema.
 */
import { describe, expect, it } from 'vitest';

import { bookingSubmitSchema } from '@/app/api/booking/submit-schema';
import { leadSubmitSchema } from '@/lib/lead-capture/schema';

const lead = { token: '6f1c2f1e-3f8a-4c3e-9b52-7c8a1f0d2e11', name: 'Sarah', rendered_at: 1 };

describe('leadSubmitSchema', () => {
  it('accepts a normal submission', () => {
    expect(leadSubmitSchema.safeParse({ ...lead, partner_name: 'Jake', email: 's@example.com' }).success).toBe(
      true,
    );
  });

  it.each([
    ['name', 'Sarah\nBcc: spy@evil.test'],
    ['partner_name', 'Jake\r\nX: 1'],
    ['email', 's@example.com\nBcc: spy@evil.test'],
  ])('rejects a line break in %s', (field, value) => {
    const parsed = leadSubmitSchema.safeParse({ ...lead, [field]: value });
    expect(parsed.success).toBe(false);
  });
});

describe('bookingSubmitSchema', () => {
  const booking = {
    token: '6f1c2f1e-3f8a-4c3e-9b52-7c8a1f0d2e11',
    startsAt: '2026-10-01T10:00:00.000Z',
    timezone: 'Australia/Sydney',
    name: 'Sarah',
    email: 's@example.com',
    website: '',
    startedAt: 1,
  };

  it('accepts a normal booking', () => {
    expect(bookingSubmitSchema.safeParse(booking).success).toBe(true);
  });

  it.each([
    ['name', 'Sarah\nBcc: spy@evil.test'],
    ['partnerName', 'Jake\rX: 1'],
  ])('rejects a line break in %s', (field, value) => {
    expect(bookingSubmitSchema.safeParse({ ...booking, [field]: value }).success).toBe(false);
  });
});
