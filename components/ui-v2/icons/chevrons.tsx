import { createIcon } from './icon-base';

/**
 * Chevron glyphs: small open chevrons in four directions, lighter than the
 * Arrow glyphs. For dropdowns, disclosure rows and steppers.
 *
 * @example
 * ```tsx
 * <ChevronDownIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/chevrons
 */
export const ChevronDownIcon = createIcon(
  'ChevronDownIcon',
  'glyph',
  <>
    <path d="M7 9.5l5 5 5-5" />
  </>,
);

export const ChevronLeftIcon = createIcon(
  'ChevronLeftIcon',
  'glyph',
  <>
    <path d="M14.5 7l-5 5 5 5" />
  </>,
);

export const ChevronRightIcon = createIcon(
  'ChevronRightIcon',
  'glyph',
  <>
    <path d="M9.5 7l5 5-5 5" />
  </>,
);

export const ChevronUpIcon = createIcon(
  'ChevronUpIcon',
  'glyph',
  <>
    <path d="M7 14.5l5-5 5 5" />
  </>,
);
