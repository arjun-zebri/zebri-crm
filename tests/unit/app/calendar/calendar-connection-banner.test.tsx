/**
 * Tests for the `/calendar` connection banner.
 *
 * The banner is the only place a never-connected MC learns that bookings are
 * not being checked against their real calendar, so the states that decide
 * whether it renders matter more than its markup. In particular "never
 * connected" and "connected but broken" must read differently: telling a
 * first-time MC their calendar "stopped working" is nonsense.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

import { CalendarConnectionBanner } from '@/app/(dashboard)/calendar/calendar-connection-banner';

const useCalendarConnections = vi.fn();

vi.mock('@/components/calendar/use-calendar-connections', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/calendar/use-calendar-connections')
  >('@/components/calendar/use-calendar-connections');
  return {
    ...actual,
    useCalendarConnections: () => useCalendarConnections(),
  };
});

/** Build the hook's return shape for a given set of connection states. */
function connectionState(overrides: Partial<ReturnType<typeof useCalendarConnections>> = {}) {
  return {
    connections: [],
    hasConnection: false,
    hasError: false,
    isLoading: false,
    ...overrides,
  };
}

describe('CalendarConnectionBanner', () => {
  beforeEach(() => {
    useCalendarConnections.mockReset();
  });

  it('renders nothing while the connection list is still loading', () => {
    useCalendarConnections.mockReturnValue(connectionState({ isLoading: true }));
    const { container } = render(<CalendarConnectionBanner />);
    // Why: a connected MC must not see the warning flash in on every visit.
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when a healthy connection exists', () => {
    useCalendarConnections.mockReturnValue(connectionState({ hasConnection: true }));
    const { container } = render(<CalendarConnectionBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('warns about clashes when no calendar has ever been connected', () => {
    useCalendarConnections.mockReturnValue(connectionState());
    render(<CalendarConnectionBanner />);
    expect(screen.getByText(/No calendar connected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outlook Calendar' })).toBeInTheDocument();
  });

  it('uses reconnect wording when a connection exists but has errored', () => {
    useCalendarConnections.mockReturnValue(connectionState({ hasError: true }));
    render(<CalendarConnectionBanner />);
    expect(screen.getByText(/stopped working/i)).toBeInTheDocument();
    expect(screen.queryByText(/No calendar connected/i)).not.toBeInTheDocument();
  });
});
