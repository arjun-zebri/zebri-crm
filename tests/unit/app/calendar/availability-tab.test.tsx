/**
 * Unit tests for the availability tab.
 *
 * Covers the seven day rows, the dirty-gated Save changes / Discard
 * bar, the save payload shape, and the loading / error states.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AvailabilityTab } from '@/app/(dashboard)/calendar/availability-tab';

const mockUseAvailability = vi.fn();
const mockUseSaveAvailability = vi.fn();
const mockUseUpsertOverride = vi.fn();
const mockUseDeleteOverride = vi.fn();

vi.mock('@/app/(dashboard)/calendar/use-availability', () => ({
  useAvailability: () => mockUseAvailability(),
  useSaveAvailability: () => ({
    mutateAsync: mockUseSaveAvailability,
    isPending: false,
  }),
  useUpsertOverride: () => ({
    mutateAsync: mockUseUpsertOverride,
    isPending: false,
  }),
  useDeleteOverride: () => ({
    mutateAsync: mockUseDeleteOverride,
    isPending: false,
  }),
}));

/** Availability payload with the given rules, in New York. */
function availability(rules: { weekday: number; start_time: string; end_time: string }[]) {
  return {
    data: { rules, overrides: [], timezone: 'America/New_York' },
    isLoading: false,
    error: null,
  };
}

const MONDAY_9_TO_5 = [{ weekday: 1, start_time: '09:00', end_time: '17:00' }];

/** The save button, which is disabled until something changes. */
function saveButton() {
  return screen.getByRole('button', { name: /save changes/i });
}

describe('AvailabilityTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSaveAvailability.mockResolvedValue(undefined);
  });

  it('renders all seven days', () => {
    mockUseAvailability.mockReturnValue(availability([]));

    render(<AvailabilityTab />);

    for (const day of [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });

  it('renders one switch per day, on for days that have rules', () => {
    mockUseAvailability.mockReturnValue(availability(MONDAY_9_TO_5));

    render(<AvailabilityTab />);

    expect(screen.getAllByRole('switch')).toHaveLength(7);
    expect(screen.getByRole('switch', { name: 'Enable Monday' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Enable Sunday' })).not.toBeChecked();
  });

  it('shows the saved timezone on the picker button', () => {
    mockUseAvailability.mockReturnValue({
      data: { rules: [], overrides: [], timezone: 'Europe/London' },
      isLoading: false,
      error: null,
    });

    render(<AvailabilityTab />);

    expect(
      screen.getByRole('button', { name: /timezone: Europe\/London/i }),
    ).toBeInTheDocument();
  });

  it('opens a searchable timezone modal from that button', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(availability([]));

    render(<AvailabilityTab />);
    await user.click(screen.getByRole('button', { name: /timezone:/i }));

    expect(screen.getByRole('textbox', { name: /search timezones/i })).toBeInTheDocument();
  });

  it('keeps Save disabled until something changes, and offers Discard only then', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(availability(MONDAY_9_TO_5));

    render(<AvailabilityTab />);

    expect(saveButton()).toBeDisabled();
    expect(screen.queryByRole('button', { name: /discard/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Enable Sunday' }));

    expect(saveButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
  });

  it('reverts every edit when Discard is pressed', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(availability(MONDAY_9_TO_5));

    render(<AvailabilityTab />);
    await user.click(screen.getByRole('switch', { name: 'Enable Sunday' }));
    await user.click(screen.getByRole('button', { name: /discard/i }));

    expect(screen.getByRole('switch', { name: 'Enable Sunday' })).not.toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it('saves { rules, timezone } and settles back to a clean state', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(availability(MONDAY_9_TO_5));

    render(<AvailabilityTab />);
    await user.click(screen.getByRole('switch', { name: 'Enable Sunday' }));
    await user.click(saveButton());

    await waitFor(() => {
      expect(mockUseSaveAvailability).toHaveBeenCalled();
    });

    const payload = mockUseSaveAvailability.mock.calls[0]![0];
    expect(payload.timezone).toBe('America/New_York');
    expect(payload.rules).toEqual([
      { weekday: 1, start_time: '09:00', end_time: '17:00' },
      { weekday: 0, start_time: '09:00', end_time: '17:00' },
    ]);
    await waitFor(() => {
      expect(saveButton()).toBeDisabled();
    });
  });

  it('normalizes DB times (HH:MM:SS) to HH:mm on load and save', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(
      availability([{ weekday: 1, start_time: '09:00:00', end_time: '17:00:00' }]),
    );

    render(<AvailabilityTab />);
    await user.click(screen.getByRole('switch', { name: 'Enable Sunday' }));
    await user.click(saveButton());

    await waitFor(() => {
      expect(mockUseSaveAvailability).toHaveBeenCalled();
    });

    const payload = mockUseSaveAvailability.mock.calls[0]![0];
    expect(payload.rules[0]).toEqual({
      weekday: 1,
      start_time: '09:00',
      end_time: '17:00',
    });
  });

  it('drops a day switched off from the save payload', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(
      availability([
        { weekday: 1, start_time: '09:00', end_time: '17:00' },
        { weekday: 2, start_time: '09:00', end_time: '17:00' },
      ]),
    );

    render(<AvailabilityTab />);
    await user.click(screen.getByRole('switch', { name: 'Enable Monday' }));
    await user.click(saveButton());

    await waitFor(() => {
      expect(mockUseSaveAvailability).toHaveBeenCalled();
    });

    const payload = mockUseSaveAvailability.mock.calls[0]![0];
    expect(payload.rules).toEqual([
      { weekday: 2, start_time: '09:00', end_time: '17:00' },
    ]);
  });

  it('shows a day as unavailable, with no hours, once it is switched off', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(availability(MONDAY_9_TO_5));

    render(<AvailabilityTab />);
    expect(screen.getByText('8h')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Enable Monday' }));

    expect(screen.queryByText('8h')).not.toBeInTheDocument();
    expect(screen.getAllByText('Unavailable')).toHaveLength(7);
  });

  it('totals the bookable hours across enabled days', () => {
    mockUseAvailability.mockReturnValue(
      availability([
        { weekday: 1, start_time: '09:00', end_time: '17:00' },
        { weekday: 6, start_time: '08:00', end_time: '11:00' },
      ]),
    );

    render(<AvailabilityTab />);

    expect(screen.getByText('11h bookable')).toBeInTheDocument();
  });

  it('copies Monday across the weekdays', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(availability(MONDAY_9_TO_5));

    render(<AvailabilityTab />);
    await user.click(screen.getByRole('button', { name: /copy monday to weekdays/i }));

    expect(screen.getByRole('switch', { name: 'Enable Friday' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Enable Saturday' })).not.toBeChecked();
    expect(screen.getByText('40h bookable')).toBeInTheDocument();
  });

  it('clears the week without saving', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(availability(MONDAY_9_TO_5));

    render(<AvailabilityTab />);
    await user.click(screen.getByRole('button', { name: /clear week/i }));

    expect(screen.getByRole('switch', { name: 'Enable Monday' })).not.toBeChecked();
    expect(screen.getByText('0h bookable')).toBeInTheDocument();
    expect(mockUseSaveAvailability).not.toHaveBeenCalled();
  });

  it('adds a second window to a day', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(availability(MONDAY_9_TO_5));

    render(<AvailabilityTab />);
    await user.click(screen.getByRole('button', { name: /add window for monday/i }));

    expect(
      screen.getByRole('button', { name: /remove window 2 for monday/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('16h')).toBeInTheDocument();
  });

  it('opens the override modal from the action bar', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(availability([]));

    render(<AvailabilityTab />);
    await user.click(screen.getByRole('button', { name: /add an override/i }));

    expect(
      screen.getByRole('heading', { name: /add a date override/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^add override$/i })).toBeDisabled();
  });

  it('closes the override modal on cancel without saving', async () => {
    const user = userEvent.setup();
    mockUseAvailability.mockReturnValue(availability([]));

    render(<AvailabilityTab />);
    await user.click(screen.getByRole('button', { name: /add an override/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /add a date override/i }),
      ).not.toBeInTheDocument();
    });
    expect(mockUseUpsertOverride).not.toHaveBeenCalled();
  });

  it('renders loading state while availability is in flight', () => {
    mockUseAvailability.mockReturnValue({ data: null, isLoading: true, error: null });

    render(<AvailabilityTab />);

    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders an error state on failure', () => {
    mockUseAvailability.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
    });

    render(<AvailabilityTab />);

    expect(screen.getByText(/error loading availability/i)).toBeInTheDocument();
  });
});

describe('AvailabilityTab first paint', () => {
  it('shows the loaded week, not an empty one, on the paint the user sees', () => {
    // The week is seeded in an effect, so the frame before it runs has every
    // day switched off. Painting that frame made all seven switches animate
    // themselves on. The `seeded` gate holds it back; what is asserted here is
    // the observable consequence: the first render anyone can see already has
    // Monday on and the untouched days off, rather than a uniformly off week.
    mockUseAvailability.mockReturnValue({
      data: {
        rules: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
        overrides: [],
        timezone: 'Australia/Sydney',
      },
      isLoading: false,
      error: null,
    });

    const { container } = render(<AvailabilityTab />);

    const switches = Array.from(container.querySelectorAll('[role="switch"]'));
    expect(switches.length).toBeGreaterThan(0);
    const checked = switches.filter((el) => el.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
  });

  it('still surfaces a failure rather than a skeleton that never resolves', () => {
    // The seeding effect never runs when the query fails, so a gate placed
    // ahead of the error branch would strand the tab on a skeleton.
    mockUseAvailability.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
    });

    render(<AvailabilityTab />);

    expect(screen.getByText(/Error loading availability/i)).toBeInTheDocument();
  });
});
