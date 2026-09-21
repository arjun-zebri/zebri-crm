/**
 * Unit tests for `POST /api/proposal/events`.
 *
 * The public proposal page's engagement tracker flushes here every 10s and
 * again on `pagehide` (via `sendBeacon`, so the body may arrive as
 * `text/plain`). The route's job is to validate the batch, forward it to
 * `record_proposal_events`, and fire the first-open notification (via
 * `after()`, M5) without blocking the response on it.
 *
 * @module tests/unit/app/api/proposal-events-route.test
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const notify = vi.fn();
const recordMiss = vi.fn();
// Stands in for a request scope: `after` runs the work, same convention as
// `tests/unit/lib/workflows/kick.test.ts`. `importOriginal` keeps the real
// `NextRequest`/`NextResponse` the route (and this file) also need.
const afterMock = vi.fn<(work: () => unknown) => void>((work) => {
  void work();
});
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (work: () => unknown) => afterMock(work) };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ rpc })) }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'p1' }, error: null }) }) }) }),
  }),
}));
vi.mock('@/lib/proposals/notify-opened', () => ({ notifyProposalOpened: (...args: unknown[]) => notify(...args) }));
vi.mock('@/lib/api/public-token-limiter', () => ({ recordInvalidTokenAttempt: (...args: unknown[]) => recordMiss(...args) }));

import { POST } from '@/app/api/proposal/events/route';

const token = '11111111-1111-4111-8111-111111111111';
const body = {
  token,
  sessionId: 'sess-abcdef',
  events: [
    { id: 'ev-1', type: 'opened', payload: {} },
    { id: 'ev-2', type: 'section_viewed', payload: { blockId: 'b', blockType: 'hero', seconds: 3 } },
  ],
};

/** A fresh request each call: a random-per-request IP so the per-IP rate
 * limiter (30/min) never trips between the tests below. */
const req = (b: unknown, contentType = 'application/json') =>
  new NextRequest('http://localhost/api/proposal/events', {
    method: 'POST',
    body: typeof b === 'string' ? b : JSON.stringify(b),
    headers: { 'content-type': contentType, 'x-forwarded-for': `10.1.0.${Math.floor(Math.random() * 250)}` },
  });

beforeEach(() => {
  rpc.mockReset();
  notify.mockReset();
  recordMiss.mockReset();
  recordMiss.mockResolvedValue({ allowed: true, retryAfter: 0 });
  afterMock.mockClear();
});

describe('POST /api/proposal/events', () => {
  it('forwards the batch to the RPC and returns the inserted count', async () => {
    rpc.mockResolvedValue({ data: { ok: true, inserted: 2, first_open: false }, error: null });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, inserted: 2 });
    expect(rpc).toHaveBeenCalledWith('record_proposal_events', { p_token: token, p_session_id: 'sess-abcdef', p_events: body.events });
    expect(notify).not.toHaveBeenCalled();
  });

  it('notifies the MC on the first open, through `after()` (M5)', async () => {
    rpc.mockResolvedValue({ data: { ok: true, inserted: 1, first_open: true }, error: null });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(afterMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(expect.anything(), 'p1'));
  });

  it('M5: still notifies when there is no request scope to attach `after()` to', async () => {
    // A script or a test calling the route straight from Node has no
    // request scope, and `after` throws (see `scheduleKick`'s own
    // fallback in `lib/workflows/kick.ts`, the pattern this route copies).
    afterMock.mockImplementationOnce(() => {
      throw new Error('`after` was called outside a request scope.');
    });
    rpc.mockResolvedValue({ data: { ok: true, inserted: 1, first_open: true }, error: null });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(expect.anything(), 'p1'));
  });

  it('accepts a text/plain body (sendBeacon)', async () => {
    rpc.mockResolvedValue({ data: { ok: true, inserted: 2, first_open: false }, error: null });
    const res = await POST(req(JSON.stringify(body), 'text/plain'));
    expect(res.status).toBe(200);
  });

  it('rejects a malformed body without calling the RPC', async () => {
    const res = await POST(req({ token, sessionId: 'x', events: [] }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('passes RPC errors through as 400 and records a token miss on not_found', async () => {
    rpc.mockResolvedValue({ data: { error: 'not_found' }, error: null });
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(recordMiss).toHaveBeenCalled();
  });

  it('m3: acts on the limiter once the scanning cap trips, returning the generic shape rather than not_found', async () => {
    rpc.mockResolvedValue({ data: { error: 'not_found' }, error: null });
    recordMiss.mockResolvedValue({ allowed: false, retryAfter: 60_000 });
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    // Generic, not the distinguishable `not_found`: a scanner that has
    // tripped the cap should not be able to tell that apart from an
    // ordinary validation failure.
    expect(await res.json()).toEqual({ error: 'Invalid events' });
  });

  it('m7: the per-IP rate limiter actually returns 429 past 30/min, the branch a lost `opened` depends on', async () => {
    // The other tests in this file randomise x-forwarded-for specifically
    // so this limiter never trips, leaving its 429 branch unexecuted. A
    // fixed IP here is what actually exercises it: this is the branch C2
    // turns into real data loss for a couple on a shared or rate-limited
    // connection, so it needs its own direct coverage.
    rpc.mockResolvedValue({ data: { ok: true, inserted: 2, first_open: false }, error: null });
    const fromFixedIp = () =>
      new NextRequest('http://localhost/api/proposal/events', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
      });
    let last = await POST(fromFixedIp());
    for (let i = 0; i < 30; i++) {
      last = await POST(fromFixedIp());
    }
    expect(last.status).toBe(429);
    expect(last.headers.get('Retry-After')).toBeTruthy();
  });
});
