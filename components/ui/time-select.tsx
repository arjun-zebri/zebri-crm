'use client';

import { useMemo } from 'react';

import { Select } from '@/components/ui/select';
import type { SelectOption } from '@/components/ui/select';

/**
 * Time picker for scheduling UIs.
 *
 * Generates time options from startHour to endHour in minuteStep increments.
 * Displays options in 12-hour format ("10:00 AM"), but values are 24-hour
 * ("10:00"). Used by availability editors and scheduling modals that need
 * predictable time choices without the complexity of a full datetime picker.
 *
 * @example
 * ```tsx
 * <TimeSelect
 *   value="14:30"
 *   onChange={(value) => setTime(value)}
 *   startHour={6}
 *   endHour={22}
 *   minuteStep={30}
 *   placeholder="Select time"
 * />
 * ```
 *
 * @module components/ui/time-select
 */

export interface TimeSelectProps {
  /** Controlled value in 24h format ("HH:mm"). */
  value?: string;
  /** Change callback, receives value in 24h format. */
  onChange: (value: string) => void;
  /** Minute interval between options (default: 30). */
  minuteStep?: number;
  /** Start hour (0-23, default: 6). */
  startHour?: number;
  /** End hour inclusive (0-23, default: 22). */
  endHour?: number;
  /** Placeholder when no value set. */
  placeholder?: string;
  /**
   * Greys the control and blocks interaction. Use it to keep a field in place
   * when it does not currently apply, rather than unmounting it and having the
   * surrounding layout jump.
   */
  disabled?: boolean;
}
/** Convert 24h "HH:mm" to 12h display ("10:00 AM"). */
function to12hFormat(time: string): string {
  // Format is HH:mm from generated options, so split always produces 2 elements.
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}
export function TimeSelect({
  value,
  onChange,
  minuteStep = 30,
  startHour = 6,
  endHour = 22,
  placeholder,
  disabled,
}: TimeSelectProps) {
  const options: SelectOption[] = useMemo(() => {
    const result: SelectOption[] = [];
    for (let h = startHour; h <= endHour; h += 1) {
      for (let m = 0; m < 60; m += minuteStep) {
        const time24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const time12 = to12hFormat(time24);
        result.push({ value: time24, label: time12 });
      }
    }
    return result;
  }, [minuteStep, startHour, endHour]);

  return (
    <Select
      options={options}
      {...(value !== undefined && { value })}
      onValueChange={onChange}
      {...(placeholder !== undefined && { placeholder })}
      {...(disabled !== undefined && { disabled })}
    />
  );
}
