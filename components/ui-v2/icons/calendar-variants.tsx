import { createIcon } from './icon-base';

/**
 * Calendar variant glyphs: the Calendar frame exactly, plus one small detail in the body.
 * CalendarCheck: a check in the body. For a confirmed date.
 * CalendarClock: a small clock in the body. For a scheduled time.
 * CalendarRange: a dot and bar over a bar and dot. For a date range.
 * CalendarSync: two opposing arrows in the body. For a synced calendar.
 *
 * @example
 * ```tsx
 * <CalendarCheckIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/calendar-variants
 */
export const CalendarCheckIcon = createIcon(
  'CalendarCheckIcon',
  'glyph',
  <>
    <rect x="3.5" y="4.5" width="17" height="16" rx="4" />
    <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" />
    <path d="M9 15l2 2 4-4" />
  </>,
);

export const CalendarClockIcon = createIcon(
  'CalendarClockIcon',
  'glyph',
  <>
    <rect x="3.5" y="4.5" width="17" height="16" rx="4" />
    <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" />
    <circle cx="12" cy="15" r="3" />
    <path d="M12 13.5V15h1.5" />
  </>,
);

export const CalendarRangeIcon = createIcon(
  'CalendarRangeIcon',
  'glyph',
  <>
    <rect x="3.5" y="4.5" width="17" height="16" rx="4" />
    <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" />
    <path d="M8 13.5h0M11.5 13.5H16M8 17h4.5M16 17h0" />
  </>,
);

export const CalendarSyncIcon = createIcon(
  'CalendarSyncIcon',
  'glyph',
  <>
    <rect x="3.5" y="4.5" width="17" height="16" rx="4" />
    <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" />
    <path d="M8 13.5h8L14.5 12M16 17.5H8L9.5 19" />
  </>,
);
