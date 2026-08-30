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
const insertMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
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
  singleMock.mockReset().mockResolvedValue({ data: { id: newId }, error: null });
  // `.select()` serves two shapes: `.select('id').single()` after an
  // insert, and a bare awaited `.select('couple_id')` for the plan-cap
  // count. Make the returned object both thenable and chainable.
  selectMock.mockReset().mockImplementation(() => ({
    single: singleMock,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: contractCoupleRows, error: null }),
  }));
  insertMock.mockReset().mockReturnValue({ select: selectMock });
  rpcMock.mockReset().mockResolvedValue({ data: 'CTR-0001', error: null });
  eqMock.mockReset().mockResolvedValue({ error: null });
  fromMock.mockReset().mockReturnValue({
    update: updateMock,
    delete: deleteMock,
    insert: insertMock,
    select: selectMock,
  });
  contractCoupleRows = [];
});

async function loadActions() {
  return await import('@/app/(dashboard)/payments/actions');
}

// Real v4 UUIDs — `z.uuid()` enforces RFC 4122 version + variant
// bits, so the lazy `1111…` shape is rejected.
const validId = 'c1c1c1c1-c1c1-4c1c-9c1c-c1c1c1c1c1c1';
const newId = 'd2d2d2d2-d2d2-4d2d-9d2d-d2d2d2d2d2d2';
const coupleId = 'e3e3e3e3-e3e3-4e3e-9e3e-e3e3e3e3e3e3';
const otherCoupleId = 'f4f4f4f4-f4f4-4f4f-9f4f-f4f4f4f4f4f4';
const validContent = { type: 'doc', content: [{ type: 'paragraph' }] };

/** Rows the plan-cap count reads back. Reset per test. */
let contractCoupleRows: { couple_id: string }[] = [];

/** A paid user: `contractCoupleLimit` returns null, so no cap check.
 *  Needs BOTH an active status and the plan — `currentPlan` falls back
 *  to starter when the subscription isn't currently honouring access. */
const proUser = {
  id: 'u1',
  app_metadata: {
    account_type: 'user',
    subscription_status: 'active',
    subscription_plan: 'pro',
  },
};
/** No plan → Starter, i.e. the 5-couple cap applies. */
const starterUser = { id: 'u1', app_metadata: { account_type: 'user' } };

describe('saveContractAction', () => {
  it('returns ok=false on a non-UUID contractId', async () => {
    getUserMock.mockResolvedValue({ data: { user: proUser } });
    const { saveContractAction } = await loadActions();
    const result = await saveContractAction({
      contractId: 'not-a-uuid',
      coupleId,
      title: 't',
      content: validContent,
      expiresAt: null,
    });
    expect(result).toEqual({ ok: false, error: 'Invalid contract data.' });
  });

  it('returns ok=false when the coupleId is missing', async () => {
    getUserMock.mockResolvedValue({ data: { user: proUser } });
    const { saveContractAction } = await loadActions();
    const result = await saveContractAction({
      contractId: null,
      coupleId: 'not-a-uuid',
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
      coupleId,
      title: 't',
      content: validContent,
      expiresAt: null,
    });
    expect(result).toEqual({ ok: false, error: 'Not signed in.' });
  });

  it('updates an existing contract and returns its id', async () => {
    getUserMock.mockResolvedValue({ data: { user: proUser } });
    const { saveContractAction } = await loadActions();
    const result = await saveContractAction({
      contractId: validId,
      coupleId,
      title: 'Wedding contract',
      content: validContent,
      expiresAt: '2026-12-31',
    });
    expect(result).toEqual({ ok: true, data: { id: validId } });
    expect(fromMock).toHaveBeenCalledWith('contracts');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        couple_id: coupleId,
        title: 'Wedding contract',
        expires_at: '2026-12-31',
      }),
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('inserts a numbered draft when contractId is null', async () => {
    getUserMock.mockResolvedValue({ data: { user: proUser } });
    const { saveContractAction } = await loadActions();
    const result = await saveContractAction({
      contractId: null,
      coupleId,
      title: 'Wedding contract',
      content: validContent,
      expiresAt: null,
    });
    expect(result).toEqual({ ok: true, data: { id: newId } });
    expect(rpcMock).toHaveBeenCalledWith('generate_contract_number', { p_user_id: 'u1' });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        couple_id: coupleId,
        contract_number: 'CTR-0001',
        status: 'draft',
      }),
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('stores an empty title as null rather than inventing one', async () => {
    // Regression: this action substituted 'Untitled contract' and the builder
    // modal substituted `Contract for <couple>`. Neither was ever shown in the
    // title box, yet both were persisted and printed as the document h1 on the
    // public signing page and in the PDF, above the agreement's own heading.
    getUserMock.mockResolvedValue({ data: { user: proUser } });
    const { saveContractAction } = await loadActions();
    await saveContractAction({
      contractId: null,
      coupleId,
      title: '   ',
      content: validContent,
      expiresAt: null,
    });
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ title: null }));
    const [payload] = insertMock.mock.calls[0] as [Record<string, unknown>];
    expect(JSON.stringify(payload)).not.toContain('Untitled contract');
    expect(JSON.stringify(payload)).not.toContain('Contract for');
  });

  it('keeps a title the sender actually wrote', async () => {
    getUserMock.mockResolvedValue({ data: { user: proUser } });
    const { saveContractAction } = await loadActions();
    await saveContractAction({
      contractId: null,
      coupleId,
      title: '  Wedding Service Agreement  ',
      content: validContent,
      expiresAt: null,
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Wedding Service Agreement' }),
    );
  });

  it('refuses a create that would exceed the Starter couple cap', async () => {
    getUserMock.mockResolvedValue({ data: { user: starterUser } });
    // Five distinct couples already have contracts; this is a sixth.
    contractCoupleRows = ['a', 'b', 'c', 'd', 'e'].map((n) => ({
      couple_id: `${n}3e3e3e3-e3e3-4e3e-9e3e-e3e3e3e3e3e3`,
    }));
    const { saveContractAction } = await loadActions();
    const result = await saveContractAction({
      contractId: null,
      coupleId: otherCoupleId,
      title: 't',
      content: validContent,
      expiresAt: null,
    });
    expect(result.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('allows a second contract for a couple already at the cap', async () => {
    getUserMock.mockResolvedValue({ data: { user: starterUser } });
    contractCoupleRows = [
      { couple_id: coupleId },
      ...['b', 'c', 'd', 'e'].map((n) => ({
        couple_id: `${n}3e3e3e3-e3e3-4e3e-9e3e-e3e3e3e3e3e3`,
      })),
    ];
    const { saveContractAction } = await loadActions();
    const result = await saveContractAction({
      contractId: null,
      coupleId,
      title: 't',
      content: validContent,
      expiresAt: null,
    });
    expect(result).toEqual({ ok: true, data: { id: newId } });
  });

  it('skips the cap check entirely on an uncapped plan', async () => {
    getUserMock.mockResolvedValue({ data: { user: proUser } });
    const { saveContractAction } = await loadActions();
    await saveContractAction({
      contractId: null,
      coupleId,
      title: 't',
      content: validContent,
      expiresAt: null,
    });
    // Only the insert's `.select('id')`, never a couple_id count.
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(selectMock).toHaveBeenCalledWith('id');
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
