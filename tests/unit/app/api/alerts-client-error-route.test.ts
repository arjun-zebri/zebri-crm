/**
 * Unit tests for `POST /api/alerts/client-error`.
 *
 * The route must build the alert itself (never relay a payload), take the
 * account from the session rather than the body, redact the page, and
 * rate-limit by IP because it is public.
 *
 * @module tests/unit/app/api/alerts-client-error-route.test
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const sendAlert = vi.fn(async () => true);
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: (...args: unknown[]) => sendAlert(...(args as [])),
}));

import { POST } from '@/app/api/alerts/client-error/route';

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';

function req(body: unknown, ip = `10.0.0.${Math.floor(Math.random() * 250)}`) {
  return new NextRequest('http://localhost/api/alerts/client-error', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, 'user-agent': CHROME_WIN },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sendAlert.mockClear();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'mc@business.example' } } });
});

describe('POST /api/alerts/client-error', () => {
  it('posts a mutation failure with the session account, browser and redacted page', async () => {
    const res = await POST(
      req({
        kind: 'mutation',
        message: 'Could not delete couple.',
        page: '/couples?view=board',
        // A spoofed account in the body is not part of the schema and is ignored.
        account: 'attacker@example.com',
      }),
    );

    expect(res.status).toBe(204);
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'client_error',
        severity: 'warn',
        kind: 'mutation',
        message: 'Could not delete couple.',
        page: '/couples?view=board',
        account: 'mc@business.example',
        userId: 'user-1',
        browser: 'Chrome 154 · Windows',
      }),
    );
  });

  it('reports a public-page crash with no session and a redacted token', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await POST(req({ kind: 'render', message: 'x is undefined', page: '/invoice/0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d' }));

    const event = (sendAlert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(event).toMatchObject({ severity: 'error', page: '/invoice/0b1c2d…' });
    expect(event).not.toHaveProperty('account');
  });

  it('rejects a raw Slack payload, so the route is no longer a relay', async () => {
    const res = await POST(req({ text: 'free advertising', blocks: [] }));
    expect(res.status).toBe(400);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('rate-limits one IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i += 1) {
      const res = await POST(req({ kind: 'mutation', message: 'x', page: '/' }, '10.9.9.9'));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 204)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});
