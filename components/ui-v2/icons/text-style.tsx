import { createIcon } from './icon-base';

/**
 * Text style glyphs: bold, italic, underline and strikethrough, drawn as one
 * family for the doc-builder and canvas text toolbars. Every letter sits on
 * the same 4.5 to 19.5 cap height so the four line up side by side.
 *
 * @example
 * ```tsx
 * <BoldIcon className="size-4" />
 * <ItalicIcon className="size-4" />
 * <UnderlineIcon className="size-4" />
 * <StrikethroughIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/text-style
 */

/** A bold B with a soft stem. */
export const BoldIcon = createIcon(
  'BoldIcon',
  'glyph',
  <>
    <path d="M7.5 12H13a3.75 3.75 0 0 1 0 7.5H9a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 9 4.5h3.5a3.75 3.75 0 0 1 0 7.5" />
  </>,
);

/** A slanted I with top and bottom bars. */
export const ItalicIcon = createIcon(
  'ItalicIcon',
  'glyph',
  <>
    <path d="M10 4.5h7M7 19.5h7M14 4.5l-4 15" />
  </>,
);

/** A U over a rule. */
export const UnderlineIcon = createIcon(
  'UnderlineIcon',
  'glyph',
  <>
    <path d="M7.5 4.5V11a4.5 4.5 0 0 0 9 0V4.5M6 19.5h12" />
  </>,
);

/** An S struck through the middle. */
export const StrikethroughIcon = createIcon(
  'StrikethroughIcon',
  'glyph',
  <>
    <path d="M16.5 4.5h-6a3.5 3.5 0 0 0-3.5 3.5" />
    <path d="M13.5 12a3.75 3.75 0 0 1 0 7.5h-6M5.5 12h13" />
  </>,
);
