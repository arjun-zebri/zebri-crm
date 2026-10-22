import { createIcon } from './icon-base';

/**
 * Palette glyph: a round palette with a thumb notch and four paint dots. For colours and themes.
 *
 * @example
 * ```tsx
 * <PaletteIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/palette
 */
export const PaletteIcon = createIcon(
  'PaletteIcon',
  'glyph',
  <>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-2 2-2h2a3.5 3.5 0 0 0 3.5-3.5c0-4-3.8-7-8.5-7z" />
    <path d="M7.5 12.5h0M8.5 8.5h0M12.5 7h0M16.5 8.5h0" />
  </>,
);
