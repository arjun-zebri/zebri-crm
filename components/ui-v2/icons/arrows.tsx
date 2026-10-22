import { createIcon } from './icon-base';

/**
 * Arrow glyphs: soft open chevrons, left and right. For back and next,
 * previous and next, and collapsing or opening a panel.
 *
 * @example
 * ```tsx
 * <ArrowLeftIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/arrows
 */
export const ArrowLeftIcon = createIcon(
  'ArrowLeftIcon',
  'glyph',
  <>
    <path d="M15 6l-6 6 6 6" />
  </>,
);

export const ArrowRightIcon = createIcon(
  'ArrowRightIcon',
  'glyph',
  <>
    <path d="M9 6l6 6-6 6" />
  </>,
);

/**
 * A true arrow, shaft and head: the call to action's "go" (Get early
 * access), where a chevron reads as "next item" rather than "take me
 * there".
 */
export const ArrowForwardIcon = createIcon(
  'ArrowForwardIcon',
  'glyph',
  <>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </>,
);
