/**
 * Unit tests for the three contract server actions in
 * `app/(dashboard)/payments/actions.ts`.
 *
 * Covers Zod rejection branches + happy path + auth gate. The
 * RLS-scoped DB writes themselves are exercised end-to-end in the
 * integration suite (Phase 3.2 — `tests/integration/contracts/`);
 * here we mock the Supabase chain and pin the contract that each
 * action accepts the right shape and surfaces the right error
 * tagged-result.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const rpcMock = vi.fn();
const eqMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
    rpc: rpcMock,
  })),
}));
vi.mock('@/lib/alerts/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
  updateMock.mockReset().mockReturnValue({ eq: eqMock });
  deleteMock.mockReset().mockReturnValue({ eq: eqMock });
  rpcMock.mockReset();
  eqMock.mockReset().mockResolvedValue({ error: null });
  fromMock.mockReset().mockReturnValue({
    update: updateMock,
    delete: deleteMock,
  });
});

async function loadActions() {
  return await import('@/app/(dashboard)/payments/actions');
}

// Real v4 UUID — `z.uuid()` enforces RFC 4122 version + variant
// bits, so the lazy `1111…` shape is rejected.
const validId = 'c1c1c1c1-c1c1-4c1c-9c1c-c1c1c1c1c1c1';
const validContent = { type: 'doc', content: [{ type: 'paragraph' }] };

describe('saveContractAction', () => {
  it('returns ok=false on a non-UUID contractId', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: {} } },
    });
    const { saveContractAction } = await loadActions();
    const result = await saveContractAction({
      contractId: 'not-a-uuid',
      title: 't',
      content: validContent,
      expiresAt: null,
    });
    expect(result).toEqual({ ok: false, error: 'Invalid contract data.' });
  });

  it('returns 401-style failure when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { saveContractAction } = await loadActions();
    const result = await saveContractAction({
      contractId: validId,
      title: 't',
      content: validContent,
      expiresAt: null,
    });
    expect(result).toEqual({ ok: false, error: 'Not signed in.' });
  });

  it('saves a valid contract and returns the id', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: {} } },
    });
    const { saveContractAction } = await loadActions();
    const result = await saveContractAction({
      contractId: validId,
      title: 'Wedding contract',
      content: validContent,
      expiresAt: '2026-12-31',
    });
    expect(result).toEqual({ ok: true, data: { id: validId } });
    expect(fromMock).toHaveBeenCalledWith('contracts');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Wedding contract',
        expires_at: '2026-12-31',
      }),
    );
  });

});

describe('revokeContractAction', () => {
  it('returns ok=false on a non-UUID contractId', async () => {
    const { revokeContractAction } = await loadActions();
    const result = await revokeContractAction('not-a-uuid');
    expect(result).toEqual({ ok: false, error: 'Invalid contract ID.' });
  });

  it('calls revoke_contract RPC on the happy path', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: {} } },
    });
    rpcMock.mockResolvedValue({ error: null });
    const { revokeContractAction } = await loadActions();
    const result = await revokeContractAction(validId);
    expect(result).toEqual({ ok: true, data: undefined });
    expect(rpcMock).toHaveBeenCalledWith('revoke_contract', {
      p_contract_id: validId,
    });
  });

  it('surfaces an error when the RPC fails', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: {} } },
    });
    rpcMock.mockResolvedValue({
      error: { message: 'permission denied' },
    });
    const { revokeContractAction } = await loadActions();
    const result = await revokeContractAction(validId);
    expect(result.ok).toBe(false);
  });
});

describe('deleteContractAction', () => {
  it('returns ok=false on a non-UUID contractId', async () => {
    const { deleteContractAction } = await loadActions();
    const result = await deleteContractAction('not-a-uuid');
    expect(result).toEqual({ ok: false, error: 'Invalid contract ID.' });
  });

  it('deletes the contract on the happy path', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: {} } },
    });
    const { deleteContractAction } = await loadActions();
    const result = await deleteContractAction(validId);
    expect(result).toEqual({ ok: true, data: undefined });
    expect(fromMock).toHaveBeenCalledWith('contracts');
    expect(deleteMock).toHaveBeenCalled();
  });
});
