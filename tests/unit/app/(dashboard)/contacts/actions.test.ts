/**
 * Unit tests for the contacts server actions.
 *
 * Zod rejection branches + auth-gate failures + happy paths with a
 * mocked Supabase chain. DB writes themselves are exercised
 * end-to-end in `tests/integration/contacts/`.
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
    data: { id: 'c1c1c1c1-c1c1-4c1c-9c1c-c1c1c1c1c1c1', name: 'X', category: 'photographer', email: '', phone: '', contact_name: '', notes: '', status: 'active' },
    error: null,
  });
  eqMock.mockReset().mockResolvedValue({ error: null });
  inMock.mockReset().mockResolvedValue({ error: null });
});

async function loadActions() {
  return await import('@/app/(dashboard)/contacts/actions');
}

const validUuid = 'c1c1c1c1-c1c1-4c1c-9c1c-c1c1c1c1c1c1';

describe('createContactAction', () => {
  it('rejects an empty name', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createContactAction } = await loadActions();
    const result = await createContactAction({
      name: '   ',
      category: 'photographer',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid category (not in canonical enum)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createContactAction } = await loadActions();
    const result = await createContactAction({
      name: 'Test',
      // Cast through unknown — Zod is the runtime gate; we hand it a
      // value the type system would reject to exercise rejection.
      category: 'astronaut' as unknown as 'photographer',
    });
    expect(result.ok).toBe(false);
  });

  it('returns 401 when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { createContactAction } = await loadActions();
    const result = await createContactAction({
      name: 'Test',
      category: 'photographer',
    });
    expect(result).toEqual({ ok: false, error: 'Not signed in.' });
  });

  it('returns the new contact on happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createContactAction } = await loadActions();
    const result = await createContactAction({
      name: 'Test',
      category: 'photographer',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.id).toBe(validUuid);
  });
});

describe('updateContactAction', () => {
  it('rejects a non-UUID id', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateContactAction } = await loadActions();
    const result = await updateContactAction({
      id: 'not-a-uuid',
      name: 'X',
      category: 'photographer',
    });
    expect(result.ok).toBe(false);
  });

  it('updates on happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    eqMock.mockReturnValueOnce({ select: selectMock });
    const { updateContactAction } = await loadActions();
    const result = await updateContactAction({
      id: validUuid,
      name: 'Updated',
      category: 'photographer',
    });
    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('contacts');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated' }),
    );
  });
});

describe('deleteContactAction', () => {
  it('rejects a non-UUID id', async () => {
    const { deleteContactAction } = await loadActions();
    const result = await deleteContactAction('not-a-uuid');
    expect(result).toEqual({ ok: false, error: 'Invalid contact ID.' });
  });

  it('returns 401 when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { deleteContactAction } = await loadActions();
    const result = await deleteContactAction(validUuid);
    expect(result).toEqual({ ok: false, error: 'Not signed in.' });
  });

  it('deletes on the happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { deleteContactAction } = await loadActions();
    const result = await deleteContactAction(validUuid);
    expect(result.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalled();
  });
});

describe('bulk actions', () => {
  it('bulkDeleteContactsAction rejects an empty array (Zod min(1))', async () => {
    const { bulkDeleteContactsAction } = await loadActions();
    const result = await bulkDeleteContactsAction([]);
    expect(result.ok).toBe(false);
  });

  it('bulkDeleteContactsAction rejects non-UUIDs', async () => {
    const { bulkDeleteContactsAction } = await loadActions();
    const result = await bulkDeleteContactsAction([validUuid, 'not-a-uuid']);
    expect(result.ok).toBe(false);
  });

  it('bulkUpdateContactsStatusAction rejects an invalid status', async () => {
    const { bulkUpdateContactsStatusAction } = await loadActions();
    const result = await bulkUpdateContactsStatusAction({
      ids: [validUuid],
      // Cast through unknown — Zod is the runtime gate.
      status: 'archived' as unknown as 'inactive',
    });
    expect(result.ok).toBe(false);
  });

  it('bulkUpdateContactsStatusAction updates on happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { bulkUpdateContactsStatusAction } = await loadActions();
    const result = await bulkUpdateContactsStatusAction({
      ids: [validUuid],
      status: 'inactive',
    });
    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ status: 'inactive' });
  });
});
