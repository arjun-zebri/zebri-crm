import { createIcon } from './icon-base';

/**
 * Calendar glyph: a soft page with two rings and a header over a grid
 * of day dots. For the Calendar and anything that picks or shows a date.
 *
 * @example
 * ```tsx
 * <CalendarIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/calendar
 */
export const CalendarIcon = createIcon(
  'CalendarIcon',
  'glyph',
  <>
    <rect x="3.5" y="4.5" width="17" height="16" rx="4" />
    <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" />
    <path d="M8 13.5h0M12 13.5h0M16 13.5h0M8 17h0M12 17h0" />
  </>,
);
