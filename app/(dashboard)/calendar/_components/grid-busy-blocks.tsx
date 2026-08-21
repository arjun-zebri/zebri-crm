/**
 * External busy interval blocks for the day-view hour grid.
 *
 * Renders busy intervals from external calendars (Google Calendar, Microsoft
 * Graph) as semi-transparent blocks above the availability bands but below
 * the booking chips. Visually distinct from bookings to show the MC which
 * time blocks are "blocked by my external calendar" vs "booked through Zebri".
 *
 * @module app/(dashboard)/calendar/_components/grid-busy-blocks
 */
import type { BusyEvent } from '@/lib/calendar/free-busy';
import { bandGeometry, layoutOverlaps, type GridConfig } from '@/lib/calendar/grid-layout';

/**
 * Shortest block, in pixels, that can carry a readable title.
 *
 * Below this the label would overflow its block and collide with whatever
 * sits underneath, so short blocks stay bare and rely on the tooltip.
 */
const MIN_LABEL_HEIGHT_PX = 24;

/**
 * Vertical gap trimmed off the bottom of each block, in pixels.
 *
 * Two back-to-back meetings share an edge, and without a gap they render as
 * one continuous slab with two titles in it, which reads as a single long
 * appointment. The trim is taken from the height rather than added as a margin
 * so the top of each block stays exactly on its start time.
 */
const BLOCK_GAP_PX = 3;

/**
 * Props for GridBusyBlocks.
 */
export interface GridBusyBlocksProps {
  /** External busy events from Google Calendar, Microsoft Graph, etc. */
  busy: BusyEvent[];
  /** Start of the day (for computing grid positions). */
  dayStart: Date;
  /** Grid configuration. */
  gridConfig: GridConfig;
}

/**
 * External busy interval blocks.
 *
 * Renders busy intervals as tinted, non-clickable blocks carrying the event
 * title, so the MC can tell what is holding the time rather than only that
 * something is. Warning-tinted with a solid left rule, which is what
 * distinguishes them from the brand-coloured Zebri booking chips.
 *
 * @param props - GridBusyBlocksProps
 * @returns JSX element
 */
export function GridBusyBlocks({
  busy,
  dayStart,
  gridConfig,
}: GridBusyBlocksProps) {
  // Side by side, not stacked. These are no longer merged before display, so
  // two overlapping meetings used to be drawn as two full-width translucent
  // slabs on top of each other; enough of them and the whole day washed orange
  // with no way to tell one commitment from another.
  const layout = layoutOverlaps(
    busy.map((event, idx) => ({ ...event, id: `${event.start}-${event.end}-${idx}` })),
  );

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {layout.map(({ item: interval, col, totalCols }, idx) => {
        const geometry = bandGeometry(
          {
            start: interval.start,
            end: interval.end,
          },
          dayStart,
          gridConfig,
        );

        if (!geometry) return null;

        const widthPercent = 100 / totalCols;
        const leftPercent = (col / totalCols) * 100;

        // Google and Microsoft both omit the title for events the MC only has
        // free/busy visibility on, so a fallback is required rather than optional.
        const label = interval.title ?? 'Busy';

        // Never trim a short block out of existence.
        const renderedHeightPx = Math.max(geometry.heightPx - BLOCK_GAP_PX, geometry.heightPx / 2);

        return (
          <div
            key={idx}
            // Opaque base under the tint. A translucent block let whatever sat
            // beneath it show through and compound, which is how overlapping
            // busy time turned the grid into one orange wash.
            className="absolute bg-surface border-l-2 border-warning rounded-r-control overflow-hidden"
            style={{
              top: `${geometry.topPx}px`,
              height: `${renderedHeightPx}px`,
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
            }}
            title={label}
            data-testid="grid-busy-block"
          >
            <span aria-hidden="true" className="absolute inset-0 bg-warning/20" />
            {renderedHeightPx >= MIN_LABEL_HEIGHT_PX && (
              <div
                className="relative truncate text-body text-text-muted px-2 py-1"
                data-testid="grid-busy-block-label"
              >
                {label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
