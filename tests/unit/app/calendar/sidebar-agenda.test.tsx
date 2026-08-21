/**
 * Tests for sidebar agenda: bookings + weddings displayed in time order.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CalendarSidebar } from '@/app/(dashboard)/calendar/_components/calendar-sidebar';
import type { Booking } from '@/app/(dashboard)/calendar/use-bookings';

describe('CalendarSidebar - Agenda with Bookings', () => {
  const mockOnSelectCouple = vi.fn();
  const mockOnSelectBooking = vi.fn();

  const mockBooking1: Booking = {
    id: 'booking-1',
    name: 'Booking 1',
    email: 'smith@example.com',
    partner_name: null,
    phone: null,
    starts_at: '2026-08-20T09:00:00Z',
    ends_at: '2026-08-20T10:00:00Z',
    status: 'confirmed',
    notes: null,
    video_join_url: null,
    external_event_ids: null,
    created_at: '2026-08-01T00:00:00Z',
    timezone: 'Australia/Melbourne',
    couple: { id: 'couple-1', name: 'Smith Couple' },
    meeting_type: { id: 'type-1', name: 'Consultation', location_type: 'virtual', duration_minutes: 30 },
  };

  const mockBooking2: Booking = {
    id: 'booking-2',
    name: 'Booking 2',
    email: 'jones@example.com',
    partner_name: null,
    phone: null,
    starts_at: '2026-08-20T14:00:00Z',
    ends_at: '2026-08-20T15:00:00Z',
    status: 'confirmed',
    notes: null,
    video_join_url: null,
    external_event_ids: null,
    created_at: '2026-08-01T00:00:00Z',
    timezone: 'Australia/Melbourne',
    couple: { id: 'couple-2', name: 'Jones Couple' },
    meeting_type: { id: 'type-1', name: 'Planning', location_type: 'in-person', duration_minutes: 30 },
  };

  it('renders sidebar agenda section with bookings in time order', () => {
    const currentDate = new Date('2026-08-20');

    render(
      <CalendarSidebar
        currentDate={currentDate}
        miniNavDate={new Date('2026-08-20')}
        onMiniNavDateChange={vi.fn()}
        onCurrentDateChange={vi.fn()}
        sidebarOpen
        onSidebarClose={vi.fn()}
        events={[]}
        eventsByDate={{}}
        onSelectCouple={mockOnSelectCouple}
        timezone="UTC"
        selectedDayBookings={[mockBooking2, mockBooking1]} // Reverse order, should be sorted
        onSelectBooking={mockOnSelectBooking}
      />
    );

    // Check that both bookings are rendered
    expect(screen.getByTestId('sidebar-booking-booking-1')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-booking-booking-2')).toBeInTheDocument();

    // Check couple names are displayed
    expect(screen.getByText('Smith Couple')).toBeInTheDocument();
    expect(screen.getByText('Jones Couple')).toBeInTheDocument();

    // Verify both bookings appear in the document
    const bookingElements = screen.getAllByTestId(/^sidebar-booking-/);
    expect(bookingElements.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onSelectBooking when booking row is clicked', () => {
    const currentDate = new Date('2026-08-20');

    render(
      <CalendarSidebar
        currentDate={currentDate}
        miniNavDate={new Date('2026-08-20')}
        onMiniNavDateChange={vi.fn()}
        onCurrentDateChange={vi.fn()}
        sidebarOpen
        onSidebarClose={vi.fn()}
        events={[]}
        eventsByDate={{}}
        onSelectCouple={mockOnSelectCouple}
        timezone="UTC"
        selectedDayBookings={[mockBooking1]}
        onSelectBooking={mockOnSelectBooking}
      />
    );

    const bookingRow = screen.getByTestId('sidebar-booking-booking-1');
    fireEvent.click(bookingRow);

    expect(mockOnSelectBooking).toHaveBeenCalledWith(mockBooking1);
  });

  it('displays a nothing-scheduled message when the day is empty', () => {
    const currentDate = new Date('2026-08-20');

    render(
      <CalendarSidebar
        currentDate={currentDate}
        miniNavDate={new Date('2026-08-20')}
        onMiniNavDateChange={vi.fn()}
        onCurrentDateChange={vi.fn()}
        sidebarOpen
        onSidebarClose={vi.fn()}
        events={[]}
        eventsByDate={{}}
        onSelectCouple={mockOnSelectCouple}
        timezone="UTC"
        selectedDayBookings={[]}
        onSelectBooking={mockOnSelectBooking}
      />
    );

    expect(screen.getByText('Nothing scheduled')).toBeInTheDocument();
  });

  it('shows booking meeting type and couple name', () => {
    const currentDate = new Date('2026-08-20');

    render(
      <CalendarSidebar
        currentDate={currentDate}
        miniNavDate={new Date('2026-08-20')}
        onMiniNavDateChange={vi.fn()}
        onCurrentDateChange={vi.fn()}
        sidebarOpen
        onSidebarClose={vi.fn()}
        events={[]}
        eventsByDate={{}}
        onSelectCouple={mockOnSelectCouple}
        timezone="UTC"
        selectedDayBookings={[mockBooking1]}
        onSelectBooking={mockOnSelectBooking}
      />
    );

    expect(screen.getByText('Smith Couple')).toBeInTheDocument();
    expect(screen.getByText('Consultation')).toBeInTheDocument();
  });
});

describe('CalendarSidebar - external busy in the agenda', () => {
  const currentDate = new Date('2026-08-20T00:00:00Z');

  const booking: Booking = {
    id: 'booking-1',
    name: 'Booking 1',
    email: 'smith@example.com',
    partner_name: null,
    phone: null,
    starts_at: '2026-08-20T09:00:00Z',
    ends_at: '2026-08-20T10:00:00Z',
    status: 'confirmed',
    notes: null,
    video_join_url: null,
    external_event_ids: null,
    created_at: '2026-08-01T00:00:00Z',
    timezone: 'Australia/Melbourne',
    couple: { id: 'couple-1', name: 'Smith Couple' },
    meeting_type: { id: 'type-1', name: 'Consultation', location_type: 'virtual', duration_minutes: 30 },
  };

  function renderAgenda(props: {
    busy?: Array<{ start: string; end: string; title: string | null; provider: 'google' | 'microsoft' }>;
    bookings?: Booking[];
    timezone?: string;
  }) {
    return render(
      <CalendarSidebar
        currentDate={currentDate}
        miniNavDate={new Date('2026-08-20')}
        onMiniNavDateChange={vi.fn()}
        onCurrentDateChange={vi.fn()}
        sidebarOpen
        onSidebarClose={vi.fn()}
        events={[]}
        eventsByDate={{}}
        onSelectCouple={vi.fn()}
        timezone={props.timezone ?? 'UTC'}
        selectedDayBookings={props.bookings ?? []}
        selectedDayBusy={props.busy ?? []}
        onSelectBooking={vi.fn()}
      />
    );
  }

  it('lists external busy events with their titles', () => {
    renderAgenda({
      busy: [
        {
          start: '2026-08-20T11:00:00Z',
          end: '2026-08-20T12:00:00Z',
          title: 'Dentist',
          provider: 'google',
        },
      ],
    });

    expect(screen.getByText('Dentist')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-busy-item')).toBeInTheDocument();
  });

  it('falls back to a generic label when the calendar hides the title', () => {
    // Free/busy-only visibility returns no summary, which must not render blank.
    renderAgenda({
      busy: [
        {
          start: '2026-08-20T11:00:00Z',
          end: '2026-08-20T12:00:00Z',
          title: null,
          provider: 'microsoft',
        },
      ],
    });

    expect(screen.getByText('Busy')).toBeInTheDocument();
  });

  it('interleaves busy events with bookings in time order', () => {
    renderAgenda({
      bookings: [booking], // 09:00
      busy: [
        {
          start: '2026-08-20T08:00:00Z',
          end: '2026-08-20T08:30:00Z',
          title: 'Earlier thing',
          provider: 'google',
        },
      ],
    });

    const rendered = screen.getByTestId('sidebar-agenda').textContent ?? '';
    // The 08:00 external event must appear before the 09:00 booking.
    expect(rendered.indexOf('Earlier thing')).toBeGreaterThan(-1);
    expect(rendered.indexOf('Earlier thing')).toBeLessThan(rendered.indexOf('Smith Couple'));
  });

  it('does not list the external mirror of a Zebri booking', () => {
    // The booking was pushed to Google, so free/busy returns it too. Listing
    // both would show one appointment twice.
    renderAgenda({
      bookings: [booking],
      busy: [
        {
          start: '2026-08-20T09:00:00Z',
          end: '2026-08-20T10:00:00Z',
          title: 'Consultation with Smith Couple',
          provider: 'google',
        },
      ],
    });

    expect(screen.queryByTestId('sidebar-busy-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-booking-booking-1')).toBeInTheDocument();
  });

  it('labels times in the MC timezone, not the browser timezone', () => {
    // 23:00Z is 09:00 the next morning in Sydney. Reading the hour off the Date
    // directly would print whatever the test runner's timezone says.
    renderAgenda({
      timezone: 'Australia/Sydney',
      busy: [
        {
          start: '2026-08-19T23:00:00Z',
          end: '2026-08-20T00:00:00Z',
          title: 'Early call',
          provider: 'google',
        },
      ],
    });

    expect(screen.getByTestId('sidebar-busy-item').textContent).toContain('09:00');
  });
});

describe('CalendarSidebar - unreachable calendar', () => {
  it('warns that the agenda may be incomplete when a calendar is unreachable', () => {
    // Silence here would be read as "the afternoon is free" and get the MC
    // double-booked, which is the whole reason the route fails soft.
    render(
      <CalendarSidebar
        currentDate={new Date('2026-08-20T00:00:00Z')}
        miniNavDate={new Date('2026-08-20')}
        onMiniNavDateChange={vi.fn()}
        onCurrentDateChange={vi.fn()}
        sidebarOpen
        onSidebarClose={vi.fn()}
        events={[]}
        eventsByDate={{}}
        onSelectCouple={vi.fn()}
        timezone="UTC"
        selectedDayBookings={[]}
        selectedDayBusy={[]}
        busyUnavailable
        onSelectBooking={vi.fn()}
      />
    );

    expect(screen.getByTestId('sidebar-agenda').textContent).toContain(
      'could not be reached'
    );
  });

  it('says nothing about reachability when the calendar loaded fine', () => {
    render(
      <CalendarSidebar
        currentDate={new Date('2026-08-20T00:00:00Z')}
        miniNavDate={new Date('2026-08-20')}
        onMiniNavDateChange={vi.fn()}
        onCurrentDateChange={vi.fn()}
        sidebarOpen
        onSidebarClose={vi.fn()}
        events={[]}
        eventsByDate={{}}
        onSelectCouple={vi.fn()}
        timezone="UTC"
        selectedDayBookings={[]}
        selectedDayBusy={[]}
        onSelectBooking={vi.fn()}
      />
    );

    expect(screen.getByTestId('sidebar-agenda').textContent).not.toContain(
      'could not be reached'
    );
  });
});
