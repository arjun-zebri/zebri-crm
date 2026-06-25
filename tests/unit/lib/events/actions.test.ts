/**
 * Unit tests for the events server actions in `lib/events/actions.ts`.
 *
 * Covers Zod rejection branches + auth-gate failures + happy paths
 * with a mocked Supabase chain. End-to-end DB writes are exercised
 * in tests/integration/events/.
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
    data: { id: 'e1e1e1e1-e1e1-4e1e-9e1e-e1e1e1e1e1e1' },
    error: null,
  });
  eqMock.mockReset().mockResolvedValue({ error: null, data: [] });
});

async function loadActions() {
  return await import('@/lib/events/actions');
}

const validUuid = 'e1e1e1e1-e1e1-4e1e-9e1e-e1e1e1e1e1e1';
const baseEvent = {
  couple_id: validUuid,
  date: '2026-09-14',
  venue: 'Town Hall',
  timeline_notes: '',
  status: 'upcoming' as const,
};

describe('createEventAction', () => {
  it('returns ok=false on a malformed date', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createEventAction } = await loadActions();
    const result = await createEventAction({
      ...baseEvent,
      date: '14/09/2026',
    });
    expect(result.ok).toBe(false);
  });

  it('returns ok=false on a non-UUID couple_id', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createEventAction } = await loadActions();
    const result = await createEventAction({
      ...baseEvent,
      couple_id: 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
  });

  it('returns 401-style failure when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { createEventAction } = await loadActions();
    const result = await createEventAction(baseEvent);
    expect(result).toEqual({ ok: false, error: 'Not signed in.' });
  });

  it('returns the new id on the happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createEventAction } = await loadActions();
    const result = await createEventAction(baseEvent);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.id).toBe(validUuid);
  });
});

describe('updateEventAction', () => {
  it('returns ok=false on a non-UUID id', async () => {
    const { updateEventAction } = await loadActions();
    const result = await updateEventAction({
      ...baseEvent,
      id: 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
  });
});

describe('deleteEventAction', () => {
  it('returns ok=false on a non-UUID id', async () => {
    const { deleteEventAction } = await loadActions();
    const result = await deleteEventAction('not-a-uuid');
    expect(result).toEqual({ ok: false, error: 'Invalid event ID.' });
  });

  it('returns 401 when no auth session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { deleteEventAction } = await loadActions();
    const result = await deleteEventAction(validUuid);
    expect(result).toEqual({ ok: false, error: 'Not signed in.' });
  });
});

describe('setEventShareEnabledAction', () => {
  it('returns ok=false on a non-UUID id', async () => {
    const { setEventShareEnabledAction } = await loadActions();
    const result = await setEventShareEnabledAction('not-a-uuid', true);
    expect(result).toEqual({ ok: false, error: 'Invalid event ID.' });
  });

  it('toggles on the happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { setEventShareEnabledAction } = await loadActions();
    const result = await setEventShareEnabledAction(validUuid, true);
    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ share_token_enabled: true });
  });
});

describe('rotateEventShareTokenAction', () => {
  it('returns ok=false on a non-UUID id', async () => {
    const { rotateEventShareTokenAction } = await loadActions();
    const result = await rotateEventShareTokenAction('not-a-uuid');
    expect(result.ok).toBe(false);
  });

  it('returns a fresh share_token on success', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { rotateEventShareTokenAction } = await loadActions();
    const result = await rotateEventShareTokenAction(validUuid);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.share_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe('createTimelineItemAction', () => {
  it('returns ok=false on a malformed start_time', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTimelineItemAction } = await loadActions();
    const result = await createTimelineItemAction({
      event_id: validUuid,
      title: 'Ceremony',
      start_time: '5:00 PM',
      position: 0,
    });
    expect(result.ok).toBe(false);
  });

  it('accepts HH:MM and HH:MM:SS', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTimelineItemAction } = await loadActions();
    const result1 = await createTimelineItemAction({
      event_id: validUuid,
      title: 'Ceremony',
      start_time: '17:00',
      position: 0,
    });
    expect(result1.ok).toBe(true);

    const result2 = await createTimelineItemAction({
      event_id: validUuid,
      title: 'Ceremony',
      start_time: '17:00:00',
      position: 0,
    });
    expect(result2.ok).toBe(true);
  });

  it('returns ok=false on duration > 24 hours', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTimelineItemAction } = await loadActions();
    const result = await createTimelineItemAction({
      event_id: validUuid,
      title: 'Marathon',
      duration_min: 2000,
      position: 0,
    });
    expect(result.ok).toBe(false);
  });

  it('forwards the internal flag into the insert (Sunset is MC-only)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTimelineItemAction } = await loadActions();
    const result = await createTimelineItemAction({
      event_id: validUuid,
      title: 'Sunset',
      start_time: '19:00',
      position: 1000,
      internal: true,
    });
    expect(result.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ internal: true, user_id: 'u1' }),
    );
  });

  it('omits internal from the insert when not set (forward-compatible)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { createTimelineItemAction } = await loadActions();
    const result = await createTimelineItemAction({
      event_id: validUuid,
      title: 'Ceremony',
      position: 0,
    });
    expect(result.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ internal: expect.anything() }),
    );
  });
});

describe('updateTimelineItemAction', () => {
  it('rejects an empty patch', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateTimelineItemAction } = await loadActions();
    const result = await updateTimelineItemAction({ id: validUuid, patch: {} });
    expect(result.ok).toBe(false);
  });
});

describe('linkContactToEventAction', () => {
  it('returns ok=false on non-UUID contact_id', async () => {
    const { linkContactToEventAction } = await loadActions();
    const result = await linkContactToEventAction({
      event_id: validUuid,
      contact_id: 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
  });

  it('calls supabase insert on happy path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    insertMock.mockReset().mockResolvedValue({ error: null });
    const { linkContactToEventAction } = await loadActions();
    const result = await linkContactToEventAction({
      event_id: validUuid,
      contact_id: validUuid,
    });
    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('event_contacts');
  });
});

describe('bulkLinkContactsToEventAction', () => {
  it('rejects an empty contact_ids array', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { bulkLinkContactsToEventAction } = await loadActions();
    const result = await bulkLinkContactsToEventAction({
      event_id: validUuid,
      contact_ids: [],
    });
    expect(result.ok).toBe(false);
  });
});
