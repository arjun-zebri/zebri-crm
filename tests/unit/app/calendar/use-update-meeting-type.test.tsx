/**
 * Tests for the optimistic behaviour of useUpdateMeetingType.
 *
 * The status switch lives on the meeting type card, so it has to move on the
 * click rather than after a server round trip and a refetch.
 *
 * @module tests/unit/app/calendar/use-update-meeting-type
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateMeetingTypeAction = vi.fn();

vi.mock('@/app/(dashboard)/calendar/meeting-type-actions', () => ({
  updateMeetingTypeAction: (...args: unknown[]) => updateMeetingTypeAction(...args),
  createMeetingTypeAction: vi.fn(),
  deleteMeetingTypeAction: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

const row = {
  id: 'mt-1',
  user_id: 'u1',
  name: 'Intro call',
  description: 'First chat.',
  duration_minutes: 30,
  location_type: 'video',
  address: null,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_hours: 24,
  max_advance_days: 60,
  reminder_enabled: true,
  active: true,
  share_token: 'tok',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

/** Everything the update schema requires, so nothing is blanked. */
const fullInput = {
  name: row.name,
  description: row.description,
  duration_minutes: row.duration_minutes,
  location_type: row.location_type as 'video' | 'phone' | 'in_person',
  address: row.address,
  buffer_before_minutes: row.buffer_before_minutes,
  buffer_after_minutes: row.buffer_after_minutes,
  min_notice_hours: row.min_notice_hours,
  max_advance_days: row.max_advance_days,
  reminder_enabled: row.reminder_enabled,
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(['meeting-types'], [row]);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

async function loadHook() {
  const mod = await import('@/app/(dashboard)/calendar/use-meeting-types');
  return mod.useUpdateMeetingType;
}

describe('useUpdateMeetingType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flips the cached row before the server has answered', async () => {
    // A never-resolving action holds the mutation open, so anything visible in
    // the cache here is the optimistic write and nothing else.
    updateMeetingTypeAction.mockReturnValue(new Promise(() => {}));
    const useUpdateMeetingType = await loadHook();
    const { client, wrapper } = setup();

    const { result } = renderHook(() => useUpdateMeetingType(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mt-1', ...fullInput, active: false });
    });

    await waitFor(() => {
      const cached = client.getQueryData<(typeof row)[]>(['meeting-types']);
      expect(cached![0]!.active).toBe(false);
    });
  });

  it('puts the row back when the server rejects the change', async () => {
    updateMeetingTypeAction.mockResolvedValue({ ok: false, error: 'nope' });
    const useUpdateMeetingType = await loadHook();
    const { client, wrapper } = setup();

    const { result } = renderHook(() => useUpdateMeetingType(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mt-1', ...fullInput, active: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = client.getQueryData<(typeof row)[]>(['meeting-types']);
    expect(cached![0]!.active).toBe(true);
    // Rolled back wholesale, so unrelated fields survive too.
    expect(cached![0]!.name).toBe('Intro call');
    expect(cached![0]!.description).toBe('First chat.');
  });

  it('leaves other meeting types untouched', async () => {
    updateMeetingTypeAction.mockReturnValue(new Promise(() => {}));
    const useUpdateMeetingType = await loadHook();
    const { client, wrapper } = setup();
    const other = { ...row, id: 'mt-2', name: 'Ceremony planning' };
    client.setQueryData(['meeting-types'], [row, other]);

    const { result } = renderHook(() => useUpdateMeetingType(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'mt-1', ...fullInput, active: false });
    });

    await waitFor(() => {
      const cached = client.getQueryData<(typeof row)[]>(['meeting-types']);
      expect(cached![0]!.active).toBe(false);
      expect(cached![1]!.active).toBe(true);
      expect(cached![1]!.name).toBe('Ceremony planning');
    });
  });
});
