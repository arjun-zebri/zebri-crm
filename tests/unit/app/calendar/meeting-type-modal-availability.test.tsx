/**
 * Meeting-type modal: the per-type availability section.
 *
 * Kept out of `meeting-type-modal.test.tsx` so the two concerns (the form
 * fields, and the type's own hours) can move independently.
 *
 * @module tests/unit/app/calendar/meeting-type-modal-availability
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MeetingTypeModal } from '@/app/(dashboard)/calendar/meeting-type-modal';
import type { Database } from '@/types/database';

type MeetingType = Database['public']['Tables']['meeting_types']['Row'];

const mockCreateMeetingType = vi.fn();
const mockUpdateMeetingType = vi.fn();

// Stable references: a fresh object per call would re-run the seeding effect
// forever and surface as "Maximum update depth exceeded".
const standardHours = {
  data: {
    rules: [{ weekday: 1, start_time: '09:00:00', end_time: '17:00:00' }],
    overrides: [],
    timezone: 'Australia/Sydney',
  },
  isLoading: false,
  error: null,
};

let typeRules: { weekday: number; start_time: string; end_time: string }[] = [];

vi.mock('@/app/(dashboard)/calendar/use-availability', () => ({
  useAvailability: () => standardHours,
}));

vi.mock('@/app/(dashboard)/calendar/use-meeting-type-availability', () => ({
  useMeetingTypeAvailability: () => ({
    data: typeRules,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/app/(dashboard)/calendar/use-meeting-types', () => ({
  useCreateMeetingType: () => ({
    mutateAsync: mockCreateMeetingType,
    isPending: false,
  }),
  useUpdateMeetingType: () => ({
    mutateAsync: mockUpdateMeetingType,
    isPending: false,
  }),
}));

/** A stored meeting type, on standard hours unless told otherwise. */
function meetingType(overrides: Partial<MeetingType> = {}): MeetingType {
  return {
    id: 'mt-1',
    user_id: 'user-1',
    name: 'Discovery call',
    description: null,
    duration_minutes: 30,
    location_type: 'video',
    address: null,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    min_notice_hours: 24,
    max_advance_days: 60,
    reminder_enabled: true,
    active: true,
    uses_custom_availability: false,
    share_token: 'token-1',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  } as MeetingType;
}

describe('MeetingTypeModal: per-type availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    typeRules = [];
    mockCreateMeetingType.mockResolvedValue(undefined);
    mockUpdateMeetingType.mockResolvedValue(undefined);
  });

  it('offers the standard hours by default on a new type', () => {
    render(<MeetingTypeModal isOpen onClose={vi.fn()} meetingType={null} />);

    expect(screen.getByRole('switch', { name: /use my standard hours/i })).toBeChecked();
    expect(screen.queryByRole('switch', { name: 'Enable Monday' })).not.toBeInTheDocument();
  });

  it('seeds the grid from the MC\'s standard hours when custom is switched on', async () => {
    const user = userEvent.setup();
    render(<MeetingTypeModal isOpen onClose={vi.fn()} meetingType={null} />);

    await user.click(screen.getByRole('switch', { name: /use my standard hours/i }));

    expect(screen.getByRole('switch', { name: 'Enable Monday' })).toBeChecked();
    expect(screen.getByText('8h bookable')).toBeInTheDocument();
  });

  it('opens an existing custom-hours type on its own windows, not the standard ones', async () => {
    typeRules = [{ weekday: 6, start_time: '08:00:00', end_time: '11:00:00' }];

    render(
      <MeetingTypeModal
        isOpen
        onClose={vi.fn()}
        meetingType={meetingType({ uses_custom_availability: true })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Enable Saturday' })).toBeChecked();
    });
    expect(screen.getByRole('switch', { name: 'Enable Monday' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: /use my standard hours/i })).not.toBeChecked();
  });

  it('saves custom: false and no rules for a type on standard hours', async () => {
    const user = userEvent.setup();
    render(<MeetingTypeModal isOpen onClose={vi.fn()} meetingType={meetingType()} />);

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockUpdateMeetingType).toHaveBeenCalled();
    });
    expect(mockUpdateMeetingType.mock.calls[0]![0].availability).toEqual({
      custom: false,
      rules: [],
    });
  });

  it('saves the edited windows for a type on custom hours', async () => {
    const user = userEvent.setup();
    render(<MeetingTypeModal isOpen onClose={vi.fn()} meetingType={meetingType()} />);

    await user.click(screen.getByRole('switch', { name: /use my standard hours/i }));
    await user.click(screen.getByRole('switch', { name: 'Enable Monday' }));
    await user.click(screen.getByRole('switch', { name: 'Enable Saturday' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockUpdateMeetingType).toHaveBeenCalled();
    });
    const { availability } = mockUpdateMeetingType.mock.calls[0]![0];
    expect(availability.custom).toBe(true);
    expect(availability.rules).toEqual([
      { weekday: 6, start_time: '09:00', end_time: '17:00' },
    ]);
  });
});
