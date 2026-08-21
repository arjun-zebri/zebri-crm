'use client';

import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TimeSelect } from '@/components/ui/time-select';
import { Toggle } from '@/components/ui/toggle';

import {
  DEFAULT_WINDOW,
  formatHours,
  windowsMinutes,
  type TimeWindow,
} from './availability-utils';

export type { TimeWindow };

/**
 * Props for a single weekday row in the availability editor.
 */
export interface AvailabilityDayRowProps {
  /** Display name (Monday, Tuesday, …). Also names the day's switch. */
  dayName: string;
  /**
   * Shorter label to show instead of `dayName`, for rows too narrow to
   * fit "Wednesday". The switch keeps the full name for screen readers.
   */
  displayName?: string;
  /** Whether this day is bookable. */
  enabled: boolean;
  /** Change handler for the day's on/off switch. */
  onEnabledChange: (enabled: boolean) => void;
  /** Windows for this day. */
  windows: TimeWindow[];
  /** Replace every window for this day. */
  onWindowsChange: (windows: TimeWindow[]) => void;
  /**
   * Narrow layout for the meeting-type modal: shorter day column, tighter
   * time selects, and no per-day hours total (the section footer carries
   * the weekly one). The full-width row does not fit a 512px modal.
   */
  compact?: boolean;
}

/**
 * One weekday row: switch, day name, its time windows, the day's total
 * hours, and the add-window button.
 *
 * A day that is switched off keeps its windows in state (see
 * `setDayEnabled`) but renders as "Unavailable" and contributes no
 * rules on save.
 */
export function AvailabilityDayRow({
  dayName,
  displayName,
  enabled,
  onEnabledChange,
  windows,
  onWindowsChange,
  compact = false,
}: AvailabilityDayRowProps) {
  const handleAddWindow = () => {
    onWindowsChange([...windows, { ...DEFAULT_WINDOW }]);
  };

  const handleRemoveWindow = (index: number) => {
    onWindowsChange(windows.filter((_, i) => i !== index));
  };

  const handleWindowChange = (
    index: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    const updated = [...windows];
    // Both ends are always written back so the window stays complete.
    const current = updated[index]!;
    updated[index] = {
      start: field === 'start' ? value : current.start,
      end: field === 'end' ? value : current.end,
    };
    onWindowsChange(updated);
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div
        className={`flex min-h-8 items-center gap-3 sm:shrink-0 ${
          compact ? 'sm:w-24' : 'sm:w-40'
        }`}
      >
        <Toggle
          checked={enabled}
          onChange={onEnabledChange}
          ariaLabel={`Enable ${dayName}`}
        />
        <span className={`text-body ${enabled ? 'text-text' : 'text-text-subtle'}`}>
          {displayName ?? dayName}
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {enabled ? (
          windows.map((window, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className={`shrink-0 ${compact ? 'w-28' : 'w-32'}`}>
                <TimeSelect
                  value={window.start}
                  onChange={(value) => handleWindowChange(idx, 'start', value)}
                  placeholder="Start"
                />
              </div>
              <span className="text-body text-text-muted">to</span>
              <div className={`shrink-0 ${compact ? 'w-28' : 'w-32'}`}>
                <TimeSelect
                  value={window.end}
                  onChange={(value) => handleWindowChange(idx, 'end', value)}
                  placeholder="End"
                />
              </div>
              {windows.length > 1 && (
                <Button
                  iconOnly
                  variant="ghost"
                  onClick={() => handleRemoveWindow(idx)}
                  aria-label={`Remove window ${idx + 1} for ${dayName}`}
                >
                  <X strokeWidth={1.5} className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))
        ) : (
          <span className="flex min-h-8 items-center text-body text-text-subtle">
            Unavailable
          </span>
        )}
      </div>

      <div
        className={`flex min-h-8 items-center justify-end gap-1 sm:shrink-0 ${
          compact ? 'sm:w-8' : 'sm:w-24'
        }`}
      >
        {!compact && (
          <span className="w-12 text-right text-body text-text-muted tabular-nums">
            {enabled ? formatHours(windowsMinutes(windows)) : ''}
          </span>
        )}
        {enabled && (
          <Button
            iconOnly
            variant="ghost"
            onClick={handleAddWindow}
            aria-label={`Add window for ${dayName}`}
          >
            <Plus strokeWidth={1.5} className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
