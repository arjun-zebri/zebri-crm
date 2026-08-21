import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

import { CouplesCalendar } from "@/app/(dashboard)/calendar/_components/couples-calendar";
import { createClient } from "@/lib/supabase/client";

// Mock supabase client as singleton
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

// The calendar also loads bookings and external busy events. Both are stubbed
// here so this characterisation stays about wedding events: the supabase mock
// below resolves by call order, so extra real queries would consume its
// responses and starve the events query of its data.
vi.mock("@/app/(dashboard)/calendar/use-bookings", () => ({
  useBookings: () => ({ data: [], isLoading: false, error: null }),
  useBookingsInRange: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock("@/app/(dashboard)/calendar/use-availability", () => ({
  useAvailability: () => ({
    data: { rules: [], overrides: [], timezone: "UTC" },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/app/(dashboard)/calendar/use-busy", () => ({
  useBusyRange: () => ({
    data: { busy: [], unavailable: false },
    isLoading: false,
    error: null,
  }),
}));

// Mock useCoupleStatuses
vi.mock("@/app/(dashboard)/couples/use-couple-statuses", () => ({
  useCoupleStatuses: () => ({
    data: [
      { id: "1", slug: "new", name: "New", color: "gray" },
      { id: "2", slug: "interested", name: "Interested", color: "blue" },
      { id: "3", slug: "booked", name: "Booked", color: "green" },
    ],
  }),
}));

describe("CouplesCalendar (characterisation test)", () => {
  let mockSupabase: any;
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "test-user-123" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };

    (createClient as any).mockReturnValue(mockSupabase);

    // The seeded events below sit on 2026-08-20, and the day/week views only
    // render what falls inside the current window. Without a pinned clock the
    // suite passed on the day it was written and failed from the next midnight.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-20T09:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("displays event in month view and calls onSelectCouple when clicked", async () => {
    // Arrange: seed an event with known date, couple name, and venue
    const seededEvent = {
      id: "event-123",
      user_id: "test-user-123",
      couple_id: "couple-456",
      date: "2026-08-20",
      status: "scheduled",
      created_at: "2026-08-01T00:00:00Z",
      venue: "Grand Hotel",
      timeline_notes: null,
      title: "Wedding Reception",
      couples: {
        id: "couple-456",
        name: "Smith & Jones",
        status: "booked",
      },
      event_contacts: [{ count: 2 }],
      tasks: [{ count: 3 }],
    };

    // Setup mock to return event data with proper chaining
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: [seededEvent], error: null }),
        }),
      }),
    });

    const onSelectCouple = vi.fn();

    // Act: render the calendar
    render(
      <QueryClientProvider client={queryClient}>
        <CouplesCalendar onSelectCouple={onSelectCouple} />
      </QueryClientProvider>
    );

    // Assert: event renders in the UI (month view)
    await waitFor(() => {
      const eventButtons = screen.queryAllByText("Smith & Jones – Wedding Reception");
      expect(eventButtons.length).toBeGreaterThan(0);
    });

    // Act: click on the first event button that appears (month view pill)
    const eventButtons = screen.getAllByText("Smith & Jones – Wedding Reception");
    if (eventButtons.length > 0) {
      fireEvent.click(eventButtons[0]!);
    }

    // Assert: onSelectCouple was called with correct couple id
    expect(onSelectCouple).toHaveBeenCalledWith("couple-456");
  });

  it("navigates main view when clicking a mini-calendar day (regression: sidebar must update currentDate)", async () => {
    // CRITICAL: This test catches the regression where sidebar mini-calendar clicks
    // only updated the mini month display but did not navigate the main view.
    // Arrange: event on August 15, initial calendar defaults to August 20
    const seededEvent = {
      id: "event-123",
      user_id: "test-user-123",
      couple_id: "couple-456",
      date: "2026-08-15",
      status: "scheduled",
      created_at: "2026-08-01T00:00:00Z",
      venue: "Grand Hotel",
      timeline_notes: null,
      title: "Wedding Reception",
      couples: {
        id: "couple-456",
        name: "Smith & Jones",
        status: "booked",
      },
      event_contacts: [{ count: 2 }],
      tasks: [{ count: 3 }],
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: [seededEvent], error: null }),
        }),
      }),
    });

    const onSelectCouple = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <CouplesCalendar onSelectCouple={onSelectCouple} />
      </QueryClientProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId("calendar-header")).toBeInTheDocument();
    });

    // Act: click on day 15 in the mini calendar sidebar
    // The mini calendar shows day numbers in buttons
    const miniCalendarButtons = screen.getAllByRole("button", { name: /^\d+$/ });
    const day15Button = miniCalendarButtons.find(
      (btn) => btn.textContent?.trim() === "15"
    );

    if (day15Button) {
      fireEvent.click(day15Button);
    }

    // Assert: the event for Aug 15 should now be visible in the sidebar timeline,
    // which only happens if currentDate was actually updated (proving onCurrentDateChange fired)
    await waitFor(() => {
      const events = screen.queryAllByText("Smith & Jones – Wedding Reception");
      expect(events.length).toBeGreaterThan(0);
    });
  });

  it("renders events in week view (verifies week view displays seeded event)", async () => {
    // Regression test for Task 6/7: week view must render events after grid rewrite.
    // Arrange: seed event for today (2026-08-20)
    const seededEvent = {
      id: "event-week",
      user_id: "test-user-123",
      couple_id: "couple-week",
      date: "2026-08-20",
      status: "scheduled",
      created_at: "2026-08-01T00:00:00Z",
      venue: "Week Venue",
      timeline_notes: null,
      title: "Week Event Title",
      couples: {
        id: "couple-week",
        name: "Week Couple",
        status: "booked",
      },
      event_contacts: [{ count: 1 }],
      tasks: [{ count: 1 }],
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: [seededEvent], error: null }),
        }),
      }),
    });

    const onSelectCouple = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <CouplesCalendar onSelectCouple={onSelectCouple} />
      </QueryClientProvider>
    );

    // Wait for event to render in default week view
    // Check for the full event label format: "Couple Name – Event Title"
    await waitFor(() => {
      const eventLabels = screen.queryAllByText("Week Couple – Week Event Title");
      expect(eventLabels.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it("renders events in day view (verifies day view displays seeded event)", async () => {
    // Regression test for Task 6/7: day view must render events after grid rewrite.
    // Arrange: seed event for today (2026-08-20)
    const seededEvent = {
      id: "event-day",
      user_id: "test-user-123",
      couple_id: "couple-day",
      date: "2026-08-20",
      status: "scheduled",
      created_at: "2026-08-01T00:00:00Z",
      venue: "Day Venue",
      timeline_notes: "Day timeline notes",
      title: "Day Event Title",
      couples: {
        id: "couple-day",
        name: "Day Couple",
        status: "booked",
      },
      event_contacts: [{ count: 2 }],
      tasks: [{ count: 1 }],
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: [seededEvent], error: null }),
        }),
      }),
    });

    const onSelectCouple = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <CouplesCalendar onSelectCouple={onSelectCouple} />
      </QueryClientProvider>
    );

    // Wait for event data to load (visible in sidebar timeline or main view)
    await waitFor(() => {
      const eventLabels = screen.queryAllByText("Day Couple – Day Event Title");
      expect(eventLabels.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  // The Statuses filter was dropped when this component was split into
  // per-view files: the dropdown disappeared from the header and
  // `filteredEvents` became a pass-through, so an MC could no longer narrow
  // the grid to the pipeline stages they were working.
  describe("status filter", () => {
    /** Two weddings for couples in different statuses, on the visible day. */
    const bookedEvent = {
      id: "event-booked",
      user_id: "test-user-123",
      couple_id: "couple-booked",
      date: "2026-08-20",
      status: "scheduled",
      created_at: "2026-08-01T00:00:00Z",
      venue: "Grand Hotel",
      timeline_notes: null,
      title: "Booked Wedding",
      couples: { id: "couple-booked", name: "Booked Couple", status: "booked" },
      event_contacts: [{ count: 0 }],
      tasks: [{ count: 0 }],
    };
    const interestedEvent = {
      ...bookedEvent,
      id: "event-interested",
      couple_id: "couple-interested",
      title: "Interested Wedding",
      couples: {
        id: "couple-interested",
        name: "Interested Couple",
        status: "interested",
      },
    };

    function renderWithBoth() {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi
              .fn()
              .mockResolvedValue({ data: [bookedEvent, interestedEvent], error: null }),
          }),
        }),
      });
      return render(
        <QueryClientProvider client={queryClient}>
          <CouplesCalendar onSelectCouple={vi.fn()} />
        </QueryClientProvider>
      );
    }

    it("offers a Statuses control in the header", async () => {
      renderWithBoth();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /statuses/i })).toBeInTheDocument();
      });
    });

    it("shows every wedding until a status is unticked", async () => {
      renderWithBoth();
      await waitFor(() => {
        expect(
          screen.queryAllByText(/Booked Couple – Booked Wedding/).length,
        ).toBeGreaterThan(0);
      });
      expect(
        screen.queryAllByText(/Interested Couple – Interested Wedding/).length,
      ).toBeGreaterThan(0);
    });

    it("hides weddings whose couple status has been unticked", async () => {
      renderWithBoth();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /statuses/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /statuses/i }));
      fireEvent.click(await screen.findByRole("checkbox", { name: "Interested" }));

      await waitFor(() => {
        expect(
          screen.queryAllByText(/Interested Couple – Interested Wedding/),
        ).toHaveLength(0);
      });
      // Unticking one status leaves the others on, rather than collapsing to
      // a single-status filter.
      expect(
        screen.queryAllByText(/Booked Couple – Booked Wedding/).length,
      ).toBeGreaterThan(0);
    });
  });
});
