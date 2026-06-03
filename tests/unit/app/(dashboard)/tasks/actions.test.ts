/**
 * Unit tests for tasks server actions — Zod-rejection branches +
 * auth-gate + happy paths with a mocked Supabase chain.
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
const orderMock = vi.fn();
const limitMock = vi.fn();

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
    order: orderMock,
  });
  orderMock.mockReset().mockReturnValue({ limit: limitMock });
  limitMock.mockReset().mockResolvedValue({ data: [], error: null });
  singleMock.mockReset().mockResolvedValue({
    data: { id: 'a1a1a1a1-a1a1-4a1a-9a1a-a1a1a1a1a1a1', name: 'X', color: 'gray', position: 0 },
    error: null,
  });
  eqMock.mockReset().mockResolvedValue({ error: null });
  inMock.mockReset().mockResolvedValue({ error: null });
});

async function load() {
  return await import('@/app/(dashboard)/tasks/actions');
}

const validUuid = 'a1a1a1a1-a1a1-4a1a-9a1a-a1a1a1a1a1a1';

describe('createTaskAction', () => {
  it('rejects empty title', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTaskAction } = await load();
    const result = await createTaskAction({ title: '   ' });
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed due_date', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTaskAction } = await load();
    const result = await createTaskAction({
      title: 'X',
      due_date: '14/09/2026',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-UUID related_couple_id', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTaskAction } = await load();
    const result = await createTaskAction({
      title: 'X',
      related_couple_id: 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
  });

  it('returns 401 when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { createTaskAction } = await load();
    const result = await createTaskAction({ title: 'X' });
    expect(result).toEqual({ ok: false, error: 'Not signed in.' });
  });

  it('returns the new id on happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTaskAction } = await load();
    const result = await createTaskAction({ title: 'X' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.id).toBe(validUuid);
  });
});

describe('updateTaskAction', () => {
  it('rejects an empty patch', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateTaskAction } = await load();
    const result = await updateTaskAction({ id: validUuid, patch: {} });
    expect(result.ok).toBe(false);
  });

  it('updates on happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateTaskAction } = await load();
    const result = await updateTaskAction({
      id: validUuid,
      patch: { status: 'done' },
    });
    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('tasks');
  });
});

describe('deleteTaskAction', () => {
  it('rejects a non-UUID id', async () => {
    const { deleteTaskAction } = await load();
    const result = await deleteTaskAction('not-a-uuid');
    expect(result).toEqual({ ok: false, error: 'Invalid task ID.' });
  });
});

describe('bulk actions', () => {
  it('bulkUpdateTasksAction rejects empty ids', async () => {
    const { bulkUpdateTasksAction } = await load();
    const result = await bulkUpdateTasksAction({
      ids: [],
      patch: { status: 'done' },
    });
    expect(result.ok).toBe(false);
  });

  it('bulkUpdateTasksAction rejects empty patch', async () => {
    const { bulkUpdateTasksAction } = await load();
    const result = await bulkUpdateTasksAction({
      ids: [validUuid],
      patch: {},
    });
    expect(result.ok).toBe(false);
  });

  it('bulkDeleteTasksAction rejects empty array', async () => {
    const { bulkDeleteTasksAction } = await load();
    const result = await bulkDeleteTasksAction([]);
    expect(result.ok).toBe(false);
  });

  it('bulkDeleteTasksAction rejects non-UUIDs', async () => {
    const { bulkDeleteTasksAction } = await load();
    const result = await bulkDeleteTasksAction([validUuid, 'not-a-uuid']);
    expect(result.ok).toBe(false);
  });
});

describe('reorderTasksAction', () => {
  it('rejects empty array', async () => {
    const { reorderTasksAction } = await load();
    const result = await reorderTasksAction([]);
    expect(result.ok).toBe(false);
  });
});

describe('createTaskGroupAction', () => {
  it('rejects empty name', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTaskGroupAction } = await load();
    const result = await createTaskGroupAction({ name: '   ' });
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid color (closed enum)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTaskGroupAction } = await load();
    const result = await createTaskGroupAction({
      name: 'X',
      // Cast through unknown — Zod is the runtime gate.
      color: 'neon' as unknown as 'gray',
    });
    expect(result.ok).toBe(false);
  });
});

describe('updateTaskGroupAction', () => {
  it('rejects an empty patch', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateTaskGroupAction } = await load();
    const result = await updateTaskGroupAction({
      id: validUuid,
      patch: {},
    });
    expect(result.ok).toBe(false);
  });
});

describe('deleteTaskGroupAction', () => {
  it('rejects a non-UUID id', async () => {
    const { deleteTaskGroupAction } = await load();
    const result = await deleteTaskGroupAction('not-a-uuid');
    expect(result).toEqual({ ok: false, error: 'Invalid group ID.' });
  });
});

describe('reorderTaskGroupsAction', () => {
  it('rejects empty array', async () => {
    const { reorderTaskGroupsAction } = await load();
    const result = await reorderTaskGroupsAction([]);
    expect(result.ok).toBe(false);
  });
});
