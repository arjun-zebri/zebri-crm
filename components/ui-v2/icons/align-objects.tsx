import { createIcon } from './icon-base';

/**
 * Object alignment glyphs for the canvas: an axis line with two soft bars,
 * one long and one short, lined up against it. Top, middle and bottom
 * align on a horizontal axis; left, centre and right edge are the same
 * drawings turned on to a vertical axis. Where the axis runs through the
 * bars (middle, centre) the bars break around it, as in Lucide.
 *
 * @example
 * ```tsx
 * <AlignTopIcon className="size-4" />
 * <AlignMiddleIcon className="size-4" />
 * <AlignBottomIcon className="size-4" />
 * <AlignLeftEdgeIcon className="size-4" />
 * <AlignCentreEdgeIcon className="size-4" />
 * <AlignRightEdgeIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/align-objects
 */

/** Bars hanging from a top axis. */
export const AlignTopIcon = createIcon(
  'AlignTopIcon',
  'glyph',
  <>
    <path d="M3.5 3.5h17" />
    <rect x="6" y="6" width="5" height="14.5" rx="2" />
    <rect x="13" y="6" width="5" height="8" rx="2" />
  </>,
);

/** Bars centred on a horizontal axis. */
export const AlignMiddleIcon = createIcon(
  'AlignMiddleIcon',
  'glyph',
  <>
    <path d="M3.5 12h17" />
    <path d="M11 9V5.5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2V9M6 15v3.5a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V15" />
    <path d="M18 9v-.5a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2V9M13 15v.5a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V15" />
  </>,
);

/** Bars standing on a bottom axis. */
export const AlignBottomIcon = createIcon(
  'AlignBottomIcon',
  'glyph',
  <>
    <path d="M3.5 20.5h17" />
    <rect x="6" y="3.5" width="5" height="14.5" rx="2" />
    <rect x="13" y="10" width="5" height="8" rx="2" />
  </>,
);

/** Bars against a left axis. */
export const AlignLeftEdgeIcon = createIcon(
  'AlignLeftEdgeIcon',
  'glyph',
  <>
    <path d="M3.5 3.5v17" />
    <rect x="6" y="6" width="14.5" height="5" rx="2" />
    <rect x="6" y="13" width="8" height="5" rx="2" />
  </>,
);

/** Bars centred on a vertical axis. */
export const AlignCentreEdgeIcon = createIcon(
  'AlignCentreEdgeIcon',
  'glyph',
  <>
    <path d="M12 3.5v17" />
    <path d="M9 11H5.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H9M15 6h3.5a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H15" />
    <path d="M9 18h-.5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2H9M15 13h.5a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H15" />
  </>,
);

/** Bars against a right axis. */
export const AlignRightEdgeIcon = createIcon(
  'AlignRightEdgeIcon',
  'glyph',
  <>
    <path d="M20.5 3.5v17" />
    <rect x="3.5" y="6" width="14.5" height="5" rx="2" />
    <rect x="10" y="13" width="8" height="5" rx="2" />
  </>,
);
