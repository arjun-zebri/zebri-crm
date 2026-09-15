/**
 * Booking links are switched off on the Meeting types tab until a calendar is
 * connected.
 *
 * The public RPCs refuse every meeting type whose owner has no working
 * calendar (a booking that never reaches the MC's real calendar, and for
 * video a "link to follow" that nothing sends). The tab has to say so and
 * withhold the link actions, otherwise the MC hands out links that couples
 * see as unavailable.
 *
 * @module tests/unit/app/calendar/meeting-types-links-off
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

const NOTE = /switched off until a calendar is connected/i;

beforeEach(() => {
  meetingTypes.mockReset().mockReturnValue([meetingType()]);
  connections.mockReset().mockReturnValue({
    connections: [],
    hasConnection: false,
    hasError: false,
    isLoading: false,
  });
});

describe('MeetingTypesTab with no calendar connected', () => {
  it('says the links are off and withholds the copy-link action', () => {
    render(<MeetingTypesTab />);
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeDisabled();
  });

  it('applies to phone and in-person types too, not just video', () => {
    meetingTypes.mockReturnValue([
      meetingType({ location_type: 'in_person' }),
      meetingType({ id: 'mt2', location_type: 'phone' }),
    ]);
    render(<MeetingTypesTab />);
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /copy link/i })) {
      expect(button).toBeDisabled();
    }
  });

  it('treats a broken connection the same as none', () => {
    connections.mockReturnValue({
      connections: [{ ...CONNECTED[0], status: 'error' }],
      hasConnection: false,
      hasError: true,
      isLoading: false,
    });
    render(<MeetingTypesTab />);
    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });

  it('enables everything once a calendar is connected', () => {
    connections.mockReturnValue({
      connections: CONNECTED,
      hasConnection: true,
      hasError: false,
      isLoading: false,
    });
    render(<MeetingTypesTab />);
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeEnabled();
  });
});
