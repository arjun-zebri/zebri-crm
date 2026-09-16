/**
 * Unit tests for the proposal-close finalize hook inside
 * `POST /api/contract/sign` (Phase C review fix round 1, item 1).
 *
 * The route's job asserted here is narrow but important: an already-recorded
 * signature must never turn into a 500 because `finalizeProposalAcceptance`
 * throws (network blip, unexpected data shape).
 *
 * @module tests/unit/app/api/contract-sign-route.test
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/rate-limit')>();
  return {
    ...actual,
    inMemoryLimiter: () => ({ check: async () => ({ allowed: true, retryAfter: 0 }) }),
    ipOf: () => '203.0.113.5',
  };
});

vi.mock('@/lib/alerts/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ rpc })) }));

const sendNextSignerInvite = vi.fn(async () => undefined);
const sendExecutedCopies = vi.fn(async () => undefined);
vi.mock('@/lib/contracts/notify', () => ({
  sendExecutedCopies: (...args: unknown[]) => sendExecutedCopies(...(args as [])),
  sendNextSignerInvite: (...args: unknown[]) => sendNextSignerInvite(...(args as [])),
}));

const finalizeProposalAcceptance = vi.fn();
vi.mock('@/lib/proposals/finalize', () => ({
  finalizeProposalAcceptance: (...args: unknown[]) => finalizeProposalAcceptance(...(args as [])),
}));

const sendAlert = vi.fn(async () => undefined);
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: (...args: unknown[]) => sendAlert(...(args as [])),
}));

import { POST } from '@/app/api/contract/sign/route';

const TOKEN = '11111111-1111-4111-8111-111111111111';
const CONTRACT_ID = '33333333-3333-4333-8333-333333333333';

function req() {
  return new NextRequest('http://localhost/api/contract/sign', {
    method: 'POST',
    body: JSON.stringify({ token: TOKEN, signer_name: 'Anna Smith' }),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  rpc.mockReset();
  sendExecutedCopies.mockReset();
  sendExecutedCopies.mockResolvedValue(undefined);
  sendNextSignerInvite.mockReset();
  sendNextSignerInvite.mockResolvedValue(undefined);
  finalizeProposalAcceptance.mockReset();
  sendAlert.mockReset();
  sendAlert.mockResolvedValue(undefined);
});

describe('POST /api/contract/sign proposal finalize hook', () => {
  it('still returns the signed response with proposal_invoice: null when finalize throws', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, complete: true, contract_id: CONTRACT_ID, invoice_id: null, outstanding: 0 },
      error: null,
    });
    finalizeProposalAcceptance.mockRejectedValue(new Error('boom'));

    const res = await POST(req());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, complete: true, proposal_invoice: null });
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'proposal_close_failed', stage: 'finalize', reason: 'boom' }),
    );
  });

  it('carries the finalized invoice through when finalize succeeds', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, complete: true, contract_id: CONTRACT_ID, invoice_id: null, outstanding: 0 },
      error: null,
    });
    finalizeProposalAcceptance.mockResolvedValue({
      ok: true,
      already_finalized: false,
      invoice: { id: 'inv1', share_token: 'st1', invoice_number: '', stripe_payment_enabled: false, paid_at: null, first_stage: null },
    });

    const res = await POST(req());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.proposal_invoice).toMatchObject({ id: 'inv1' });
    expect(sendAlert).not.toHaveBeenCalled();
  });
});
