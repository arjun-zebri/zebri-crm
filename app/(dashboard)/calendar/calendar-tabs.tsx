/**
 * /calendar page tab strip: Calendar, Meeting types, Availability.
 *
 * Mirrors the TabButton idiom from payments-header; mobile-friendly
 * with horizontal scroll if needed.
 *
 * @module app/(dashboard)/calendar/calendar-tabs
 */
'use client';

export type CalendarTab = 'calendar' | 'meeting-types' | 'availability' | 'bookings';

export interface CalendarTabsProps {
  /** The currently active tab. */
  active: CalendarTab;
  /** Callback when a tab is clicked. */
  onChange: (tab: CalendarTab) => void;
}

/** Tab bar for /calendar: Calendar, Meeting types, Availability, Bookings. */
export function CalendarTabs({ active, onChange }: CalendarTabsProps) {
  return (
    // `-mb-px` lives here, not on the buttons. The active tab's 2px underline
    // has to sit on the wrapper's 1px divider, but pulling each button up
    // individually left its border box 1px taller than this scroll container's
    // content box. `overflow-x-auto` forces `overflow-y` to compute to `auto`
    // (CSS spec: a non-visible overflow on one axis makes the other `auto`), so
    // that stray 1px rendered as a vertical scrollbar next to the tabs.
    <div className="flex items-center gap-6 overflow-x-auto -mb-px">
      <TabButton
        active={active === 'calendar'}
        onClick={() => onChange('calendar')}
        label="Calendar"
      />
      <TabButton
        active={active === 'meeting-types'}
        onClick={() => onChange('meeting-types')}
        label="Meeting types"
      />
      <TabButton
        active={active === 'availability'}
        onClick={() => onChange('availability')}
        label="Availability"
      />
      <TabButton
        active={active === 'bookings'}
        onClick={() => onChange('bookings')}
        label="Bookings"
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-2 text-body font-medium transition border-b-2 cursor-pointer whitespace-nowrap ${
        active
          ? 'border-text text-text'
          : 'border-transparent text-text-muted hover:text-text'
      }`}
    >
      {label}
    </button>
  );
}
