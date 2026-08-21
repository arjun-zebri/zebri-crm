/**
 * Shaded background bands for the MC's bookable availability windows.
 *
 * Renders semi-transparent bands behind the grid to show when the MC is
 * available to take bookings on the selected weekday. Each band represents
 * one availability window (e.g., 09:00-12:00). Overrides (blocks or custom
 * windows for this specific date) take precedence over the base rule for
 * that weekday.
 *
 * @module app/(dashboard)/calendar/_components/grid-availability-bands
 */
import { bandGeometry, type GridConfig } from '@/lib/calendar/grid-layout';
import { zonedDateParts, zonedTimeToUtc } from '@/lib/scheduling/timezone';
import type { Database } from '@/types/database';

type AvailabilityRule = Database['public']['Tables']['availability_rules']['Row'];
type AvailabilityOverride = Database['public']['Tables']['availability_overrides']['Row'];

/**
 * Props for GridAvailabilityBands.
 */
export interface GridAvailabilityBandsProps {
  /** Rules for this weekday (may be multiple windows per day). */
  rulesForWeekday: AvailabilityRule[];
  /** Overrides for this specific date (blocks or custom windows). */
  overridesForDate: AvailabilityOverride[];
  /** The date being displayed (used to extract the date for override lookup). */
  date: Date;
  /** The start of the day in the MC's timezone. */
  dayStart: Date;
  /** Grid configuration. */
  gridConfig: GridConfig;
  /** MC's timezone (IANA string). */
  timezone: string;
}

/**
 * Shaded background bands for availability windows.
 *
 * If the date has an override:
 *   - Block (available: false) => no bands rendered for this date.
 *   - Custom window (available: true) => single band for the custom window.
 * Otherwise:
 *   - Render all rules for this weekday as bands.
 *
 * @param props - GridAvailabilityBandsProps
 * @returns JSX element
 */
export function GridAvailabilityBands({
  rulesForWeekday,
  overridesForDate,
  date,
  dayStart,
  gridConfig,
  timezone,
}: GridAvailabilityBandsProps) {
  // Find override for this date (if any)
  const dateStr = date.toISOString().split('T')[0];
  const override = overridesForDate.find((o) => o.date === dateStr);

  // Determine which windows to render
  let windows: Array<{ start_time: string; end_time: string }> = [];
  if (override) {
    if (override.available && override.start_time && override.end_time) {
      // Custom window override
      windows = [{ start_time: override.start_time, end_time: override.end_time }];
    }
    // If available: false (block), windows remains empty
  } else {
    // No override; use the weekday rules
    windows = rulesForWeekday.map((rule) => ({
      start_time: rule.start_time,
      end_time: rule.end_time,
    }));
  }

  // Convert each window to grid geometry and render as a band
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {windows.map((window, idx) => {
        // A rule's HH:MM is wall-clock in the MC's zone. Resolve it with the same
        // DST-correct helpers as getLocalDayStart, rather than setting UTC hours on
        // an instant that is only midnight in that zone.
        // Postgres returns HH:MM:SS; slice to HH:mm for the helpers.
        const startTime = window.start_time.slice(0, 5);
        const endTime = window.end_time.slice(0, 5);

        const { date: localDate } = zonedDateParts(dayStart, timezone);
        const start = zonedTimeToUtc(localDate, startTime, timezone);
        const end = zonedTimeToUtc(localDate, endTime, timezone);

        const geometry = bandGeometry(
          {
            start: start.toISOString(),
            end: end.toISOString(),
          },
          dayStart,
          gridConfig,
        );

        if (!geometry) return null;

        return (
          <div
            key={idx}
            className="absolute bg-surface-emphasis opacity-20"
            style={{
              top: `${geometry.topPx}px`,
              height: `${geometry.heightPx}px`,
              left: '0',
              right: '0',
            }}
            data-testid="grid-availability-band"
          />
        );
      })}
    </div>
  );
}
