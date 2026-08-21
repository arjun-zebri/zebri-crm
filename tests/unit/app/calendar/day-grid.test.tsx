/**
 * Unit tests for day view grid components and visual layers.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { CalendarLegend } from '@/app/(dashboard)/calendar/_components/calendar-legend';
import { GridAvailabilityBands } from '@/app/(dashboard)/calendar/_components/grid-availability-bands';
import { GridCurrentTimeIndicator, type GridCurrentTimeIndicatorProps } from '@/app/(dashboard)/calendar/_components/grid-current-time-indicator';
import { getLocalDayStart } from '@/lib/calendar/timezone';

describe('CalendarLegend', () => {
  it('renders all three layer swatches with correct labels', () => {
    render(<CalendarLegend />);

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Busy elsewhere')).toBeInTheDocument();
    expect(screen.getByText('Booked')).toBeInTheDocument();
  });

  it('displays swatches as distinct visual elements', () => {
    const { container } = render(<CalendarLegend />);

    // Check for three swatch divs (each legend item has one)
    const swatches = container.querySelectorAll('[title]');
    expect(swatches).toHaveLength(3);

    const titles = Array.from(swatches).map((el) => el.getAttribute('title'));
    expect(titles).toContain('Available time');
    expect(titles).toContain('Busy on external calendar');
    expect(titles).toContain('Booked through Zebri');
  });
});

describe('GridCurrentTimeIndicator', () => {
  // The clock is pinned. These tests used to call `new Date()` and so depended
  // on when the suite happened to run: the indicator only draws inside the
  // grid's hours, so a run at 00:04 UTC against a 07:00-21:00 grid failed for
  // a correct component.
  const NOON_UTC = new Date('2026-08-21T12:00:00Z');

  const gridConfig = {
    startHour: 7,
    endHour: 21,
    pxPerMinute: 1.5,
    timeZone: 'UTC',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOON_UTC);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders only on today column (regression: should not appear on other days)', () => {
    const timezone = 'UTC';
    const today = getLocalDayStart(NOON_UTC, timezone);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const props: GridCurrentTimeIndicatorProps = {
      columnDate: tomorrow,
      dayStart: tomorrow,
      gridConfig,
      timezone,
    };

    const { container } = render(<GridCurrentTimeIndicator {...props} />);

    expect(
      container.querySelector('[data-testid="grid-current-time-indicator"]'),
    ).not.toBeInTheDocument();
  });

  it('renders indicator with the time badge on today column', () => {
    const timezone = 'UTC';
    const today = getLocalDayStart(NOON_UTC, timezone);

    const props: GridCurrentTimeIndicatorProps = {
      columnDate: today,
      dayStart: today,
      gridConfig,
      timezone,
    };

    const { container } = render(<GridCurrentTimeIndicator {...props} />);

    const indicator = container.querySelector('[data-testid="grid-current-time-indicator"]');
    expect(indicator).toBeInTheDocument();
    expect(indicator!.textContent).toContain('12:00');
  });

  it('positions the line from the grid start, not from midnight', () => {
    // 12:00 is 720 minutes into the day; the grid opens at 07:00, or 420.
    // (720 - 420) * 1.5 px per minute = 450px. Measuring from midnight put the
    // line seven hours too low.
    const timezone = 'UTC';
    const today = getLocalDayStart(NOON_UTC, timezone);

    const { container } = render(
      <GridCurrentTimeIndicator
        columnDate={today}
        dayStart={today}
        gridConfig={gridConfig}
        timezone={timezone}
      />,
    );

    const indicator = container.querySelector<HTMLElement>(
      '[data-testid="grid-current-time-indicator"]',
    );
    expect(indicator!.style.top).toBe('450px');
  });

  it('reads the badge in the MC timezone, not the browser timezone', () => {
    // 12:00Z is 22:00 in Sydney. A browser-local reading would print whatever
    // the runner's zone says instead.
    const timezone = 'Australia/Sydney';
    const today = getLocalDayStart(NOON_UTC, timezone);

    const { container } = render(
      <GridCurrentTimeIndicator
        columnDate={today}
        dayStart={today}
        gridConfig={{ ...gridConfig, endHour: 24, timeZone: timezone }}
        timezone={timezone}
      />,
    );

    const indicator = container.querySelector('[data-testid="grid-current-time-indicator"]');
    expect(indicator!.textContent).toContain('22:00');
  });

  it('does not render when the current time is outside the grid hours', () => {
    // 05:00 UTC is before the 07:00 grid start.
    vi.setSystemTime(new Date('2026-08-21T05:00:00Z'));
    const timezone = 'UTC';
    const today = getLocalDayStart(new Date('2026-08-21T05:00:00Z'), timezone);

    const { container } = render(
      <GridCurrentTimeIndicator
        columnDate={today}
        dayStart={today}
        gridConfig={gridConfig}
        timezone={timezone}
      />,
    );

    expect(
      container.querySelector('[data-testid="grid-current-time-indicator"]'),
    ).not.toBeInTheDocument();
  });
});

describe('GridAvailabilityBands', () => {
  // Sydney is UTC+10 in August, so local midnight on 2026-08-21 (a Friday)
  // is 2026-08-20T14:00:00Z. Override rows store the MC-local date string,
  // so the lookup must resolve the date in the MC timezone; reading the UTC
  // date from this instant lands on 2026-08-20 and misses the override.
  const timezone = 'Australia/Sydney';
  const sydneyMidnightAug21 = new Date('2026-08-20T14:00:00Z');
  const gridConfig = {
    startHour: 0,
    endHour: 24,
    pxPerMinute: 1,
    timeZone: timezone,
  };
  const fridayRule = {
    id: 'rule-1',
    user_id: 'user-1',
    weekday: 5,
    start_time: '09:00:00',
    end_time: '17:00:00',
    created_at: '2026-01-01T00:00:00Z',
  };

  it('applies a block override for the MC-local date, not the UTC date', () => {
    const { container } = render(
      <GridAvailabilityBands
        rulesForWeekday={[fridayRule]}
        overridesForDate={[
          {
            id: 'ovr-1',
            user_id: 'user-1',
            date: '2026-08-21',
            available: false,
            start_time: null,
            end_time: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ]}
        date={sydneyMidnightAug21}
        dayStart={sydneyMidnightAug21}
        gridConfig={gridConfig}
        timezone={timezone}
      />,
    );

    expect(
      container.querySelectorAll('[data-testid="grid-availability-band"]'),
    ).toHaveLength(0);
  });

  it('renders a custom-window override instead of the weekday rules', () => {
    const { container } = render(
      <GridAvailabilityBands
        rulesForWeekday={[fridayRule, { ...fridayRule, id: 'rule-2', start_time: '18:00:00', end_time: '20:00:00' }]}
        overridesForDate={[
          {
            id: 'ovr-1',
            user_id: 'user-1',
            date: '2026-08-21',
            available: true,
            start_time: '10:00:00',
            end_time: '12:00:00',
            created_at: '2026-01-01T00:00:00Z',
          },
        ]}
        date={sydneyMidnightAug21}
        dayStart={sydneyMidnightAug21}
        gridConfig={gridConfig}
        timezone={timezone}
      />,
    );

    // One band for the override window, not two for the weekday rules.
    expect(
      container.querySelectorAll('[data-testid="grid-availability-band"]'),
    ).toHaveLength(1);
  });
});
