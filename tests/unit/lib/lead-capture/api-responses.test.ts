/**
 * Unit tests for the lead API error envelope helpers.
 *
 * @module tests/unit/lib/lead-capture/api-responses
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { leadApiError, withHeaders, zodIssuesToFields } from '@/lib/lead-capture/api-responses';

describe('leadApiError', () => {
  it('builds the contract envelope with status, extras and headers', async () => {
    const res = leadApiError(429, 'rate_limited', 'Slow down', { retry_after: 7 }, { 'Retry-After': '7' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('7');
    expect(await res.json()).toEqual({ error: 'rate_limited', message: 'Slow down', retry_after: 7 });
  });
});

describe('zodIssuesToFields', () => {
  it('keys the first message per top-level path and never includes values', () => {
    const schema = z.object({ email: z.email(), custom: z.array(z.object({ label: z.string().min(1) })) });
    const result = schema.safeParse({ email: 'nope', custom: [{ label: '' }] });
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = zodIssuesToFields(result.error.issues);
    expect(Object.keys(fields)).toEqual(['email', 'custom.0.label']);
    expect(JSON.stringify(fields)).not.toContain('nope');
  });
});

describe('withHeaders', () => {
  it('adds headers to an existing response', () => {
    const res = withHeaders(leadApiError(400, 'validation_failed', 'x'), { vary: 'origin' });
    expect(res.headers.get('vary')).toBe('origin');
    expect(res.status).toBe(400);
  });
});
