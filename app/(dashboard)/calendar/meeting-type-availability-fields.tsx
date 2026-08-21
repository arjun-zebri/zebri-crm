'use client';

import { Toggle } from '@/components/ui/toggle';

import { AvailabilityDayRow } from './availability-day-row';
import {
  MON_FIRST_ORDER,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT_NAMES,
  formatHours,
  isEnabled,
  setDayEnabled,
  setDayWindows,
  weekMinutes,
  windowsFor,
  type WeekState,
} from './availability-utils';

/**
 * Props for the per-meeting-type availability section.
 */
export interface MeetingTypeAvailabilityFieldsProps {
  /** True when this type runs on its own hours instead of the standard ones. */
  custom: boolean;
  /** Switch between standard and custom hours. */
  setCustom: (custom: boolean) => void;
  /** The type's own weekly hours, edited only while `custom` is true. */
  week: WeekState;
  /** Replace the type's weekly hours. */
  setWeek: (week: WeekState) => void;
}

/**
 * "Use my standard hours" switch plus, when it is off, a compact weekly
 * grid for this meeting type alone.
 *
 * Custom hours REPLACE the MC's standard week for this type rather than
 * narrowing it, which is what makes "Saturdays only" or "weeknights after
 * six" expressible. The grid is seeded from the standard hours by the
 * modal, so flipping the switch starts from something real rather than an
 * empty week that would quietly make the type unbookable.
 *
 * Date overrides stay user-level and are not editable here.
 *
 * @module app/(dashboard)/calendar/meeting-type-availability-fields
 */
export function MeetingTypeAvailabilityFields({
  custom,
  setCustom,
  week,
  setWeek,
}: MeetingTypeAvailabilityFieldsProps) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <Toggle
        checked={!custom}
        onChange={(standard) => setCustom(!standard)}
        label="Use my standard hours"
        description={
          custom
            ? 'This type is bookable only during the hours below.'
            : 'This type follows the weekly hours on your Availability tab.'
        }
      />

      {custom && (
        <div className="rounded-control border border-border">
          <div className="divide-y divide-border">
            {MON_FIRST_ORDER.map((weekday) => (
              <AvailabilityDayRow
                key={weekday}
                compact
                dayName={WEEKDAY_NAMES[weekday]}
                displayName={WEEKDAY_SHORT_NAMES[weekday]}
                enabled={isEnabled(week, weekday)}
                onEnabledChange={(enabled) =>
                  setWeek(setDayEnabled(week, weekday, enabled))
                }
                windows={windowsFor(week, weekday)}
                onWindowsChange={(windows) =>
                  setWeek(setDayWindows(week, weekday, windows))
                }
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
            <p className="text-body text-text-muted">
              Date overrides still apply.
            </p>
            <span className="text-body text-text-muted tabular-nums">
              {formatHours(weekMinutes(week))} bookable
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
