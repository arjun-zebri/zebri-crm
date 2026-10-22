import { createIcon } from './icon-base';

/**
 * Text glyph: three lines of text, the last one short. For a text block.
 *
 * @example
 * ```tsx
 * <TextIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/text
 */
export const TextIcon = createIcon(
  'TextIcon',
  'glyph',
  <>
    <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h9" />
  </>,
);
