/**
 * Booking manage routes schema validation tests.
 *
 * Unit-level validation of the cancel and reschedule request payloads:
 * manageToken UUIDs, ISO datetime formats, and timezone validation.
 */
import { describe, expect, it } from 'vitest';

import { bookingCancelSchema } from '@/app/api/booking/cancel-schema';
import { bookingRescheduleSchema } from '@/app/api/booking/reschedule-schema';

describe('bookingCancelSchema', () => {
  const validBase = {
    manageToken: '550e8400-e29b-41d4-a716-446655440000',
  };

  it('accepts a valid cancel body', () => {
    const result = bookingCancelSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manageToken).toBe(validBase.manageToken);
    }
  });

  it('rejects missing manageToken', () => {
    const result = bookingCancelSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID manageToken', () => {
    const result = bookingCancelSchema.safeParse({
      manageToken: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed UUID manageToken', () => {
    const result = bookingCancelSchema.safeParse({
      manageToken: '550e8400-e29b-41d4-a716',
    });
    expect(result.success).toBe(false);
  });
});

describe('bookingRescheduleSchema', () => {
  const validBase = {
    manageToken: '550e8400-e29b-41d4-a716-446655440000',
    startsAt: '2026-09-15T10:00:00Z',
    timezone: 'Australia/Sydney',
  };

  it('accepts a valid reschedule body', () => {
    const result = bookingRescheduleSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manageToken).toBe(validBase.manageToken);
      expect(result.data.startsAt).toBe(validBase.startsAt);
      expect(result.data.timezone).toBe('Australia/Sydney');
    }
  });

  it('rejects missing manageToken', () => {
    const result = bookingRescheduleSchema.safeParse({
      startsAt: validBase.startsAt,
      timezone: validBase.timezone,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID manageToken', () => {
    const result = bookingRescheduleSchema.safeParse({
      ...validBase,
      manageToken: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing startsAt', () => {
    const result = bookingRescheduleSchema.safeParse({
      manageToken: validBase.manageToken,
      timezone: validBase.timezone,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-ISO startsAt', () => {
    const result = bookingRescheduleSchema.safeParse({
      ...validBase,
      startsAt: '2026-09-15 10:00:00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing timezone', () => {
    const result = bookingRescheduleSchema.safeParse({
      manageToken: validBase.manageToken,
      startsAt: validBase.startsAt,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid timezone', () => {
    const result = bookingRescheduleSchema.safeParse({
      ...validBase,
      timezone: 'Invalid/Timezone',
    });
    expect(result.success).toBe(false);
  });

  it('accepts timezone from Intl.supportedValuesOf', () => {
    const result = bookingRescheduleSchema.safeParse({
      ...validBase,
      timezone: 'America/New_York',
    });
    expect(result.success).toBe(true);
  });

  it('accepts startsAt with Z suffix', () => {
    const result = bookingRescheduleSchema.safeParse({
      ...validBase,
      startsAt: '2026-09-15T10:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts startsAt without Z suffix', () => {
    const result = bookingRescheduleSchema.safeParse({
      ...validBase,
      startsAt: '2026-09-15T10:00:00',
    });
    expect(result.success).toBe(true);
  });
});
