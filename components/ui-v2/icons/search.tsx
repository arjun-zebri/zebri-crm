import { createIcon } from './icon-base';

/**
 * Search glyph: a round lens with a short handle. For search and find.
 *
 * @example
 * ```tsx
 * <SearchIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/search
 */
export const SearchIcon = createIcon(
  'SearchIcon',
  'glyph',
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 20 20" />
  </>,
);
