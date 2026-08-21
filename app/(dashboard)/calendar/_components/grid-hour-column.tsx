/**
 * Hour rail and horizontal gridlines for the day-view hour grid.
 *
 * Renders a vertical column with hour labels (07:00, 08:00, etc.) and
 * corresponding horizontal lines that divide the grid into hour segments.
 *
 * @module app/(dashboard)/calendar/_components/grid-hour-column
 */

/**
 * Props for GridHourColumn.
 */
export interface GridHourColumnProps {
  /** Start hour (0-23), inclusive. */
  startHour: number;
  /** End hour (0-23), exclusive. */
  endHour: number;
  /** Pixel height per minute. 2 = 120px per hour. */
  pxPerMinute: number;
  /** Total grid height in pixels. */
  gridHeightPx: number;
  /**
   * Blank space reserved above the first hour label, in pixels.
   *
   * The week view puts a day-name header above each day column, so the rail
   * has to start that far down or every hour label sits one header-height
   * above the band it labels. The day view has no such header and passes 0.
   */
  topOffsetPx?: number;
}

/**
 * Hour rail and gridlines for the day-view hour grid.
 *
 * Renders a fixed-width column on the left with hour labels (e.g., "07:00", "08:00")
 * aligned to the top of each hour segment. Horizontal lines span the full width
 * to divide the grid into hour segments.
 *
 * @param props - GridHourColumnProps
 * @returns JSX element
 */
export function GridHourColumn({
  startHour,
  endHour,
  pxPerMinute,
  gridHeightPx,
  topOffsetPx = 0,
}: GridHourColumnProps) {
  const hourHeightPx = 60 * pxPerMinute;
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) {
    hours.push(h);
  }

  return (
    <div
      className="relative bg-surface border-r border-border"
      style={{ width: '64px', height: `${gridHeightPx + topOffsetPx}px` }}
      data-testid="grid-hour-column"
    >
      {hours.map((hour, idx) => {
        const topPx = topOffsetPx + idx * hourHeightPx;
        const timeStr = `${String(hour).padStart(2, '0')}:00`;

        return (
          <div key={hour}>
            {/* Hour label */}
            <div
              className="absolute text-body text-text-muted font-medium pl-2 pt-1"
              style={{ top: `${topPx}px`, width: '64px' }}
            >
              {timeStr}
            </div>

            {/* Horizontal gridline */}
            <div
              className="absolute w-full border-t border-border"
              style={{
                top: `${topPx}px`,
                left: '0',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
