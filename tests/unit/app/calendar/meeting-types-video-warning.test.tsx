/**
 * The video-meeting-type warning on the Meeting types tab.
 *
 * A `video` meeting type gets its Meet/Teams link from the calendar event
 * push, so with no connection the booking is confirmed with
 * `video_join_url` null and the couple receives a "Video call" email with
 * nothing to click. That is the one gap on this route the couple sees rather
 * than just the MC, so the warning has to be tied to exactly that condition:
 * an active video type AND no connection.
 *
 * @module tests/unit/app/calendar/meeting-types-video-warning
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

import { MeetingTypesTab } from '@/app/(dashboard)/calendar/meeting-types-tab';

/** Minimal meeting-type row: only the fields the tab actually reads. */
function meetingType(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mt1',
    user_id: 'u1',
    name: 'Consultation',
    slug: 'consultation',
    duration_minutes: 30,
    location_type: 'video',
    active: true,
    description: null,
    address: null,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

const meetingTypes = vi.fn();
const connections = vi.fn();

vi.mock('@/app/(dashboard)/calendar/use-availability', () => ({
  useAvailability: () => ({
    data: { rules: [], overrides: [], timezone: 'Australia/Melbourne' },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/app/(dashboard)/calendar/use-meeting-type-availability', () => ({
  useMeetingTypeAvailability: () => ({
    data: { custom: false, rules: [] },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/app/(dashboard)/calendar/use-bookings', () => ({
  useBookings: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock('@/app/(dashboard)/calendar/use-meeting-types', () => ({
  useMeetingTypes: () => ({
    data: meetingTypes(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateMeetingType: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMeetingType: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteMeetingType: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/components/calendar/use-calendar-connections', () => ({
  CALENDAR_CONNECTIONS_KEY: ['calendar', 'connections'],
  CALENDAR_PROVIDERS: ['google', 'microsoft'],
  useCalendarConnections: () => connections(),
}));

const CONNECTED = [
  { provider: 'google', accountEmail: 'mc@test', status: 'connected', connectedAt: '' },
];

const WARNING = /won't include a join link/i;

beforeEach(() => {
  meetingTypes.mockReset().mockReturnValue([meetingType()]);
  connections.mockReset().mockReturnValue({
    connections: [],
    hasConnection: false,
    hasError: false,
    isLoading: false,
  });
});

describe('MeetingTypesTab video join-link warning', () => {
  it('warns when an active video type exists and no calendar is connected', () => {
    render(<MeetingTypesTab />);
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it('stays silent once a calendar is connected', () => {
    connections.mockReturnValue({
      connections: CONNECTED,
      hasConnection: true,
      hasError: false,
      isLoading: false,
    });
    render(<MeetingTypesTab />);
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('stays silent when the only video type is paused', () => {
    // A paused type cannot be booked, so it cannot produce a linkless booking.
    meetingTypes.mockReturnValue([meetingType({ active: false })]);
    render(<MeetingTypesTab />);
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('stays silent for in-person and phone types', () => {
    meetingTypes.mockReturnValue([
      meetingType({ location_type: 'in_person' }),
      meetingType({ id: 'mt2', location_type: 'phone' }),
    ]);
    render(<MeetingTypesTab />);
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });
});
