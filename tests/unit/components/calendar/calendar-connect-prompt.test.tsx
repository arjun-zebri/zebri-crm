/**
 * Tests for the shared calendar connect affordances.
 *
 * The connect URL is the part that matters: dropping `purpose=calendar` would
 * store the tokens as a mailbox credential instead of a calendar connection,
 * and dropping `return` would strand the MC in Settings after connecting from
 * `/calendar`.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

import {
  CalendarConnectButtons,
  CalendarConnectNote,
} from '@/components/calendar/calendar-connect-prompt';
import { calendarConnectUrl } from '@/components/calendar/connect-url';

const assign = vi.fn();

beforeEach(() => {
  assign.mockReset();
  vi.stubGlobal('location', { assign });
});

describe('calendarConnectUrl', () => {
  it('carries the calendar purpose and the return destination', () => {
    expect(calendarConnectUrl('google', 'calendar')).toBe(
      '/api/oauth/authorize?provider=google&purpose=calendar&return=calendar',
    );
    expect(calendarConnectUrl('microsoft', 'settings')).toBe(
      '/api/oauth/authorize?provider=microsoft&purpose=calendar&return=settings',
    );
  });
});

describe('CalendarConnectButtons', () => {
  it('offers both providers', () => {
    render(<CalendarConnectButtons returnTo="calendar" />);
    expect(screen.getByRole('button', { name: 'Google Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outlook Calendar' })).toBeInTheDocument();
  });

  it('navigates to the authorize route with the caller-supplied return', async () => {
    const user = userEvent.setup();
    render(<CalendarConnectButtons returnTo="calendar" />);

    await user.click(screen.getByRole('button', { name: 'Google Calendar' }));

    // A full page load, not a router push: the authorize route sets httpOnly
    // cookies and 302s cross-origin, which a client transition cannot follow.
    expect(assign).toHaveBeenCalledWith(
      '/api/oauth/authorize?provider=google&purpose=calendar&return=calendar',
    );
  });
});

describe('CalendarConnectNote', () => {
  it('states the caller-supplied consequence', () => {
    render(<CalendarConnectNote message="Only Zebri bookings are shown here." />);
    expect(screen.getByRole('status')).toHaveTextContent('Only Zebri bookings are shown here.');
  });

  it('carries no connect buttons of its own', () => {
    render(<CalendarConnectNote message="Only Zebri bookings are shown here." />);
    // Why: every call site sits under the route banner, which already offers
    // both providers. Repeating them here put two identical button rows on
    // screen a few pixels apart.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
