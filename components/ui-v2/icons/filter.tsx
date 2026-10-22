import { createIcon } from './icon-base';

/**
 * Filter glyph: three lines narrowing toward the bottom. For filtering a list.
 *
 * @example
 * ```tsx
 * <FilterIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/filter
 */
export const FilterIcon = createIcon(
  'FilterIcon',
  'glyph',
  <>
    <path d="M4 6.5h16M7 12h10M10 17.5h4" />
  </>,
);
