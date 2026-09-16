/**
 * Unit tests for `runAfterSignEffects`: every finalize failure, thrown or
 * returned, must reach Slack with whatever ids are known, while a plain
 * non-proposal contract stays silent (security review S3 / W4).
 *
 * @module tests/unit/lib/contracts/after-sign.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/alerts/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const sendExecutedCopies = vi.fn(async () => undefined);
vi.mock('@/lib/contracts/notify', () => ({
  sendExecutedCopies: (...args: unknown[]) => sendExecutedCopies(...(args as [])),
}));

const finalizeProposalAcceptance = vi.fn();
vi.mock('@/lib/proposals/finalize', () => ({
  finalizeProposalAcceptance: (...args: unknown[]) => finalizeProposalAcceptance(...(args as [])),
}));

const sendAlert = vi.fn(async () => undefined);
vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: (...args: unknown[]) => sendAlert(...(args as [])),
}));

import { runAfterSignEffects } from '@/lib/contracts/after-sign';

const CONTRACT_ID = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  sendExecutedCopies.mockReset();
  sendExecutedCopies.mockResolvedValue(undefined);
  finalizeProposalAcceptance.mockReset();
  sendAlert.mockReset();
  sendAlert.mockResolvedValue(undefined);
});

describe('runAfterSignEffects', () => {
  it('alerts with the MC and proposal ids when finalize returns a non-throwing failure', async () => {
    finalizeProposalAcceptance.mockResolvedValue({ ok: false, error: 'rpc_failed', userId: 'u1', proposalId: 'p1' });

    const invoice = await runAfterSignEffects(CONTRACT_ID, 'tok');

    expect(invoice).toBeNull();
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'proposal_close_failed', stage: 'finalize', reason: 'rpc_failed', userId: 'u1', proposalId: 'p1' }),
    );
  });

  it('alerts with null ids when the failure happened before they were known', async () => {
    finalizeProposalAcceptance.mockResolvedValue({ ok: false, error: 'read_error' });

    await runAfterSignEffects(CONTRACT_ID, 'tok');

    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ reason: 'read_error', userId: null, proposalId: null }));
  });

  it('stays silent for an ordinary (non-proposal) contract', async () => {
    finalizeProposalAcceptance.mockResolvedValue({ ok: false, error: 'not_a_proposal' });

    const invoice = await runAfterSignEffects(CONTRACT_ID, 'tok');

    expect(invoice).toBeNull();
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('returns the invoice on success and still delivers executed copies first', async () => {
    const inv = { id: 'i1', share_token: 't', invoice_number: 'INV-001', stripe_payment_enabled: false, paid_at: null, first_stage: null };
    finalizeProposalAcceptance.mockResolvedValue({ ok: true, invoice: inv, already_finalized: false });

    const invoice = await runAfterSignEffects(CONTRACT_ID, 'tok');

    expect(invoice).toEqual(inv);
    expect(sendExecutedCopies).toHaveBeenCalledWith(CONTRACT_ID);
    expect(sendAlert).not.toHaveBeenCalled();
  });
});
