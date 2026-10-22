import { createIcon } from './icon-base';

/**
 * Arrow glyphs (vertical): soft open chevrons, up and down, drawn as the vertical pair of
 * ArrowLeftIcon and ArrowRightIcon. For moving something up or down and sort direction.
 *
 * @example
 * ```tsx
 * <ArrowUpIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/arrows-vertical
 */
export const ArrowUpIcon = createIcon(
  'ArrowUpIcon',
  'glyph',
  <>
    <path d="M6 15l6-6 6 6" />
  </>,
);

export const ArrowDownIcon = createIcon(
  'ArrowDownIcon',
  'glyph',
  <>
    <path d="M6 9l6 6 6-6" />
  </>,
);
