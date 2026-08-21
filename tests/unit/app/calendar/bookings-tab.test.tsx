/**
 * Bookings tab tests.
 *
 * Covers the Upcoming / Past / Cancelled slices, day grouping in the MC's
 * timezone, search, row selection, and the per-filter empty states.
 *
 * @module tests/unit/app/calendar/bookings-tab
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { BookingsTab } from '@/app/(dashboard)/calendar/bookings-tab';
import * as availabilityModule from '@/app/(dashboard)/calendar/use-availability';
import type { Booking } from '@/app/(dashboard)/calendar/use-bookings';
import * as bookingsModule from '@/app/(dashboard)/calendar/use-bookings';

const mockOnSelectBooking = vi.fn();

// Fixed "now": 2026-08-20 15:00:00 UTC, which is 21 Aug 01:00 in Sydney.
const NOW = new Date('2026-08-20T15:00:00Z');

const baseBooking: Booking = {
  id: '1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  partner_name: null,
  phone: '0412345678',
  starts_at: '2026-08-20T16:00:00Z',
  ends_at: '2026-08-20T17:00:00Z',
  status: 'confirmed',
  notes: null,
  video_join_url: null,
  external_event_ids: null,
  created_at: '2026-08-18T02:00:00Z',
  timezone: 'Australia/Sydney',
  couple: { id: 'c1', name: 'Alice & Bob' },
  meeting_type: { id: 'm1', name: 'Consultation', location_type: 'video', duration_minutes: 60 },
};

/** Starts an hour after NOW. */
const upcomingBooking = baseBooking;

/** Ended an hour before NOW. */
const pastBooking: Booking = {
  ...baseBooking,
  id: '2',
  name: 'Charlie Brown',
  starts_at: '2026-08-20T13:00:00Z',
  ends_at: '2026-08-20T14:00:00Z',
  couple: null,
  meeting_type: { id: 'm2', name: 'Planning', location_type: 'in_person', duration_minutes: 45 },
};

/** In the future, but called off. */
const cancelledBooking: Booking = {
  ...baseBooking,
  id: '3',
  name: 'Dana Lee',
  starts_at: '2026-08-20T17:00:00Z',
  ends_at: '2026-08-20T18:00:00Z',
  status: 'cancelled',
  couple: null,
  meeting_type: { id: 'm3', name: 'Follow-up', location_type: 'phone', duration_minutes: 15 },
};

vi.mock('@/app/(dashboard)/calendar/use-bookings');
vi.mock('@/app/(dashboard)/calendar/use-availability');

class MockDate extends Date {
  constructor(args?: string | number | Date) {
    if (args === undefined) {
      super(NOW.getTime());
    } else {
      super(args as string);
    }
  }

  static override now() {
    return NOW.getTime();
  }
}

/** Point both `useBookings` and `useAvailability` at fixed data. */
function mockData(bookings: Booking[] | null, timezone: string | null = 'Australia/Sydney') {
  vi.mocked(bookingsModule.useBookings).mockReturnValue({
    data: bookings,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof bookingsModule.useBookings>);
  vi.mocked(availabilityModule.useAvailability).mockReturnValue({
    data: timezone ? { timezone } : null,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof availabilityModule.useAvailability>);
}

describe('BookingsTab', () => {
  let savedDate: DateConstructor;

  beforeEach(() => {
    vi.clearAllMocks();
    savedDate = global.Date;
    global.Date = MockDate as unknown as DateConstructor;
  });

  afterEach(() => {
    global.Date = savedDate;
  });

  it('opens on Upcoming and counts every slice', () => {
    mockData([upcomingBooking, pastBooking, cancelledBooking]);

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);

    const upcomingTab = screen.getByRole('tab', { name: /Upcoming/ });
    expect(upcomingTab).toHaveAttribute('aria-selected', 'true');
    expect(within(upcomingTab).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /Past/ })).getByText('1')).toBeInTheDocument();
    expect(
      within(screen.getByRole('tab', { name: /Cancelled/ })).getByText('1'),
    ).toBeInTheDocument();

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
    expect(screen.queryByText('Dana Lee')).not.toBeInTheDocument();
  });

  it('keeps a cancelled future booking out of Upcoming and in Cancelled', async () => {
    mockData([upcomingBooking, cancelledBooking]);
    const user = userEvent.setup();

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);
    expect(screen.queryByText('Dana Lee')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Cancelled/ }));

    expect(screen.getByText('Dana Lee')).toBeInTheDocument();
    expect(screen.getByText('Cancelled', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
  });

  it('moves a finished booking into Past', async () => {
    mockData([pastBooking]);
    const user = userEvent.setup();

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);
    expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Past/ }));

    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('groups rows under a day heading in the MC timezone', () => {
    // 2026-08-20T16:00Z is 2am on 21 Aug in Sydney, which is "today" there.
    mockData([upcomingBooking]);

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);

    expect(screen.getByText('Today · Fri 21 Aug')).toBeInTheDocument();
    expect(screen.getByText('1 booking')).toBeInTheDocument();
    expect(screen.getByText('2:00am')).toBeInTheDocument();
  });

  it('describes the meeting type, length and location on the row', () => {
    mockData([upcomingBooking]);

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);

    expect(screen.getByText('Consultation · 60 min · video call')).toBeInTheDocument();
    expect(screen.getByText('Couple: Alice & Bob')).toBeInTheDocument();
  });

  it('labels a booking with no couple as a new enquiry', async () => {
    mockData([pastBooking]);
    const user = userEvent.setup();

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);
    await user.click(screen.getByRole('tab', { name: /Past/ }));

    expect(screen.getByText('New enquiry')).toBeInTheDocument();
  });

  it('filters by booker name and by couple name', async () => {
    const other: Booking = { ...upcomingBooking, id: '9', name: 'Zara Quinn', couple: null };
    mockData([upcomingBooking, other]);
    const user = userEvent.setup();

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);
    const search = screen.getByRole('searchbox', { name: 'Search bookings' });

    await user.type(search, 'zara');
    expect(screen.getByText('Zara Quinn')).toBeInTheDocument();
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'alice & bob');
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByText('Zara Quinn')).not.toBeInTheDocument();
  });

  it('explains an empty search rather than showing the tab empty state', async () => {
    mockData([upcomingBooking]);
    const user = userEvent.setup();

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);
    await user.type(screen.getByRole('searchbox', { name: 'Search bookings' }), 'nobody');

    expect(screen.getByText('No bookings match that search')).toBeInTheDocument();
  });

  it('calls onSelectBooking when a row is clicked', async () => {
    mockData([upcomingBooking]);
    const user = userEvent.setup();

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);
    await user.click(screen.getByTestId('booking-row-1'));

    expect(mockOnSelectBooking).toHaveBeenCalledWith(upcomingBooking);
  });

  it('shows a per-filter empty state', async () => {
    mockData([]);
    const user = userEvent.setup();

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);
    expect(screen.getByText('Nothing booked yet')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Past/ }));
    expect(screen.getByText('No past bookings')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Cancelled/ }));
    expect(screen.getByText('No cancelled bookings')).toBeInTheDocument();
  });

  it('falls back to Sydney when the availability timezone is unavailable', () => {
    mockData([upcomingBooking], null);

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);

    expect(screen.getByText('2:00am')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    vi.mocked(bookingsModule.useBookings).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof bookingsModule.useBookings>);
    vi.mocked(availabilityModule.useAvailability).mockReturnValue({
      data: { timezone: 'Australia/Sydney' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof availabilityModule.useAvailability>);

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);

    expect(screen.getByRole('status', { name: 'Loading bookings' })).toBeInTheDocument();
  });

  it('renders error state', () => {
    vi.mocked(bookingsModule.useBookings).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load bookings'),
    } as unknown as ReturnType<typeof bookingsModule.useBookings>);
    vi.mocked(availabilityModule.useAvailability).mockReturnValue({
      data: { timezone: 'Australia/Sydney' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof availabilityModule.useAvailability>);

    render(<BookingsTab onSelectBooking={mockOnSelectBooking} />);

    expect(screen.getByText('Error loading bookings')).toBeInTheDocument();
  });
});
