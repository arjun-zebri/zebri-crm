/**
 * Unit tests for `POST /api/proposal/accept`.
 *
 * The route's job is to turn `accept_proposal`'s draft contract into a
 * rendered, countersigned body the couple can sign next: the admin lookups
 * that build the accepted option's total/deposit and the read-back of the
 * contract's own number/title matter more here than the RPC call itself.
 *
 * @module tests/unit/app/api/proposal-accept-route.test
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const publish = vi.fn();
const getUserById = vi.fn();
const proposalsRow = vi.fn();
const contractsRow = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ rpc })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById } },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => (table === 'proposals' ? proposalsRow() : contractsRow()),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/contracts/publish', () => ({
  publishContractSnapshot: (...args: unknown[]) => publish(...(args as [])),
}));

const sendAlert = vi.fn(async () => undefined);
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: (...args: unknown[]) => sendAlert(...(args as [])),
}));

const recordInvalidTokenAttempt = vi.fn(async () => ({ allowed: true, retryAfter: 0 }));
vi.mock('@/lib/api/public-token-limiter', () => ({
  recordInvalidTokenAttempt: (...args: unknown[]) => recordInvalidTokenAttempt(...(args as [])),
}));

const loggerError = vi.fn();
vi.mock('@/lib/alerts/logger', () => ({
  logger: { error: (...args: unknown[]) => loggerError(...args), warn: vi.fn(), info: vi.fn() },
}));

import { POST } from '@/app/api/proposal/accept/route';

const TOKEN = '11111111-1111-4111-8111-111111111111';
const OPTION_ID = '22222222-2222-4222-8222-222222222222';
const CONTRACT_ID = '33333333-3333-4333-8333-333333333333';

const body = { token: TOKEN, optionId: OPTION_ID, addonIds: [] };

/** A fresh request each call: a random-per-request IP so the per-IP rate
 * limiter (5/min) never trips between the tests below. */
function req(b: unknown) {
  return new NextRequest('http://localhost/api/proposal/accept', {
    method: 'POST',
    body: JSON.stringify(b),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.0.${String(Math.floor(Math.random() * 250))}`,
    },
  });
}

beforeEach(() => {
  rpc.mockReset();
  publish.mockReset();
  getUserById.mockReset();
  proposalsRow.mockReset();
  contractsRow.mockReset();
  sendAlert.mockReset();
  sendAlert.mockResolvedValue(undefined);
  recordInvalidTokenAttempt.mockClear();
  loggerError.mockClear();
  proposalsRow.mockResolvedValue({
    data: {
      title: 'Wedding MC',
      deposit_percent: 25,
      payment_schedule_id: null,
      proposal_options: [
        {
          id: OPTION_ID,
          title: 'Reception MC',
          pricing_mode: 'itemised',
          fixed_price: null,
          weekend_loading_percent: null,
          proposal_option_items: [{ id: 'i1', amount: 1400, quantity: 1, is_addon: false }],
        },
      ],
    },
  });
  contractsRow.mockResolvedValue({ data: { contract_number: 'CTR-001', title: 'Wedding MC' } });
});

describe('POST /api/proposal/accept', () => {
  it('returns the signer token and the rendered contract', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, contract_id: CONTRACT_ID, sign_token: 'tok', user_id: 'u1', already_pending: false },
      error: null,
    });
    getUserById.mockResolvedValue({ data: { user: { id: 'u1', email: 'mc@example.com', user_metadata: { business_name: 'Bright MC' } } } });
    publish.mockResolvedValue({ ok: true, lockedHtml: '<p>Agreement</p>', mcSignatureName: 'Sam', coupleEmail: 'a@example.com' });

    const res = await POST(req(body));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      sign_token: 'tok',
      contract: { contract_number: 'CTR-001', title: 'Wedding MC', locked_content_html: '<p>Agreement</p>' },
      total: 1400,
      deposit: 350,
    });
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      CONTRACT_ID,
      expect.objectContaining({ id: 'u1' }),
      expect.objectContaining({ proposalVars: { packageName: 'Reception MC', total: 1400, deposit: 350 } }),
    );
  });

  it('passes the RPC error through as 400', async () => {
    rpc.mockResolvedValue({ data: { error: 'expired' }, error: null });

    const res = await POST(req(body));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'expired' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects a malformed body', async () => {
    const res = await POST(req({ token: 'nope' }));

    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('alerts with stage: publish, naming the MC and proposal, when publishContractSnapshot fails', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, contract_id: CONTRACT_ID, sign_token: 'tok', user_id: 'u1', proposal_id: 'p1', already_pending: false },
      error: null,
    });
    getUserById.mockResolvedValue({ data: { user: { id: 'u1', email: 'mc@example.com', user_metadata: {} } } });
    publish.mockResolvedValue({ ok: false, reason: 'not_found' });

    const res = await POST(req(body));

    expect(res.status).toBe(500);
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'proposal_close_failed', stage: 'publish', userId: 'u1', proposalId: 'p1', reason: 'not_found' }),
    );
  });

  it('counts an unknown token against the public-token limiter and never logs the token', async () => {
    rpc.mockResolvedValue({ data: { error: 'not_found' }, error: null });

    const res = await POST(req(body));

    expect(res.status).toBe(400);
    expect(recordInvalidTokenAttempt).toHaveBeenCalledWith(expect.objectContaining({ surface: 'proposal' }));

    rpc.mockResolvedValue({ data: null, error: { message: 'db down' } });
    await POST(req(body));
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(TOKEN);
  });

  it('ignores deposit_percent when the proposal names a payment schedule (ruling W1)', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, contract_id: CONTRACT_ID, sign_token: 'tok', user_id: 'u1', proposal_id: 'p1', already_pending: false },
      error: null,
    });
    getUserById.mockResolvedValue({ data: { user: { id: 'u1', email: 'mc@example.com', user_metadata: {} } } });
    publish.mockResolvedValue({ ok: true, lockedHtml: '<p>Agreement</p>', mcSignatureName: 'Sam', coupleEmail: null });
    const base = (await proposalsRow()) as { data: Record<string, unknown> };
    proposalsRow.mockResolvedValue({ data: { ...base.data, payment_schedule_id: 'sched-1' } });

    const res = await POST(req(body));

    expect(res.status).toBe(200);
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      CONTRACT_ID,
      expect.anything(),
      expect.objectContaining({ proposalVars: { packageName: 'Reception MC', total: 1400, deposit: 0 } }),
    );
  });
});
