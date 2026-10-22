import { createIcon } from './icon-base';

/**
 * Heading glyphs: a plain H, and a smaller H with a 2 or a 3 for the
 * heading levels. Drawn as one family for the doc-builder toolbar.
 *
 * @example
 * ```tsx
 * <HeadingIcon className="size-4" />
 * <Heading2Icon className="size-4" />
 * <Heading3Icon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/headings
 */

/** A plain H. */
export const HeadingIcon = createIcon(
  'HeadingIcon',
  'glyph',
  <>
    <path d="M6.5 4.5v15M17.5 4.5v15M6.5 12h11" />
  </>,
);

/** A small H with a 2. */
export const Heading2Icon = createIcon(
  'Heading2Icon',
  'glyph',
  <>
    <path d="M3.5 6.5v11M11.5 6.5v11M3.5 12h8" />
    <path d="M15.5 9a2.5 2.5 0 0 1 5 0c0 3-5 4.5-5 8.5h5" />
  </>,
);

/** A small H with a 3. */
export const Heading3Icon = createIcon(
  'Heading3Icon',
  'glyph',
  <>
    <path d="M3.5 6.5v11M11.5 6.5v11M3.5 12h8" />
    <path d="M15.5 6.5H18a2.5 2.5 0 0 1 0 5 3 3 0 0 1 0 6h-2.5" />
  </>,
);
