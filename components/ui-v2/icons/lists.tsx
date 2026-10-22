import { createIcon } from './icon-base';

/**
 * List glyphs: bulleted, numbered and checklist, drawn as one family.
 * All three put their rows on y 7, 12 and 17 (5 apart rather than the
 * 3.5 of a document body, so the numerals and ticks have room to read).
 *
 * @example
 * ```tsx
 * <ListIcon className="size-4" />
 * <ListOrderedIcon className="size-4" />
 * <ListChecksIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/lists
 */

/** Three rows with dot markers. */
export const ListIcon = createIcon(
  'ListIcon',
  'glyph',
  <>
    <path d="M5 7h0M5 12h0M5 17h0" />
    <path d="M8 7h11.5M8 12h11.5M8 17h11.5" />
  </>,
);

/** Three rows numbered 1 and 2, as Lucide draws it. */
export const ListOrderedIcon = createIcon(
  'ListOrderedIcon',
  'glyph',
  <>
    <path d="M5 5.5l1.5-1v5" />
    <path d="M4.5 16a1.5 1.5 0 0 1 3 0c0 1.5-3 2-3 3.5h3" />
    <path d="M11 7h8.5M11 12h8.5M11 17h8.5" />
  </>,
);

/** Three rows, the first and last ticked. */
export const ListChecksIcon = createIcon(
  'ListChecksIcon',
  'glyph',
  <>
    <path d="M4 7l1.5 1.5 3-3M4 17l1.5 1.5 3-3" />
    <path d="M11 7h8.5M11 12h8.5M11 17h8.5" />
  </>,
);
