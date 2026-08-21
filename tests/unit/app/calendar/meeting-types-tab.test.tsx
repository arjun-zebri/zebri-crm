/**
 * Meeting types tab tests.
 *
 * Regression coverage for the empty-state create flow: with zero
 * meeting types the tab early-returns the Empty view, and the create
 * modal must still mount when "New meeting type" is clicked (it once
 * lived only in the non-empty return, so the button did nothing for a
 * brand-new user).
 *
 * @module tests/unit/app/calendar/meeting-types-tab
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MeetingTypesTab } from '@/app/(dashboard)/calendar/meeting-types-tab';

const mockCreateMeetingType = vi.fn();

// Stable references: a fresh object per call loops any effect depending on it.
const availabilityResult = {
  data: { rules: [], overrides: [], timezone: 'Australia/Melbourne' },
  isLoading: false,
  error: null,
};
const typeAvailabilityResult = {
  data: { custom: false, rules: [] },
  isLoading: false,
  error: null,
};

// The tab counts this month's bookings per type, so it now reaches for the
// bookings query as well.
vi.mock('@/app/(dashboard)/calendar/use-availability', () => ({
  useAvailability: () => availabilityResult,
}));

vi.mock('@/app/(dashboard)/calendar/use-meeting-type-availability', () => ({
  useMeetingTypeAvailability: () => typeAvailabilityResult,
}));

vi.mock('@/app/(dashboard)/calendar/use-bookings', () => ({
  useBookings: () => ({ data: [], isLoading: false, error: null }),
}));

// The tab warns when a video meeting type would ship without a join link, so
// it reads the shared connection list too. Connected by default here; the
// unconnected case is asserted in its own file.
vi.mock('@/components/calendar/use-calendar-connections', () => ({
  CALENDAR_CONNECTIONS_KEY: ['calendar', 'connections'],
  CALENDAR_PROVIDERS: ['google', 'microsoft'],
  useCalendarConnections: () => ({
    connections: [
      { provider: 'google', accountEmail: 'mc@test', status: 'connected', connectedAt: '' },
    ],
    hasConnection: true,
    hasError: false,
    isLoading: false,
  }),
}));

vi.mock('@/app/(dashboard)/calendar/use-meeting-types', () => ({
  useMeetingTypes: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateMeetingType: () => ({
    mutateAsync: mockCreateMeetingType,
    isPending: false,
  }),
  useUpdateMeetingType: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteMeetingType: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe('MeetingTypesTab (empty state)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when there are no meeting types', () => {
    render(<MeetingTypesTab />);
    expect(screen.getByText('No meeting types yet')).toBeInTheDocument();
  });

  it('opens the create modal from the empty-state button', async () => {
    const user = userEvent.setup();
    render(<MeetingTypesTab />);

    await user.click(screen.getByRole('button', { name: 'New meeting type' }));

    // The modal renders its title and the name field when mounted.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });
});

describe('MeetingTypesTab (templates)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers starter templates even when there are no meeting types', async () => {
    // The empty state is exactly where a starting point is most useful, and an
    // earlier version of this tab only rendered extras in the non-empty branch.
    const user = userEvent.setup();
    render(<MeetingTypesTab />);

    await user.click(screen.getByRole('button', { name: 'Start from a template' }));

    expect(screen.getByTestId('meeting-type-template-intro-call')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-type-template-noim-paperwork')).toBeInTheDocument();
  });

  it('keeps templates behind the button until it is pressed', () => {
    render(<MeetingTypesTab />);

    expect(screen.queryByTestId('meeting-type-template-intro-call')).not.toBeInTheDocument();
  });

  it('opens the create form prefilled from the chosen template', async () => {
    const user = userEvent.setup();
    render(<MeetingTypesTab />);

    await user.click(screen.getByRole('button', { name: 'Start from a template' }));
    await user.click(screen.getByTestId('meeting-type-template-ceremony-planning'));

    // Create, not edit: a template has no row behind it.
    expect(screen.getByText('Create meeting type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ceremony planning')).toBeInTheDocument();
    // The picker closes as the form opens, rather than stacking behind it.
    // Asserted on a list item, not the title: the button that opens the picker
    // carries the same words and stays on the page.
    expect(screen.queryByTestId('meeting-type-template-intro-call')).not.toBeInTheDocument();
  });

  it('leaves the form blank when creating from scratch', async () => {
    const user = userEvent.setup();
    render(<MeetingTypesTab />);

    await user.click(screen.getByRole('button', { name: 'New meeting type' }));

    expect(screen.getByText('Create meeting type')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Ceremony planning')).not.toBeInTheDocument();
  });
})

describe('MeetingTypesTab (loading)', () => {
  it('shows a skeleton shaped like the card grid, not a spinner', async () => {
    // A centred spinner says nothing about what is coming and reflows the page
    // when it resolves; the skeleton holds the layout.
    vi.resetModules();
    vi.doMock('@/app/(dashboard)/calendar/use-meeting-types', () => ({
      useMeetingTypes: () => ({
        data: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      }),
      useCreateMeetingType: () => ({ mutateAsync: vi.fn(), isPending: false }),
      useUpdateMeetingType: () => ({ mutateAsync: vi.fn(), isPending: false }),
      useDeleteMeetingType: () => ({ mutateAsync: vi.fn(), isPending: false }),
    }));

    const { MeetingTypesTab: LoadingTab } = await import(
      '@/app/(dashboard)/calendar/meeting-types-tab'
    );
    render(<LoadingTab />);

    expect(
      screen.getByRole('status', { name: 'Loading meeting types' })
    ).toBeInTheDocument();
    vi.doUnmock('@/app/(dashboard)/calendar/use-meeting-types');
  });
});
