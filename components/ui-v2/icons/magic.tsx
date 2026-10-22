import { createIcon } from './icon-base';

/**
 * Magic glyph: a wand with a band near its tip and two small sparkles. For
 * generating or applying something automatically.
 *
 * @example
 * ```tsx
 * <MagicIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/magic
 */
export const MagicIcon = createIcon(
  'MagicIcon',
  'glyph',
  <>
    <path d="M4 20 16.5 7.5M12.5 7.5l4 4" />
    <path d="M6 3.5v5M3.5 6h5" />
    <path d="M19 14.5v4M17 16.5h4" />
  </>,
);
