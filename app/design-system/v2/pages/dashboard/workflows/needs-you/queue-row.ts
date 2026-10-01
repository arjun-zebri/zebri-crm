/**
 * The layout every Up next row shares, so the columns line up across
 * sections: who and what, Zebri's why, when, then the row's action. The
 * page is full width; the why column takes the slack (twice the title's
 * share), and the when and action columns sit side by side at the right,
 * so a row's time is read next to the button it applies to.
 * Tighter than the Payments row (a queue is scanned, not browsed), and
 * the lead slot (a couple's avatars or a to-do's box) is one width, so
 * every title starts on the same edge.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/needs-you/queue-row
 */

/** The row: the Payments row's shape and hover, with less padding. */
export const QUEUE_ROW =
  'relative grid cursor-pointer gap-x-8 gap-y-1 rounded-button px-3 py-3 transition-colors duration-150 hover:bg-zebra-950/[0.03] motion-reduce:transition-none';

/** Phones: title and action on one line, the rest under. Desktop: four columns. */
export const QUEUE_GRID = 'grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)_8rem_8rem] lg:gap-x-6';

/**
 * A line under the title on phones, indented to the title's edge (the
 * 3.5rem lead slot plus its gap); its own column on desktop.
 */
export const UNDER = 'col-span-full pl-[4.25rem] lg:col-span-1 lg:row-start-auto lg:pl-0';
