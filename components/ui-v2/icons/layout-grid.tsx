import { createIcon } from './icon-base';

/**
 * Layout grid glyph: four small soft squares in a grid. For a grid layout.
 *
 * @example
 * ```tsx
 * <LayoutGridIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/layout-grid
 */
export const LayoutGridIcon = createIcon(
  'LayoutGridIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </>,
);
