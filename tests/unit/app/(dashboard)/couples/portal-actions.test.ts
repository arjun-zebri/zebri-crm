/**
 * Unit tests for the MC Portal section actions in
 * `app/(dashboard)/couples/portal-actions.ts`.
 *
 * Zod-rejection branches + auth-gate failures + happy paths with a
 * mocked Supabase chain.
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
  updateMock.mockReset().mockReturnValue({ eq: eqMock });
  deleteMock.mockReset().mockReturnValue({ eq: eqMock });
  selectMock.mockReset().mockReturnValue({
    single: singleMock,
    eq: eqMock,
  });
  singleMock.mockReset().mockResolvedValue({
    data: { id: 'c1c1c1c1-c1c1-4c1c-9c1c-c1c1c1c1c1c1' },
    error: null,
  });
  eqMock.mockReset().mockResolvedValue({ error: null, data: [] });
});

async function load() {
  return await import('@/app/(dashboard)/couples/portal-actions');
}

const validUuid = 'c1c1c1c1-c1c1-4c1c-9c1c-c1c1c1c1c1c1';

describe('addPortalPersonAction', () => {
  it('rejects an empty full_name', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { addPortalPersonAction } = await load();
    const result = await addPortalPersonAction({
      couple_id: validUuid,
      category: 'partner',
      full_name: '   ',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-UUID couple_id', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { addPortalPersonAction } = await load();
    const result = await addPortalPersonAction({
      couple_id: 'not-a-uuid',
      category: 'partner',
      full_name: 'Anna',
    });
    expect(result.ok).toBe(false);
  });

  it('returns 401 when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { addPortalPersonAction } = await load();
    const result = await addPortalPersonAction({
      couple_id: validUuid,
      category: 'partner',
      full_name: 'Anna',
    });
    expect(result).toEqual({ ok: false, error: 'Not signed in.' });
  });

  it('returns the new id on happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { addPortalPersonAction } = await load();
    const result = await addPortalPersonAction({
      couple_id: validUuid,
      category: 'partner',
      full_name: 'Anna',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.id).toBe(validUuid);
  });
});

describe('updatePortalPersonAction', () => {
  it('rejects an empty patch', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updatePortalPersonAction } = await load();
    const result = await updatePortalPersonAction({
      id: validUuid,
      patch: {},
    });
    expect(result.ok).toBe(false);
  });

  it('calls supabase update on happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updatePortalPersonAction } = await load();
    const result = await updatePortalPersonAction({
      id: validUuid,
      patch: { full_name: 'Updated' },
    });
    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('portal_people');
  });
});

describe('addPortalSongAction', () => {
  it('rejects empty title', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { addPortalSongAction } = await load();
    const result = await addPortalSongAction({
      couple_id: validUuid,
      category: 'first_dance',
      title: '   ',
    });
    expect(result.ok).toBe(false);
  });

  it('accepts optional artist + notes', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { addPortalSongAction } = await load();
    const result = await addPortalSongAction({
      couple_id: validUuid,
      category: 'first_dance',
      title: 'Our Song',
    });
    expect(result.ok).toBe(true);
  });
});

describe('addPortalSongCategoryAction', () => {
  it('rejects empty key', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { addPortalSongCategoryAction } = await load();
    const result = await addPortalSongCategoryAction({
      couple_id: validUuid,
      key: '',
      label: 'My Category',
    });
    expect(result.ok).toBe(false);
  });
});

describe('updatePortalSongCategoryAction', () => {
  it('rejects an empty label', async () => {
    const { updatePortalSongCategoryAction } = await load();
    const result = await updatePortalSongCategoryAction(validUuid, '   ');
    expect(result.ok).toBe(false);
  });

  it('renames on the happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updatePortalSongCategoryAction } = await load();
    const result = await updatePortalSongCategoryAction(
      validUuid,
      'Renamed Category',
    );
    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ label: 'Renamed Category' });
  });
});

describe('addPortalFileAction', () => {
  it('rejects an empty file_url', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { addPortalFileAction } = await load();
    const result = await addPortalFileAction({
      couple_id: validUuid,
      name: 'doc.pdf',
      file_url: '',
      file_size: 1024,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects file_size over the 100MB cap', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { addPortalFileAction } = await load();
    const result = await addPortalFileAction({
      couple_id: validUuid,
      name: 'huge.bin',
      file_url: 'https://example.test/huge.bin',
      file_size: 200 * 1024 * 1024,
    });
    expect(result.ok).toBe(false);
  });
});

describe('addCoupleContactLinkAction', () => {
  it('rejects non-UUID contact_id', async () => {
    const { addCoupleContactLinkAction } = await load();
    const result = await addCoupleContactLinkAction({
      couple_id: validUuid,
      contact_id: 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
  });
});

describe('updateContactAction', () => {
  it('rejects an empty patch', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateContactAction } = await load();
    const result = await updateContactAction({
      id: validUuid,
      patch: {},
    });
    expect(result.ok).toBe(false);
  });
});

describe('approveTimelineItemAction', () => {
  it('rejects a non-UUID id', async () => {
    const { approveTimelineItemAction } = await load();
    const result = await approveTimelineItemAction('not-a-uuid');
    expect(result).toEqual({ ok: false, error: 'Invalid item ID.' });
  });

  it('flips pending_review to false', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { approveTimelineItemAction } = await load();
    const result = await approveTimelineItemAction(validUuid);
    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ pending_review: false });
  });
});
