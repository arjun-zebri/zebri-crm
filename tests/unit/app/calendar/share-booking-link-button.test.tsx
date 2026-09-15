/**
 * The header "Share booking link" button.
 *
 * It is the fastest way to hand a couple a link, so it must go quiet for the
 * same reason the per-type copy buttons do: no working calendar means the
 * public page refuses every link.
 *
 * @module tests/unit/app/calendar/share-booking-link-button
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

import { ShareBookingLinkButton } from '@/app/(dashboard)/calendar/share-booking-link-button';

const meetingTypes = vi.fn();
const connections = vi.fn();

vi.mock('@/app/(dashboard)/calendar/use-meeting-types', () => ({
  useMeetingTypes: () => ({ data: meetingTypes(), isLoading: false, error: null }),
}));

vi.mock('@/components/calendar/use-calendar-connections', () => ({
  CALENDAR_CONNECTIONS_KEY: ['calendar', 'connections'],
  CALENDAR_PROVIDERS: ['google', 'microsoft'],
  useCalendarConnections: () => connections(),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const ACTIVE_TYPE = { id: 'mt1', name: 'Consultation', active: true, share_token: 'tok' };

beforeEach(() => {
  meetingTypes.mockReset().mockReturnValue([ACTIVE_TYPE]);
  connections.mockReset().mockReturnValue({
    connections: [],
    hasConnection: false,
    hasError: false,
    isLoading: false,
  });
});

describe('ShareBookingLinkButton', () => {
  it('is disabled with a reason when no calendar is connected', () => {
    render(<ShareBookingLinkButton />);
    const button = screen.getByRole('button', { name: /share booking link/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', expect.stringMatching(/connect a calendar/i));
  });

  it('copies once a calendar is connected', () => {
    connections.mockReturnValue({
      connections: [{ provider: 'google', accountEmail: 'mc@test', status: 'connected' }],
      hasConnection: true,
      hasError: false,
      isLoading: false,
    });
    render(<ShareBookingLinkButton />);
    expect(screen.getByRole('button', { name: /share booking link/i })).toBeEnabled();
  });
});
