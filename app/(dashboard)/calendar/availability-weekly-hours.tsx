'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { AvailabilityDayRow } from './availability-day-row';
import {
  MON_FIRST_ORDER,
  WEEKDAY_NAMES,
  clearWeek,
  copyMondayToWeekdays,
  formatHours,
  isEnabled,
  setDayEnabled,
  setDayWindows,
  weekMinutes,
  windowsFor,
  type WeekState,
} from './availability-utils';

/**
 * Props for the weekly-hours card.
 */
export interface AvailabilityWeeklyHoursProps {
  /** Current (unsaved) weekly schedule. */
  week: WeekState;
  /** Replace the weekly schedule. */
  onWeekChange: (week: WeekState) => void;
  /** The MC's IANA timezone, shown in the footer note. */
  timezone: string;
}

/**
 * The weekly schedule: seven day rows with bulk actions above and the
 * bookable total below.
 *
 * Owns no state of its own. Every edit is applied through the pure
 * transforms in `availability-utils`, so the tab can diff the result
 * against the saved snapshot for the Save / Discard bar.
 */
export function AvailabilityWeeklyHours({
  week,
  onWeekChange,
  timezone,
}: AvailabilityWeeklyHoursProps) {
  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-section font-semibold">Weekly hours</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            onClick={() => onWeekChange(copyMondayToWeekdays(week))}
          >
            Copy Monday to weekdays
          </Button>
          <Button variant="ghost" onClick={() => onWeekChange(clearWeek(week))}>
            Clear week
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {MON_FIRST_ORDER.map((weekday) => (
          <AvailabilityDayRow
            key={weekday}
            dayName={WEEKDAY_NAMES[weekday]}
            enabled={isEnabled(week, weekday)}
            onEnabledChange={(enabled) =>
              onWeekChange(setDayEnabled(week, weekday, enabled))
            }
            windows={windowsFor(week, weekday)}
            onWindowsChange={(windows) =>
              onWeekChange(setDayWindows(week, weekday, windows))
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
        <p className="text-body text-text-muted">
          Times are in {timezone}. Couples always see their own timezone.
        </p>
        <span className="text-body text-text-muted tabular-nums">
          {formatHours(weekMinutes(week))} bookable
        </span>
      </div>
    </Card>
  );
}
