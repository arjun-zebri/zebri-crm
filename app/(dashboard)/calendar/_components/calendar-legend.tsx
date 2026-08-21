/**
 * Calendar layer legend showing visual indicators for:
 * - Available (light background band)
 * - Busy elsewhere (warning tint with a left rule)
 * - Booked (brand-coloured chip)
 *
 * Each swatch below carries the SAME classes as the layer it stands for, so
 * the legend cannot drift from the grid. An earlier version drew the busy
 * swatch as diagonal hatching that appeared nowhere on the grid, which made
 * the legend actively misleading: the reader looked for stripes and found
 * solid blocks. If you restyle a layer, restyle its swatch in the same edit.
 *
 * @module app/(dashboard)/calendar/_components/calendar-legend
 */

/** Matches GridAvailabilityBands. */
const AVAILABLE_SWATCH = 'bg-surface-emphasis opacity-20 border border-border';
/** Matches GridBusyBlocks. */
const BUSY_SWATCH = 'bg-warning/20 border-l-2 border-warning';
/** Matches GridBookingChip. */
const BOOKED_SWATCH = 'bg-info/10 border-l-2 border-info rounded-r-control';

/**
 * Three-item legend for the calendar grid layers.
 * Renders compact swatches with labels below the toolbar.
 *
 * @returns JSX element
 */
export function CalendarLegend() {
  const items = [
    { label: 'Available', title: 'Available time', swatch: AVAILABLE_SWATCH },
    { label: 'Busy elsewhere', title: 'Busy on external calendar', swatch: BUSY_SWATCH },
    { label: 'Booked', title: 'Booked through Zebri', swatch: BOOKED_SWATCH },
  ];

  return (
    <div className="flex items-center gap-6">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div className={`w-6 h-4 shrink-0 ${item.swatch}`} title={item.title} />
          <span className="text-body text-text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
