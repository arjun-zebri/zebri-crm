import { createIcon } from './icon-base';

/**
 * Overview glyph: a soft frame with a small line chart rising inside,
 * how things are going at a glance. For the Overview view on the
 * Documents page.
 *
 * @example
 * ```tsx
 * <OverviewIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/overview
 */
export const OverviewIcon = createIcon(
  'OverviewIcon',
  'glyph',
  <>
    <rect x="3" y="3.5" width="18" height="17" rx="4" />
    <path d="m7 15 3-3 3 2 4-5" />
  </>,
);
