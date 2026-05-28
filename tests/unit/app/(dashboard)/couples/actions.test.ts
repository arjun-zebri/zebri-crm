/**
 * Unit tests for the couples server actions in
 * `app/(dashboard)/couples/actions.ts`.
 *
 * Covers Zod rejection branches + auth-gate failures + happy paths
 * with a mocked Supabase chain. The DB-side writes themselves are
 * exercised end-to-end in the integration suite
 * (tests/integration/couples/).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
const eqMock = vi.fn();
const inMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  })),
}));
vi.mock('@/lib/alerts/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  vi.resetModules();
  getUserMock.mockReset();
  fromMock.mockReset().mockReturnValue({
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    select: selectMock,
  });
  insertMock.mockReset().mockReturnValue({ select: selectMock });
  updateMock.mockReset().mockReturnValue({ eq: eqMock, in: inMock });
  deleteMock.mockReset().mockReturnValue({ eq: eqMock, in: inMock });
  selectMock.mockReset().mockReturnValue({
    single: singleMock,
    eq: eqMock,
  });
  singleMock.mockReset().mockResolvedValue({
    data: { id: 'c1c1c1c1-c1c1-4c1c-9c1c-c1c1c1c1c1c1' },
    error: null,
  });
  eqMock.mockReset().mockResolvedValue({ error: null });
  inMock.mockReset().mockResolvedValue({ error: null });
});

async function loadActions() {
  return await import('@/app/(dashboard)/couples/actions');
}

const validUuid = 'c1c1c1c1-c1c1-4c1c-9c1c-c1c1c1c1c1c1';
const baseInput = {
  name: 'Anna & Jake',
  email: 'a@example.com',
  phone: '0400000000',
  event_date: '2026-09-14',
  venue: 'Town Hall',
  notes: '',
  status: 'enquiry',
  lead_source: null,
  kanban_position: 0,
};

describe('createCoupleAction', () => {
  it('returns ok=false on an empty name (Zod rejection)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createCoupleAction } = await loadActions();
    const result = await createCoupleAction({ ...baseInput, name: '' });
    expect(result).toEqual({ ok: false, error: 'Invalid couple data.' });
  });

  it('returns ok=false on a malformed event_date', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createCoupleAction } = await loadActions();
    const result = await createCoupleAction({
      ...baseInput,
      event_date: '14/09/2026',
    });
    expect(result.ok).toBe(false);
  });

  it('returns 401-style failure when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { createCoupleAction } = await loadActions();
    const result = await createCoupleAction(baseInput);
    expect(result).toEqual({ ok: false, error: 'Not signed in.' });
  });

  it('translates the Starter-cap trigger error to code=starter_limit', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'new row violates STARTER_COUPLE_LIMIT' },
    });
    const { createCoupleAction } = await loadActions();
    const result = await createCoupleAction(baseInput);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('starter_limit');
  });

  it('returns the new id on the happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createCoupleAction } = await loadActions();
    const result = await createCoupleAction(baseInput);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.id).toBe(validUuid);
  });
});

describe('updateCoupleAction', () => {
  it('returns ok=false on a non-UUID id', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateCoupleAction } = await loadActions();
    const result = await updateCoupleAction({
      ...baseInput,
      id: 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
  });

  it('calls supabase update on the happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    // Re-wire selectMock for the .update().eq().select().single() chain.
    eqMock.mockReturnValueOnce({ select: selectMock });
    const { updateCoupleAction } = await loadActions();
    const result = await updateCoupleAction({ ...baseInput, id: validUuid });
    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('couples');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Anna & Jake' }),
    );
  });
});

describe('deleteCoupleAction', () => {
  it('returns ok=false on a non-UUID id', async () => {
    const { deleteCoupleAction } = await loadActions();
    const result = await deleteCoupleAction('not-a-uuid');
    expect(result).toEqual({ ok: false, error: 'Invalid couple ID.' });
  });

  it('returns 401-style failure when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { deleteCoupleAction } = await loadActions();
    const result = await deleteCoupleAction(validUuid);
    expect(result).toEqual({ ok: false, error: 'Not signed in.' });
  });

  it('deletes on the happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { deleteCoupleAction } = await loadActions();
    const result = await deleteCoupleAction(validUuid);
    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('couples');
    expect(deleteMock).toHaveBeenCalled();
  });
});

describe('bulk actions', () => {
  it('bulkMoveCouplesAction accepts an empty payload and returns empty updatedIds', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { bulkMoveCouplesAction } = await loadActions();
    const result = await bulkMoveCouplesAction([]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.updatedIds).toEqual([]);
  });

  it('bulkUpdateCouplesStatusAction rejects when ids is empty (Zod min(1))', async () => {
    const { bulkUpdateCouplesStatusAction } = await loadActions();
    const result = await bulkUpdateCouplesStatusAction({
      ids: [],
      status: 'lost',
    });
    expect(result.ok).toBe(false);
  });

  it('bulkDeleteCouplesAction rejects when ids contains a non-UUID', async () => {
    const { bulkDeleteCouplesAction } = await loadActions();
    const result = await bulkDeleteCouplesAction([
      validUuid,
      'not-a-uuid',
    ]);
    expect(result.ok).toBe(false);
  });
});
