/**
 * Booking submit route schema validation tests.
 *
 * Unit-level validation of the booking form submission payload: required fields,
 * optional fields, honeypot handling, timezone validation, and datetime formats.
 */
import { describe, expect, it } from 'vitest';

import { bookingSubmitSchema } from '@/app/api/booking/submit-schema';

describe('bookingSubmitSchema', () => {
  const validBase = {
    token: '550e8400-e29b-41d4-a716-446655440000',
    startsAt: '2026-09-15T10:00:00Z',
    timezone: 'Australia/Sydney',
    name: 'Jamie Lee',
    email: 'jamie@example.test',
    website: '', // honeypot
    startedAt: Date.now(),
  };

  it('accepts a valid body with required fields only', () => {
    const result = bookingSubmitSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe(validBase.token);
      expect(result.data.startsAt).toBe(validBase.startsAt);
      expect(result.data.timezone).toBe('Australia/Sydney');
      expect(result.data.name).toBe('Jamie Lee');
      expect(result.data.email).toBe('jamie@example.test');
    }
  });

  it('accepts a valid body with all optional fields', () => {
    const full = {
      ...validBase,
      partnerName: 'Sam Rivers',
      phone: '+61 400 000 000',
      notes: 'Prefer video consultation',
    };
    const result = bookingSubmitSchema.safeParse(full);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.partnerName).toBe('Sam Rivers');
      expect(result.data.phone).toBe('+61 400 000 000');
      expect(result.data.notes).toBe('Prefer video consultation');
    }
  });

  it('tolerates honeypot field as empty string', () => {
    const result = bookingSubmitSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('rejects honeypot field when non-empty (bot signal)', () => {
    const result = bookingSubmitSchema.safeParse({
      ...validBase,
      website: 'https://spam.bot',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid timezone', () => {
    const badTz = {
      ...validBase,
      timezone: 'Invalid/Timezone',
    };
    const result = bookingSubmitSchema.safeParse(badTz);
    expect(result.success).toBe(false);
  });

  it('rejects startsAt not in ISO datetime format', () => {
    const badDate = {
      ...validBase,
      startsAt: '2026-09-15 10:00:00', // not ISO
    };
    const result = bookingSubmitSchema.safeParse(badDate);
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name, ...noName } = validBase;
    const result = bookingSubmitSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email, ...noEmail } = validBase;
    const result = bookingSubmitSchema.safeParse(noEmail);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const badEmail = {
      ...validBase,
      email: 'not-an-email',
    };
    const result = bookingSubmitSchema.safeParse(badEmail);
    expect(result.success).toBe(false);
  });

  it('rejects missing token', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token, ...noToken } = validBase;
    const result = bookingSubmitSchema.safeParse(noToken);
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID token', () => {
    const badToken = {
      ...validBase,
      token: 'not-a-uuid',
    };
    const result = bookingSubmitSchema.safeParse(badToken);
    expect(result.success).toBe(false);
  });

  it('rejects missing timezone', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timezone, ...noTz } = validBase;
    const result = bookingSubmitSchema.safeParse(noTz);
    expect(result.success).toBe(false);
  });

  it('rejects missing startsAt', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { startsAt, ...noStart } = validBase;
    const result = bookingSubmitSchema.safeParse(noStart);
    expect(result.success).toBe(false);
  });

  it('allows empty string for optional partnerName', () => {
    const result = bookingSubmitSchema.safeParse({
      ...validBase,
      partnerName: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.partnerName).toBeUndefined();
    }
  });

  it('allows empty string for optional phone', () => {
    const result = bookingSubmitSchema.safeParse({
      ...validBase,
      phone: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeUndefined();
    }
  });

  it('allows empty string for optional notes', () => {
    const result = bookingSubmitSchema.safeParse({
      ...validBase,
      notes: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBeUndefined();
    }
  });
});

describe('client contract: values the browser actually posts', () => {
  // Regression: the page sent `new Date(slot.start).toISOString()`, which
  // emits milliseconds, while the schema only accepted second precision.
  // Every unit test passed because the client tests mocked fetch and the
  // schema tests used hand-written strings; nothing ran one against the
  // other. Live booking failed with "Invalid request body".
  it('accepts a slot start with milliseconds (Date.toISOString output)', () => {
    const result = bookingSubmitSchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      startsAt: new Date('2026-09-15T10:00:00Z').toISOString(),
      timezone: 'Australia/Sydney',
      name: 'Sam Booker',
      email: 'sam@example.com',
      website: '',
      startedAt: Date.now() - 5000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts the second-precision form the slots endpoint emits', () => {
    const result = bookingSubmitSchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      startsAt: '2026-09-15T10:00:00Z',
      timezone: 'Australia/Sydney',
      name: 'Sam Booker',
      email: 'sam@example.com',
      website: '',
      startedAt: Date.now() - 5000,
    });
    expect(result.success).toBe(true);
  });
});
