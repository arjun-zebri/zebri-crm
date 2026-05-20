import { z } from 'zod';

import { parseJsonBody, parseSearchParams } from '@/lib/api/validate';

const Body = z.object({
  coupleId: z.uuid(),
  amount: z.number().int().positive(),
});

describe('parseJsonBody', () => {
  function jsonReq(payload: unknown): Request {
    return new Request('https://example.com/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  it('returns the parsed payload on a valid body', async () => {
    // crypto.randomUUID() generates a proper v4 UUID; Zod 4's `z.uuid()`
    // enforces the version bits (the all-zeros UUID does NOT validate).
    const coupleId = crypto.randomUUID();
    const result = await parseJsonBody(jsonReq({ coupleId, amount: 5 }), Body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.amount).toBe(5);
      expect(result.data.coupleId).toBe(coupleId);
    }
  });

  it('returns a 400 response when the schema rejects', async () => {
    const result = await parseJsonBody(jsonReq({ coupleId: 'not-a-uuid', amount: -1 }), Body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error).toMatch(/request body/i);
      expect(Array.isArray(body.issues)).toBe(true);
    }
  });

  it('returns a 400 when the body is not JSON', async () => {
    const req = new Request('https://example.com/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '<<not json>>',
    });
    const result = await parseJsonBody(req, Body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });
});

describe('parseSearchParams', () => {
  it('parses present params and rejects invalid ones', () => {
    const Schema = z.object({ token: z.string().min(1) });
    const ok = parseSearchParams(new Request('https://example.com/api/x?token=abc'), Schema);
    expect(ok.ok).toBe(true);

    const bad = parseSearchParams(new Request('https://example.com/api/x'), Schema);
    expect(bad.ok).toBe(false);
  });
});
