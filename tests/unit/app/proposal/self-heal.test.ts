/**
 * The server page's self-heal for a signed-but-unfinalized proposal
 * contract (ruling W3b).
 *
 * @module tests/unit/app/proposal/self-heal.test
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/alerts/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/proposals/finalize', () => ({ finalizeProposalAcceptance: vi.fn() }));

import { needsSelfHeal, selfHealProposal } from '@/app/proposal/[token]/_lib/self-heal';
import type { PublicProposal } from '@/lib/proposals/public-types';

const base = {
  id: 'p1', accepted_at: null,
  pending_contract: { sign_token: 'tok', contract_number: 'C-1', title: null, locked_content_html: '<p>x</p>', signed_at: '2026-09-14T00:00:00Z' },
} as unknown as PublicProposal;

describe('selfHealProposal', () => {
  it('finalizes through the signer token and returns the reloaded payload', async () => {
    const finalize = vi.fn(async () => ({ ok: true as const, invoice: null as never, already_finalized: false }));
    const healed = { ...base, accepted_at: '2026-09-14T00:00:01Z' };
    const reload = vi.fn(async () => healed);

    const result = await selfHealProposal(base, reload, finalize);

    expect(finalize).toHaveBeenCalledWith('tok');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result).toBe(healed);
  });

  it('does nothing for an unsigned pending contract or an already accepted proposal', async () => {
    const finalize = vi.fn();
    const reload = vi.fn();
    const unsigned = { ...base, pending_contract: { ...base.pending_contract!, signed_at: null } };
    const accepted = { ...base, accepted_at: 'x' };
    expect(needsSelfHeal(unsigned)).toBe(false);
    expect(needsSelfHeal(accepted)).toBe(false);
    expect(await selfHealProposal(unsigned, reload, finalize)).toBe(unsigned);
    expect(await selfHealProposal(accepted, reload, finalize)).toBe(accepted);
    expect(finalize).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('keeps the original payload when finalize refuses or throws', async () => {
    const reload = vi.fn();
    expect(await selfHealProposal(base, reload, vi.fn(async () => ({ ok: false as const, error: 'rpc_failed' })))).toBe(base);
    expect(await selfHealProposal(base, reload, vi.fn(async () => { throw new Error('boom'); }))).toBe(base);
    expect(reload).not.toHaveBeenCalled();
  });
});
