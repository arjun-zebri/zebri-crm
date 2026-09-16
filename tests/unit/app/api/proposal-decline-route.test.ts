/**
 * Unit tests for `POST /api/proposal/decline`.
 *
 * The route's job is to run `decline_proposal` and, on success, kick off the
 * MC notification. What matters here is that the notify call gets the right
 * proposal id (read back via the share token, since the RPC itself doesn't
 * return one) and that a bad request or RPC error never reaches it.
 *
 * @module tests/unit/app/api/proposal-decline-route.test
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const notifyProposalDeclined = vi.fn(async () => undefined);
const proposalIdRow = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ rpc })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => proposalIdRow(),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/proposals/notify', () => ({
  notifyProposalDeclined: (...args: unknown[]) => notifyProposalDeclined(...(args as [])),
}));

const recordInvalidTokenAttempt = vi.fn(async () => ({ allowed: true, retryAfter: 0 }));
vi.mock('@/lib/api/public-token-limiter', () => ({
  recordInvalidTokenAttempt: (...args: unknown[]) => recordInvalidTokenAttempt(...(args as [])),
}));

const loggerError = vi.fn();
vi.mock('@/lib/alerts/logger', () => ({
  logger: { error: (...args: unknown[]) => loggerError(...args), warn: vi.fn(), info: vi.fn() },
}));

import { POST } from '@/app/api/proposal/decline/route';

const TOKEN = '11111111-1111-4111-8111-111111111111';
const PROPOSAL_ID = '44444444-4444-4444-8444-444444444444';

const body = { token: TOKEN, reason: 'price' };

/** A fresh request each call: a random-per-request IP so the per-IP rate
 * limiter (5/min) never trips between the tests below. */
function req(b: unknown) {
  return new NextRequest('http://localhost/api/proposal/decline', {
    method: 'POST',
    body: JSON.stringify(b),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.1.${String(Math.floor(Math.random() * 250))}`,
    },
  });
}

beforeEach(() => {
  rpc.mockReset();
  notifyProposalDeclined.mockReset();
  notifyProposalDeclined.mockResolvedValue(undefined);
  proposalIdRow.mockReset();
  proposalIdRow.mockResolvedValue({ data: { id: PROPOSAL_ID } });
  recordInvalidTokenAttempt.mockClear();
  loggerError.mockClear();
});

describe('POST /api/proposal/decline', () => {
  it('records the decline and notifies the MC', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    const res = await POST(req(body));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(notifyProposalDeclined).toHaveBeenCalledWith(expect.anything(), PROPOSAL_ID);
  });

  it('passes the RPC error through as 400', async () => {
    rpc.mockResolvedValue({ data: { error: 'already_accepted' }, error: null });

    const res = await POST(req(body));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'already_accepted' });
    expect(notifyProposalDeclined).not.toHaveBeenCalled();
  });

  it('counts an unknown token against the public-token limiter and never logs the token', async () => {
    rpc.mockResolvedValue({ data: { error: 'not_found' }, error: null });

    const res = await POST(req(body));

    expect(res.status).toBe(400);
    expect(recordInvalidTokenAttempt).toHaveBeenCalledWith(expect.objectContaining({ surface: 'proposal' }));
    expect(notifyProposalDeclined).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: null, error: { message: 'db down' } });
    await POST(req(body));
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(TOKEN);
  });

  it('rejects an unknown decline reason', async () => {
    const res = await POST(req({ token: TOKEN, reason: 'weather' }));

    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
